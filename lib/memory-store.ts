/**
 * تخزين سوفت مومنت — ذاكرة + ملف محلي
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { BlobNotFoundError, get, list, put } from "@vercel/blob";
import { join } from "path";
import { randomUUID } from "crypto";
import { asArray } from "./arrays";
import { normalizeServiceCategory, logBookingCategorySnapshot } from "./categories";
import {
  bookingsForScheduleGroup,
  resolveScheduleGroupFromCart,
  scheduleGroupForServiceId,
  SCHEDULE_GROUP_THERAPIST,
} from "./schedule-groups";
import { normalizePhone, phonesMatch } from "./customer";
import { getLoyaltyDiscountPercent, getNextLoyaltyTier } from "./loyalty";
import { calculateCartPricing, calculateFromSelections } from "./pricing";
import { purgeExpiredDoorImages } from "./door-images";
import { dispatchExternalNotification } from "./notification-dispatch";
import {
  buildNotificationContent,
  isUpcomingForReminder,
  notificationExists,
} from "./notifications";
import { buildReports, computeDelayMinutes, getBookingsForTherapistToday } from "./reports";
import { applyPromotions, generateGiftCode, type PromotionInput } from "./promotions";
import {
  calculateEndTime,
  findAvailableTherapist,
  getAvailableSlots,
  getAvailableSlotsForDay,
  isSlotValidForTherapist,
  bookingsForTherapist,
  parseRiyadhDateKey,
} from "./scheduling";
import { computeCartItemDuration } from "./duration";
import {
  DEFAULT_ADDONS,
  DEFAULT_DISCOUNT_CODES,
  DEFAULT_SERVICES,
  DEFAULT_SESSION_PACKAGES,
  DEFAULT_SETTINGS,
  DEFAULT_THERAPISTS,
} from "./seed-data";
import type {
  AppNotification,
  BalanceGiftCard,
  Booking,
  BookingForSchedule,
  BookingRating,
  BookingStatus,
  BookingWithServices,
  CartItem,
  CatalogService,
  CustomerAccount,
  CustomerLoyalty,
  CustomerPackage,
  DiscountCode,
  GiftCard,
  GiftPaymentStatus,
  NotificationAudience,
  NotificationType,
  PaymentStatus,
  PricingResult,
  ReportsSummary,
  Region,
  SalonSettings,
  ServiceAddon,
  ServiceSelection,
  SessionPackage,
  Therapist,
  VisitStatus,
  WalletTransaction,
} from "./types";

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "soft-touch.json");

interface StoreData {
  settings: SalonSettings;
  services: CatalogService[];
  addons: ServiceAddon[];
  therapists: Therapist[];
  bookings: BookingWithServices[];
  /** فهرس كل معرّفات الحجوزات — لاستعادة الحجوزات الناقصة من ملفات Blob الفردية */
  bookingIndex?: string[];
  gifts: GiftCard[];
  loyalty: CustomerLoyalty[];
  customerNames: Record<string, string>;
  discountCodes: DiscountCode[];
  sessionPackages: SessionPackage[];
  customerPackages: CustomerPackage[];
  balanceGiftCards: BalanceGiftCard[];
  walletTransactions: WalletTransaction[];
  ratings: BookingRating[];
  notifications: AppNotification[];
}

type MemoryStore = StoreData;

function defaultStore(): StoreData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    services: [...DEFAULT_SERVICES],
    addons: [...DEFAULT_ADDONS],
    therapists: [...DEFAULT_THERAPISTS],
    bookings: [],
    gifts: [],
    loyalty: [],
    customerNames: {},
    discountCodes: [...DEFAULT_DISCOUNT_CODES],
    sessionPackages: [...DEFAULT_SESSION_PACKAGES],
    customerPackages: [],
    balanceGiftCards: [],
    walletTransactions: [],
    ratings: [],
    notifications: [],
  };
}

function mergeServices(stored: CatalogService[] | undefined): CatalogService[] {
  const map = new Map(DEFAULT_SERVICES.map((s) => [s.id, { ...s }]));
  for (const s of asArray<CatalogService>(stored)) {
    const seed = map.get(s.id);
    if (seed) {
      const merged: CatalogService = { ...seed, ...s };
      // إصلاح بيانات قديمة: custom يمنع الحجز — نُعيد تعريف البذرة
      if (seed.pricing_model !== "custom" && merged.pricing_model === "custom") {
        merged.pricing_model = seed.pricing_model;
        merged.bundle_price = seed.bundle_price ?? merged.bundle_price;
        merged.price = seed.price ?? merged.price;
        merged.bundle_includes = seed.bundle_includes ?? merged.bundle_includes;
        merged.region_surcharge = seed.region_surcharge ?? merged.region_surcharge;
      }
      const normalized = normalizeServiceCategory(String(merged.category));
      if (normalized) merged.category = normalized;
      else if (seed) merged.category = seed.category;
      if (seed.schedule_group) merged.schedule_group = seed.schedule_group;
      map.set(s.id, merged);
    } else {
      const normalized = normalizeServiceCategory(String(s.category));
      const merged = normalized ? { ...s, category: normalized } : { ...s };
      const sg = scheduleGroupForServiceId(s.id);
      if (sg) merged.schedule_group = sg;
      map.set(s.id, merged);
    }
  }
  return Array.from(map.values());
}

function migrateStore(parsed: Partial<StoreData>): StoreData {
  const base = defaultStore();
  const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed.settings };
  if (mergedSettings.brandName === "Pink Touch") {
    mergedSettings.brandName = DEFAULT_SETTINGS.brandName;
    mergedSettings.tagline = DEFAULT_SETTINGS.tagline;
  }
  return {
    ...base,
    ...parsed,
    settings: mergedSettings,
    services: mergeServices(parsed.services),
    gifts: asArray(parsed.gifts),
    bookings: asArray(parsed.bookings),
    bookingIndex: asArray<string>(parsed.bookingIndex).length
      ? Array.from(new Set(asArray<string>(parsed.bookingIndex)))
      : asArray<BookingWithServices>(parsed.bookings).map((b) => b.id),
    loyalty: asArray(parsed.loyalty),
    customerNames: parsed.customerNames ?? {},
    discountCodes: asArray(parsed.discountCodes).length
      ? asArray(parsed.discountCodes)
      : base.discountCodes,
    sessionPackages: asArray(parsed.sessionPackages).length
      ? asArray(parsed.sessionPackages)
      : base.sessionPackages,
    customerPackages: asArray(parsed.customerPackages),
    balanceGiftCards: asArray(parsed.balanceGiftCards),
    walletTransactions: asArray(parsed.walletTransactions),
    ratings: asArray(parsed.ratings),
    notifications: asArray(parsed.notifications),
  };
}

// ─── التخزين: Vercel Blob خاص (Private) + ملف محلي (للتطوير) ───
//
// على Vercel: البيانات تُحفظ في Vercel Blob الخاص — القراءة عبر التوكن فقط.
// محلياً (بدون توكن): تُحفظ في data/soft-touch.json كما كانت.
//
// دورة الحياة لكل طلب API:
//   initStore()  → يحمّل أحدث نسخة قبل المعالجة
//   ...المعالجة (store()/persist() متزامنة كما هي)...
//   flushStore() → يحفظ التغييرات في السحابة إن وُجدت

/** مفتاح موحّد لملف المتجر الكامل — نفس المسار للكتابة والقراءة */
const BLOB_STORE_PATH = "soft-moment/store.json";
/** بادئة ملفات الحجوزات الفردية: soft-moment/bookings/{id}.json */
const BLOB_BOOKINGS_PREFIX = "soft-moment/bookings/";

function bookingBlobPath(id: string): string {
  return `${BLOB_BOOKINGS_PREFIX}${id.trim()}.json`;
}

export function blobDiag(stage: string, extra: Record<string, unknown> = {}): void {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  console.log(
    `[blob-store] ${stage}`,
    JSON.stringify({
      path: BLOB_STORE_PATH,
      vercel: Boolean(process.env.VERCEL),
      hasToken: Boolean(token),
      tokenLength: token?.length ?? 0,
      hasStoreId: Boolean(process.env.BLOB_STORE_ID?.trim()),
      ...extra,
    }),
  );
}

/** Blob على Vercel: توكن الكتابة/القراءة أو OIDC + BLOB_STORE_ID */
function shouldUseBlob(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (process.env.VERCEL && process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

interface GlobalStore {
  __softStore?: MemoryStore;
}

function globalRef(): typeof globalThis & GlobalStore {
  return globalThis as typeof globalThis & GlobalStore;
}

let dirty = false;
const dirtyBookingIds = new Set<string>();

function markBookingDirty(id: string): void {
  dirtyBookingIds.add(id.trim());
}

function loadFromFile(): StoreData | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const raw = readFileSync(DATA_FILE, "utf-8");
    return migrateStore(JSON.parse(raw) as Partial<StoreData>);
  } catch {
    return null;
  }
}

function saveToFile(data: StoreData): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("تعذّر حفظ الملف المحلي:", e);
  }
}

function formatBlobError(e: unknown): string {
  if (e instanceof Error) {
    const extra = e as Error & { status?: number; statusCode?: number; body?: unknown };
    const parts = [
      e.message,
      extra.status != null ? `status=${extra.status}` : "",
      extra.statusCode != null ? `statusCode=${extra.statusCode}` : "",
      extra.body != null ? `body=${JSON.stringify(extra.body)}` : "",
      e.stack,
    ].filter(Boolean);
    return parts.join(" | ");
  }
  return String(e);
}

async function fetchPrivateBlobText(url: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`blob fetch failed status=${res.status} url=${url} body=${body.slice(0, 500)}`);
  }
  return res.text();
}

/** قراءة store.json عبر list()+fetch — النمط الموثوق للمخزن Private */
async function readStoreViaList(): Promise<StoreData | null> {
  console.log("[blob-store] READ store via list START | path:", BLOB_STORE_PATH);
  try {
    const { blobs } = await list({ prefix: "soft-moment/", limit: 100 });
    const match =
      blobs.find((b) => b.pathname === BLOB_STORE_PATH) ??
      blobs.find((b) => b.pathname.endsWith("/store.json"));
    if (!match?.url) {
      console.log("[blob-store] READ store via list MISS | path:", BLOB_STORE_PATH);
      return null;
    }
    const text = await fetchPrivateBlobText(match.url);
    const data = migrateStore(JSON.parse(text) as Partial<StoreData>);
    console.log(
      "[blob-store] READ store via list OK | path:",
      match.pathname,
      "| bookings:",
      data.bookings.length,
      "| ids:",
      data.bookings.map((b) => b.id),
    );
    return data;
  } catch (e) {
    console.error("[blob-store] READ store via list ERROR |", formatBlobError(e));
    return null;
  }
}

async function readFromBlob(): Promise<StoreData | null> {
  if (shouldUseBlob()) {
    const viaList = await readStoreViaList();
    if (viaList) return viaList;
  }

  console.log("[blob-store] READ store via get START | path:", BLOB_STORE_PATH);
  try {
    const result = await get(BLOB_STORE_PATH, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.log("[blob-store] READ store MISS | path:", BLOB_STORE_PATH);
      return null;
    }
    const text = await new Response(result.stream).text();
    const data = migrateStore(JSON.parse(text) as Partial<StoreData>);
    console.log(
      "[blob-store] READ store OK | path:",
      BLOB_STORE_PATH,
      "| bookings:",
      data.bookings.length,
      "| ids:",
      data.bookings.map((b) => b.id),
    );
    return data;
  } catch (e) {
    if (e instanceof BlobNotFoundError) {
      console.log("[blob-store] READ store NOT_FOUND | path:", BLOB_STORE_PATH);
      return null;
    }
    console.error("[blob-store] READ store ERROR | path:", BLOB_STORE_PATH, e);
    return null;
  }
}

async function readFromBlobWithRetry(maxAttempts = 5): Promise<StoreData | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      console.log("[blob-store] READ store RETRY", attempt);
      await new Promise((r) => setTimeout(r, 150 * attempt));
    }
    const data = await readFromBlob();
    if (data) return data;
  }
  return null;
}

async function writeBookingBlob(booking: BookingWithServices): Promise<void> {
  const path = bookingBlobPath(booking.id);
  console.log("[blob-store] WRITE booking START | id:", booking.id, "| path:", path);
  const result = await put(path, JSON.stringify(booking), {
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    access: "private",
  });
  console.log(
    "[blob-store] WRITE booking OK | id:",
    booking.id,
    "| path:",
    path,
    "| pathname:",
    result.pathname,
  );
}

async function readBookingFromBlob(id: string): Promise<BookingWithServices | null> {
  const path = bookingBlobPath(id);
  console.log("[blob-store] READ booking START | id:", id, "| path:", path);
  try {
    const result = await get(path, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.log("[blob-store] READ booking MISS | id:", id, "| path:", path);
      return null;
    }
    const booking = JSON.parse(await new Response(result.stream).text()) as BookingWithServices;
    console.log("[blob-store] READ booking OK | id:", id, "| path:", path);
    return booking;
  } catch (e) {
    if (e instanceof BlobNotFoundError) {
      console.log("[blob-store] READ booking NOT_FOUND | id:", id, "| path:", path);
      return null;
    }
    console.error("[blob-store] READ booking ERROR | id:", id, e);
    return null;
  }
}

async function writeToBlob(data: StoreData, options?: { skipBookingFiles?: boolean }): Promise<{ pathname: string }> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

  // الذاكرة الحالية مصدر الحقيقة — لا نعيد استيراد حجوزات حُذفت من القائمة
  data.bookingIndex = Array.from(new Set(data.bookings.map((b) => b.id)));

  const payload = JSON.stringify(data);
  const ids = data.bookings.map((b) => b.id);
  console.log(
    "[blob-store] WRITE store START | path:",
    BLOB_STORE_PATH,
    "| token:",
    hasToken,
    "| bookings:",
    data.bookings.length,
    "| ids:",
    ids,
  );

  const result = await put(BLOB_STORE_PATH, payload, {
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    access: "private",
  });

  console.log(
    "[blob-store] WRITE store OK | path:",
    BLOB_STORE_PATH,
    "| pathname:",
    result.pathname,
    "| bookings:",
    data.bookings.length,
  );

  if (!options?.skipBookingFiles) {
    for (const booking of data.bookings) {
      await writeBookingBlob(booking);
    }
  }

  return { pathname: result.pathname };
}

function store(): MemoryStore {
  const g = globalRef();
  if (!g.__softStore) {
    g.__softStore = shouldUseBlob() ? defaultStore() : loadFromFile() ?? defaultStore();
  }
  return g.__softStore;
}

function mergeBookingsById(
  primary: BookingWithServices[],
  secondary: BookingWithServices[],
): BookingWithServices[] {
  const map = new Map<string, BookingWithServices>();
  for (const b of secondary) map.set(b.id, b);
  for (const b of primary) map.set(b.id, b);
  return Array.from(map.values());
}

/** استعادة حجوزات موجودة في الفهرس/ملفات Blob لكن ناقصة من store.json */
async function reconcileBookingsFromIndex(): Promise<void> {
  const s = store();
  const knownIds = new Set(s.bookings.map((b) => b.id));

  if (!shouldUseBlob()) {
    s.bookingIndex = s.bookings.map((b) => b.id);
    return;
  }

  const blobData = await readFromBlob();
  const blobIndex = asArray<string>(blobData?.bookingIndex);
  let restored = 0;

  for (const id of blobIndex) {
    if (knownIds.has(id)) continue;
    const fromBlob = await readBookingFromBlob(id);
    if (fromBlob) {
      s.bookings.push(fromBlob);
      knownIds.add(id);
      restored += 1;
      console.log("[reconcileBookings] restored from booking file | id:", id);
      logBookingCategorySnapshot("reconcile", fromBlob, s.services);
    }
  }

  s.bookingIndex = s.bookings.map((b) => b.id);
  if (restored > 0) persist();
}

/** يُستدعى في بداية كل مسار API — يحمّل أحدث نسخة قبل المعالجة */
export async function initStore(): Promise<void> {
  const g = globalRef();
  if (shouldUseBlob()) {
    const warm = g.__softStore;
    const data = await readFromBlob();
    if (data) {
      g.__softStore = data;
      blobDiag("INIT_LOADED", { bookingsCount: data.bookings.length, source: "blob" });
    } else if (warm && warm.bookings.length > 0) {
      // blob فشل/فارغ لكن الذاكرة الدافئة فيها حجوزات (مثلاً بعد POST مباشرة)
      g.__softStore = warm;
      blobDiag("INIT_KEEP_WARM", { bookingsCount: warm.bookings.length });
    } else {
      g.__softStore = defaultStore();
      blobDiag("INIT_NEW", { bookingsCount: 0, source: "defaultStore" });
    }
    await reconcileBookingsFromIndex();
  } else if (!g.__softStore) {
    g.__softStore = loadFromFile() ?? defaultStore();
    blobDiag("INIT_LOCAL", {
      bookingsCount: g.__softStore.bookings.length,
      source: existsSync(DATA_FILE) ? "file" : "defaultStore",
    });
  }
  runMaintenance();
}

/** يُستدعى في نهاية كل مسار API — يحفظ التغييرات في السحابة إن وُجدت */
export async function flushStore(): Promise<void> {
  if (!dirty) {
    blobDiag("FLUSH_SKIP", { reason: "not_dirty" });
    return;
  }
  if (!shouldUseBlob()) {
    dirty = false;
    if (process.env.VERCEL) {
      console.error(
        "[blob-store] FLUSH_BLOCKED: لا يوجد BLOB_READ_WRITE_TOKEN ولا BLOB_STORE_ID على Vercel — لن تُحفظ الحجوزات",
      );
    }
    blobDiag("FLUSH_SKIP", { reason: "blob_disabled_on_vercel", vercel: Boolean(process.env.VERCEL) });
    return;
  }

  const bookingsToWrite = store().bookings.length;
  const writtenIds = store().bookings.map((b) => b.id);
  blobDiag("FLUSH_START", { dirty: true, bookingsToWrite, writtenIds, storePath: BLOB_STORE_PATH });

  try {
    await writeToBlob(store());
    dirty = false;

    const readBack = await readFromBlobWithRetry(5);
    const readIds = readBack?.bookings.map((b) => b.id) ?? [];
    const persisted = (readBack?.bookings.length ?? 0) >= bookingsToWrite;

    console.log("[blob-store] FLUSH_VERIFY store | wrote:", bookingsToWrite, "| read:", readBack?.bookings.length ?? 0);
    console.log("[blob-store] FLUSH_VERIFY ids | wrote:", writtenIds, "| read:", readIds);

    if (!persisted && writtenIds.length > 0) {
      const lastId = writtenIds[writtenIds.length - 1];
      const viaBookingFile = lastId ? await readBookingFromBlob(lastId) : null;
      console.log(
        "[blob-store] FLUSH_VERIFY booking-file fallback | id:",
        lastId,
        "| found:",
        Boolean(viaBookingFile),
        "| path:",
        lastId ? bookingBlobPath(lastId) : null,
      );
      if (!viaBookingFile) {
        throw new Error(
          `[blob-store] FLUSH_VERIFY failed: store read ${readBack?.bookings.length ?? 0}/${bookingsToWrite}, booking file missing for ${lastId}`,
        );
      }
    }

    blobDiag("FLUSH_VERIFY", {
      writtenBookings: bookingsToWrite,
      readBackBookings: readBack?.bookings.length ?? null,
      persisted,
      storePath: BLOB_STORE_PATH,
      dirtyBookingIds: Array.from(dirtyBookingIds),
    });
    dirtyBookingIds.clear();
  } catch (e) {
    blobDiag("FLUSH_ERROR", { error: e instanceof Error ? e.message : String(e) });
    console.error("تعذّر حفظ التخزين السحابي:", e);
    throw e;
  }
}

function runMaintenance(): void {
  const s = store();
  const retention = s.settings.doorImageRetentionDays ?? 7;
  const purged = purgeExpiredDoorImages(s.bookings, retention);
  if (purged > 0) persist();
}

function addNotification(input: {
  type: NotificationType;
  audience: NotificationAudience;
  title: string;
  body: string;
  booking_id: string | null;
  phone: string | null;
  therapist_id: number | null;
}): AppNotification {
  const notification: AppNotification = {
    id: randomUUID(),
    type: input.type,
    audience: input.audience,
    title: input.title,
    body: input.body,
    booking_id: input.booking_id,
    phone: input.phone,
    therapist_id: input.therapist_id,
    read: false,
    created_at: new Date().toISOString(),
    external_dispatch: {
      channel: input.audience === "customer" ? "whatsapp" : null,
      dispatched: false,
      dispatched_at: null,
    },
  };

  store().notifications.unshift(notification);

  if (input.audience === "customer" && input.phone) {
    void dispatchExternalNotification({
      phone: input.phone,
      message: `${input.title}\n${input.body}`,
      channel: "whatsapp",
    }).then((result) => {
      if (!result.sent) return;
      notification.external_dispatch.dispatched = true;
      notification.external_dispatch.dispatched_at = new Date().toISOString();
      persist();
    });
  }

  return notification;
}

function emitBookingNotifications(
  type: NotificationType,
  booking: BookingWithServices,
  extra?: { delayMinutes?: number },
): void {
  const audiences: NotificationAudience[] =
    type === "delay" || type === "en_route" || type === "arrived" || type === "reminder"
      ? ["customer", "admin", "therapist"]
      : ["customer", "admin"];

  for (const audience of audiences) {
    if (notificationExists(store().notifications, booking.id, type, audience)) continue;
    const { title, body } = buildNotificationContent(type, booking, extra);
    addNotification({
      type,
      audience,
      title,
      body,
      booking_id: booking.id,
      phone: audience === "customer" ? booking.customer_phone : null,
      therapist_id: audience === "therapist" ? booking.therapist_id : null,
    });
  }
}

function ensureReminderNotifications(): void {
  const before = store().notifications.length;
  for (const booking of store().bookings) {
    if (!isBookingDeleted(booking) && !isBookingHidden(booking) && isUpcomingForReminder(booking)) {
      emitBookingNotifications("reminder", booking);
    }
  }
  if (store().notifications.length > before) persist();
}

function persist(): void {
  dirty = true;
  blobDiag("PERSIST", { dirty: true, bookingsCount: store().bookings.length, useBlob: shouldUseBlob() });
  if (!shouldUseBlob()) {
    saveToFile(store());
    if (process.env.VERCEL) {
      console.error(
        "[blob-store] PERSIST_WARNING: على Vercel بدون Blob — الحجوزات في الذاكرة فقط",
      );
    }
  }
}

function promoContext() {
  const s = store();
  return {
    discountCodes: s.discountCodes,
    customerPackages: s.customerPackages,
    balanceGiftCards: s.balanceGiftCards,
    catalog: s.services,
    settings: s.settings,
  };
}

function getLoyaltyRecord(phone: string): CustomerLoyalty {
  const key = normalizePhone(phone);
  let rec = store().loyalty.find((l) => phonesMatch(l.phone, key));
  if (!rec) {
    rec = { phone: key, massage_sessions_completed: 0 };
    store().loyalty.push(rec);
  }
  return rec;
}

function resolvePricing(
  input: {
    cart?: CartItem[];
    serviceSelections?: ServiceSelection[];
    region: Region;
    promo?: PromotionInput;
    phone?: string;
  },
): PricingResult {
  const settings = getSettings();
  const catalog = store().services;
  const addons = store().addons;

  let cart: CartItem[] = asArray(input.cart);
  if (!cart.length && input.serviceSelections?.length) {
    cart = asArray<ServiceSelection>(input.serviceSelections)
      .filter((s) => s.quantity > 0 || (s.people_count ?? 0) > 0)
      .map((s, i) => ({
        lineId: `sel-${i}`,
        serviceId: s.service_id,
        peopleCount: s.people_count ?? s.quantity,
        addonIds: s.addon_ids ?? [],
      }));
  }

  if (!cart.length) {
    return {
      lines: [],
      subtotal: 0,
      regionSurchargeTotal: 0,
      deliveryFee: 0,
      totalPrice: 0,
      totalDuration: 0,
      peopleCount: 0,
      requiresDeposit: false,
    };
  }

  if (!input.promo) {
    return calculateCartPricing(cart, catalog, addons, settings, input.region);
  }

  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  const loyalty = phone ? getLoyaltyRecord(phone) : null;
  const walletBalance = phone ? getWalletBalance(phone) : 0;
  const packages = phone
    ? store().customerPackages.filter((p) => phonesMatch(p.phone, phone) && p.sessions_remaining > 0)
    : [];

  return applyPromotions(
    cart,
    catalog,
    addons,
    settings,
    input.region,
    { ...promoContext(), customerPackages: packages },
    {
      ...input.promo,
      phone,
      massageSessionsCompleted: loyalty?.massage_sessions_completed ?? 0,
      walletBalance,
    },
  );
}

function commitPromotions(booking: BookingWithServices, promo?: PromotionInput, phone?: string) {
  if (!promo) return;
  const key = phone ? normalizePhone(phone) : normalizePhone(booking.customer_phone);

  if (promo.customerPackageId && booking.customer_package_id) {
    const pkg = store().customerPackages.find((p) => p.id === booking.customer_package_id);
    if (pkg && pkg.sessions_remaining > 0) pkg.sessions_remaining -= 1;
  }

  if (promo.discountCode && booking.discount_code) {
    const code = store().discountCodes.find(
      (c) => c.code.toUpperCase() === booking.discount_code!.toUpperCase(),
    );
    if (code) code.used_count += 1;
  }

  if (promo.balanceGiftCode && booking.balance_gift_used) {
    const card = store().balanceGiftCards.find(
      (c) => c.code.toUpperCase() === promo.balanceGiftCode!.toUpperCase(),
    );
    if (card) card.balance_remaining -= booking.balance_gift_used!;
  }

  if (promo.useWallet && booking.wallet_used) {
    addWalletTransaction(key, -booking.wallet_used, `استخدام في حجز #${booking.id.slice(0, 8)}`, booking.id);
  }

  if (key) store().customerNames[key] = booking.customer_name;
}

// ─── الإعدادات والكتالوج ───

export function getSettings(): SalonSettings {
  return { ...store().settings };
}

export function updateSettings(partial: Partial<SalonSettings>): SalonSettings {
  store().settings = { ...store().settings, ...partial };
  persist();
  return getSettings();
}

export function getCatalog(): CatalogService[] {
  return store().services.filter((s) => s.active !== false);
}

export function getAllServicesAdmin(): CatalogService[] {
  return [...store().services];
}

export function updateService(id: string, patch: Partial<CatalogService>): CatalogService | null {
  const s = store().services.find((x) => x.id === id);
  if (!s) return null;
  Object.assign(s, patch);
  persist();
  return { ...s };
}

export function getAddons(): ServiceAddon[] {
  return [...store().addons];
}

export function getTherapists(): Therapist[] {
  return store().therapists.filter((t) => t.active);
}

// ─── الولاء والمحفظة ───

export function getWalletBalance(phone: string): number {
  const key = normalizePhone(phone);
  return store()
    .walletTransactions.filter((t) => phonesMatch(t.phone, key))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function addWalletTransaction(
  phone: string,
  amount: number,
  reason: string,
  bookingId: string | null = null,
): WalletTransaction {
  const tx: WalletTransaction = {
    id: randomUUID(),
    phone: normalizePhone(phone),
    amount,
    reason,
    booking_id: bookingId,
    created_at: new Date().toISOString(),
  };
  store().walletTransactions.push(tx);
  persist();
  return tx;
}

export function getLoyaltyInfo(phone: string) {
  const rec = getLoyaltyRecord(phone);
  const tiers = getSettings().loyaltyTiers ?? [];
  const current = getLoyaltyDiscountPercent(rec.massage_sessions_completed, tiers);
  const next = getNextLoyaltyTier(rec.massage_sessions_completed, tiers);
  return {
    massage_sessions: rec.massage_sessions_completed,
    current_discount_percent: current,
    next_tier: next?.tier ?? null,
    sessions_until_next: next?.sessionsUntil ?? null,
  };
}

export function getCustomerPackages(phone: string): CustomerPackage[] {
  const key = normalizePhone(phone);
  return store().customerPackages.filter(
    (p) => phonesMatch(p.phone, key) && p.sessions_remaining > 0,
  );
}

export function getCustomerAccount(phone: string): CustomerAccount {
  const key = normalizePhone(phone);
  const bookings = store().bookings
    .filter((b) => phonesMatch(b.customer_phone, key) && isBookingVisibleInAdmin(b) && b.status !== "completed")
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  const transactions = store()
    .walletTransactions.filter((t) => phonesMatch(t.phone, key))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    phone: key,
    name: store().customerNames[key] ?? bookings[0]?.customer_name ?? null,
    wallet_balance: getWalletBalance(key),
    loyalty: getLoyaltyInfo(key),
    packages: getCustomerPackages(key),
    bookings,
    transactions,
  };
}

// ─── أكواد الخصم والباقات ───

export function getDiscountCodes(): DiscountCode[] {
  return [...store().discountCodes];
}

export function createDiscountCode(input: Omit<DiscountCode, "id" | "used_count" | "created_at">): DiscountCode {
  const code: DiscountCode = {
    ...input,
    id: randomUUID(),
    used_count: 0,
    created_at: new Date().toISOString(),
    code: input.code.toUpperCase(),
  };
  store().discountCodes.push(code);
  persist();
  return code;
}

export function toggleDiscountCode(id: string, active: boolean): DiscountCode | null {
  const c = store().discountCodes.find((x) => x.id === id);
  if (!c) return null;
  c.active = active;
  persist();
  return c;
}

export function getSessionPackages(): SessionPackage[] {
  return store().sessionPackages.filter((p) => p.active);
}

export function getAllSessionPackagesAdmin(): SessionPackage[] {
  return [...store().sessionPackages];
}

export function purchaseSessionPackage(phone: string, packageId: string): CustomerPackage {
  const pkg = store().sessionPackages.find((p) => p.id === packageId && p.active);
  if (!pkg) throw new Error("الباقة غير موجودة");

  const purchase: CustomerPackage = {
    id: randomUUID(),
    phone: normalizePhone(phone),
    package_id: pkg.id,
    package_name: pkg.name,
    sessions_remaining: pkg.sessions_total,
    sessions_total: pkg.sessions_total,
    purchased_at: new Date().toISOString(),
  };
  store().customerPackages.push(purchase);
  persist();
  return purchase;
}

export function getBalanceGiftCards(): BalanceGiftCard[] {
  return [...store().balanceGiftCards];
}

export function createBalanceGiftCard(input: {
  gifterName: string;
  amount: number;
  recipientPhone?: string;
  recipientName?: string;
  message?: string;
}): BalanceGiftCard {
  const card: BalanceGiftCard = {
    id: randomUUID(),
    code: generateGiftCode(),
    initial_balance: input.amount,
    balance_remaining: input.amount,
    gifter_name: input.gifterName.trim(),
    recipient_phone: input.recipientPhone ? normalizePhone(input.recipientPhone) : null,
    recipient_name: input.recipientName?.trim() ?? null,
    message: input.message?.trim() ?? "",
    active: true,
    created_at: new Date().toISOString(),
  };
  store().balanceGiftCards.push(card);
  persist();
  return card;
}

// ─── الحجوزات ───

function isBookingDeleted(b: { deleted?: boolean }): boolean {
  return b.deleted === true;
}

function isBookingHidden(b: { hidden?: boolean }): boolean {
  return b.hidden === true;
}

function isBookingVisibleInAdmin(b: { deleted?: boolean; hidden?: boolean }): boolean {
  return !isBookingDeleted(b) && !isBookingHidden(b);
}

export type BookingsListScope = "active" | "completed";

function filterBookingsByScope(
  bookings: BookingWithServices[],
  scope: BookingsListScope,
): BookingWithServices[] {
  const visible = bookings.filter((b) => isBookingVisibleInAdmin(b));
  if (scope === "completed") {
    return visible.filter((b) => b.status === "completed");
  }
  return visible.filter((b) => b.status !== "completed");
}

export function getBookingsForSchedule(): BookingForSchedule[] {
  return filterBookingsByScope(store().bookings, "active")
    .map((b) => ({
    id: b.id,
    therapist_id: b.therapist_id,
    schedule_group: b.schedule_group,
    region: b.region,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
    services: b.services,
    deleted: b.deleted,
    hidden: b.hidden,
  }));
}

export function getAllBookings(scope: BookingsListScope = "active"): BookingWithServices[] {
  const catalog = store().services;
  const sorted = filterBookingsByScope(store().bookings, scope).sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  for (const b of sorted) {
    const isHair = b.services?.some(
      (l) => l.service_id.startsWith("hair-") || l.category === "hair",
    );
    if (isHair) logBookingCategorySnapshot("GET/display", b, catalog);
  }
  return sorted;
}

export function getBookingsByPhone(phone: string): BookingWithServices[] {
  return filterBookingsByScope(
    store().bookings.filter((b) => phonesMatch(b.customer_phone, phone)),
    "active",
  );
}

export function createBooking(input: {
  customerName: string;
  customerPhone: string;
  locationUrl: string;
  region: Region;
  doorImageUrl?: string | null;
  customerNotes?: string | null;
  cart?: CartItem[];
  serviceSelections?: ServiceSelection[];
  startTime: string;
  therapistId?: number;
  manual?: boolean;
  promo?: PromotionInput;
}): { booking: BookingWithServices; amountHalala: number } {
  const settings = getSettings();
  const phone = normalizePhone(input.customerPhone);
  const pricing = resolvePricing({
    cart: input.cart,
    serviceSelections: input.serviceSelections,
    region: input.region,
    promo: input.promo,
    phone,
  });

  if (pricing.lines.length === 0 || pricing.totalDuration <= 0) {
    const cartIds = asArray<CartItem>(input.cart).map((c) => c.serviceId);
    console.error("[createBooking] REJECTED empty pricing | cart serviceIds:", cartIds);
    throw new Error("اختيار خدمة واحدة على الأقل — تأكدي أن الخدمة ما زالت متاحة");
  }

  console.log(
    "[createBooking] pricing OK | services:",
    pricing.lines.map((l) => l.service_id),
    "| duration:",
    pricing.totalDuration,
    "| deposit:",
    pricing.requiresDeposit,
  );

  const finalPrice = pricing.finalTotal ?? pricing.totalPrice;
  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) throw new Error("وقت غير صالح");

  const end = calculateEndTime(start, pricing.totalDuration);
  const catalog = store().services;
  const cart = asArray<CartItem>(input.cart);
  const scheduleGroup = cart.length
    ? resolveScheduleGroupFromCart(cart, catalog)
    : resolveScheduleGroupFromCart(
        asArray<ServiceSelection>(input.serviceSelections).map((s, i) => ({
          lineId: `sel-${i}`,
          serviceId: s.service_id,
          peopleCount: s.people_count ?? s.quantity,
          addonIds: s.addon_ids ?? [],
        })),
        catalog,
      );
  const therapistId = SCHEDULE_GROUP_THERAPIST[scheduleGroup];
  const allBookings = getBookingsForSchedule();
  const existing = bookingsForScheduleGroup(allBookings, scheduleGroup, catalog);

  const therapistBookings = bookingsForTherapist(existing, therapistId);
  if (
    !isSlotValidForTherapist(start, end, input.region, therapistBookings, settings.prepTimeMinutes)
  ) {
    throw new Error("الوقت المختار لم يعد متاحاً — جرّبي وقتاً آخر");
  }

  const status: BookingStatus = "confirmed";
  const paymentStatus: PaymentStatus = "paid";
  const adj = pricing.adjustments;

  const booking: BookingWithServices = {
    id: randomUUID(),
    customer_name: input.customerName.trim(),
    customer_phone: phone,
    location_url: input.locationUrl.trim(),
    region: input.region,
    door_image_url: input.doorImageUrl ?? null,
    customer_notes: input.customerNotes?.trim() || null,
    therapist_id: therapistId,
    schedule_group: scheduleGroup,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    total_duration: pricing.totalDuration,
    subtotal: pricing.subtotal,
    region_surcharge_total: pricing.regionSurchargeTotal,
    delivery_fee: pricing.deliveryFee,
    total_price: pricing.totalPrice,
    final_price: finalPrice,
    people_count: pricing.peopleCount,
    status,
    payment_status: paymentStatus,
    requires_deposit: false,
    moyasar_payment_id: null,
    created_at: new Date().toISOString(),
    booking_type: "self",
    services: pricing.lines,
    discount_code: adj?.discountCodeLabel ?? null,
    loyalty_discount: adj?.loyaltyDiscount ?? 0,
    package_discount: adj?.packageDiscount ?? 0,
    wallet_used: adj?.walletUsed ?? 0,
    balance_gift_used: adj?.balanceGiftUsed ?? 0,
    customer_package_id: adj?.packageUsedId ?? null,
    visit_status: "scheduled",
    visit_timeline: {},
    rating_id: null,
  };

  commitPromotions(booking, input.promo, phone);
  store().bookings.push(booking);
  trackBookingId(booking.id);
  markBookingDirty(booking.id);
  logBookingCategorySnapshot("SAVE/create", booking, store().services);
  emitBookingNotifications("booking_confirmed", booking);
  persist();
  console.log("[createBooking] SAVED id:", booking.id, "| blob booking path:", bookingBlobPath(booking.id));
  return { booking, amountHalala: Math.round(finalPrice * 100) };
}

export function getSlotsForSelections(
  region: Region,
  input: { cart?: CartItem[]; serviceSelections?: ServiceSelection[]; promo?: PromotionInput; phone?: string },
) {
  const settings = getSettings();
  const catalog = store().services;
  const pricing = resolvePricing({ ...input, region });
  const cart = asArray<CartItem>(input.cart);
  const scheduleGroup = cart.length
    ? resolveScheduleGroupFromCart(cart, catalog)
    : resolveScheduleGroupFromCart(
        asArray<ServiceSelection>(input.serviceSelections).map((s, i) => ({
          lineId: `sel-${i}`,
          serviceId: s.service_id,
          peopleCount: s.people_count ?? s.quantity,
          addonIds: s.addon_ids ?? [],
        })),
        catalog,
      );
  const therapistId = SCHEDULE_GROUP_THERAPIST[scheduleGroup];
  const allBookings = getBookingsForSchedule();
  const existing = bookingsForScheduleGroup(allBookings, scheduleGroup, catalog);
  const rawSlots = getAvailableSlots(
    existing,
    region,
    pricing.totalDuration,
    settings,
    new Date(),
    therapistId,
  );

  return {
    slots: rawSlots,
    scheduleGroup,
    totalDuration: pricing.totalDuration,
    totalPrice: pricing.finalTotal ?? pricing.totalPrice,
    subtotal: pricing.subtotal,
    deliveryFee: pricing.deliveryFee,
    regionSurchargeTotal: pricing.regionSurchargeTotal,
    peopleCount: pricing.peopleCount,
    requiresDeposit: pricing.requiresDeposit,
    adjustments: pricing.adjustments,
  };
}

/** أوقات يوم محدّد لخدمة واحدة (تقويم مستقل + مدة تشمل المرافقات) */
export function getSlotsForCartItem(region: Region, item: CartItem, dateKey: string) {
  const settings = getSettings();
  const catalog = store().services;
  const addons = store().addons;
  const service = catalog.find((s) => s.id === item.serviceId && s.active !== false);
  if (!service) throw new Error("الخدمة غير موجودة");

  const duration = computeCartItemDuration(item, service, addons);
  const scheduleGroup = resolveScheduleGroupFromCart([item], catalog);
  const therapistId = SCHEDULE_GROUP_THERAPIST[scheduleGroup];
  const existing = bookingsForScheduleGroup(getBookingsForSchedule(), scheduleGroup, catalog);
  const day = parseRiyadhDateKey(dateKey);
  const rawSlots = getAvailableSlotsForDay(
    existing,
    region,
    duration,
    settings,
    day,
    therapistId,
  );
  const pricing = calculateCartPricing([item], catalog, addons, settings, region);

  return {
    slots: rawSlots,
    scheduleGroup,
    totalDuration: duration,
    totalPrice: pricing.finalTotal ?? pricing.totalPrice,
    subtotal: pricing.subtotal,
    deliveryFee: pricing.deliveryFee,
    regionSurchargeTotal: pricing.regionSurchargeTotal,
    peopleCount: pricing.peopleCount,
    requiresDeposit: false,
  };
}

export function previewCart(
  cart: CartItem[],
  region?: Region,
  promo?: PromotionInput,
  phone?: string,
): PricingResult {
  if (!cart.length) {
    return {
      lines: [],
      subtotal: 0,
      regionSurchargeTotal: 0,
      deliveryFee: 0,
      totalPrice: 0,
      totalDuration: 0,
      peopleCount: 0,
      requiresDeposit: false,
    };
  }
  if (!region) {
    const settings = getSettings();
    return calculateCartPricing(cart, store().services, store().addons, settings, undefined);
  }
  return resolvePricing({ cart, region, promo, phone });
}

export function updateBookingStatus(id: string, status: BookingStatus): Booking | null {
  const b = store().bookings.find((x) => x.id === id);
  if (!b) return null;
  const prev = b.status;
  b.status = status;

  const settings = getSettings();

  if (status === "completed" && prev !== "completed") {
    const massageCount = b.services.filter((l) => l.service_id.startsWith("massage-")).length;
    if (massageCount > 0) {
      const rec = getLoyaltyRecord(b.customer_phone);
      rec.massage_sessions_completed += massageCount;
    }
    emitBookingNotifications("service_finished", b);
    emitBookingNotifications("rating_request", b);
  }

  if (status === "confirmed" && prev !== "confirmed") {
    emitBookingNotifications("booking_confirmed", b);
  }

  if (status === "cancelled" && prev !== "cancelled") {
    const creditBase = b.final_price ?? b.total_price;
    const credit = Math.round((creditBase * settings.cancellationCreditPercent) / 100);
    if (credit > 0) {
      addWalletTransaction(
        b.customer_phone,
        credit,
        `رصيد من إلغاء حجز #${b.id.slice(0, 8)}`,
        b.id,
      );
    }
    if (b.customer_package_id) {
      const pkg = store().customerPackages.find((p) => p.id === b.customer_package_id);
      if (pkg && pkg.sessions_remaining < pkg.sessions_total) {
        pkg.sessions_remaining += 1;
      }
    }
  }

  persist();
  return b;
}

/** إخفاء حجز من لوحة الإدارة — hidden=true ثم persist (نفس آلية الحفظ الناجحة) */
export function hideBooking(id: string): BookingWithServices | null {
  const key = id?.trim();
  if (!key) return null;

  const b = store().bookings.find((x) => x.id === key);
  if (!b) return null;
  if (isBookingHidden(b)) return b;

  b.hidden = true;
  console.log("[hideBooking] hidden=true | id:", key);
  persist();
  return b;
}

/** حذف منطقي — يُعلَّم الحجز deleted=true ويُحفظ عبر put */
export async function deleteBooking(id: string): Promise<boolean> {
  const key = id?.trim();
  if (!key) return false;

  const s = store();
  const booking = s.bookings.find((b) => b.id === key);
  if (!booking) return false;
  if (isBookingDeleted(booking)) return true;

  booking.deleted = true;
  console.log("[deleteBooking] soft delete | id:", key);

  persist();

  if (shouldUseBlob()) {
    try {
      const putResult = await writeToBlob(s, { skipBookingFiles: true });
      dirty = false;
      console.log(
        "[deleteBooking] OK blob | id:",
        key,
        "| pathname:",
        putResult.pathname,
        "| deleted=true",
      );
    } catch (e) {
      booking.deleted = false;
      console.error("[deleteBooking] ERROR | id:", key, "|", formatBlobError(e));
      throw e;
    }
  } else {
    saveToFile(s);
    dirty = false;
    console.log("[deleteBooking] OK file | id:", key, "| deleted=true");
  }

  return true;
}

export function updateVisitStatus(
  id: string,
  action: "en_route" | "arrived" | "service_started" | "finished",
): BookingWithServices | null {
  const b = store().bookings.find((x) => x.id === id);
  if (!b) return null;

  const now = new Date().toISOString();
  if (!b.visit_timeline) b.visit_timeline = {};

  const map: Record<typeof action, VisitStatus> = {
    en_route: "en_route",
    arrived: "arrived",
    service_started: "service_started",
    finished: "finished",
  };

  b.visit_status = map[action];
  if (action === "en_route") {
    b.visit_timeline.en_route_at = now;
    if (b.status === "confirmed" || b.status === "awaiting_deposit" || b.status === "new") {
      b.status = "in_progress";
    }
    emitBookingNotifications("en_route", b);
  }
  if (action === "arrived") {
    b.visit_timeline.arrived_at = now;
    emitBookingNotifications("arrived", b);
    const delay = computeDelayMinutes(b);
    if (delay !== null) {
      emitBookingNotifications("delay", b, { delayMinutes: delay });
    }
  }
  if (action === "service_started") b.visit_timeline.service_started_at = now;
  if (action === "finished") {
    b.visit_timeline.finished_at = now;
    updateBookingStatus(id, "completed");
  }

  persist();
  return b;
}

export function rescheduleBooking(
  id: string,
  startTime: string,
  therapistId?: number,
): BookingWithServices | null {
  const b = store().bookings.find((x) => x.id === id);
  if (!b) return null;

  const settings = getSettings();
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new Error("وقت غير صالح");

  const end = calculateEndTime(start, b.total_duration);
  const catalog = store().services;
  const scheduleGroup =
    b.schedule_group ??
    resolveScheduleGroupFromCart(
      b.services.map((line, i) => ({
        lineId: `b-${i}`,
        serviceId: line.service_id,
        peopleCount: line.people_count ?? line.quantity,
        addonIds: [],
      })),
      catalog,
    );
  const tid = SCHEDULE_GROUP_THERAPIST[scheduleGroup];
  const existing = bookingsForScheduleGroup(
    getBookingsForSchedule().filter((x) => x.id !== id),
    scheduleGroup,
    catalog,
  );

  if (
    !isSlotValidForTherapist(
      start,
      end,
      b.region,
      bookingsForTherapist(existing, tid),
      settings.prepTimeMinutes,
      id,
    )
  ) {
    throw new Error("الوقت الجديد غير متاح");
  }

  b.start_time = start.toISOString();
  b.end_time = end.toISOString();
  b.therapist_id = tid;
  b.schedule_group = scheduleGroup;
  b.visit_status = "scheduled";
  b.visit_timeline = {};
  persist();
  return b;
}

export function transferTherapist(id: string, therapistId: number): BookingWithServices | null {
  const b = store().bookings.find((x) => x.id === id);
  if (!b) return null;
  b.therapist_id = therapistId;
  persist();
  return b;
}

export function submitRating(
  bookingId: string,
  phone: string,
  stars: number,
  comment: string,
): BookingRating {
  const b = store().bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error("الحجز غير موجود");
  if (b.status !== "completed") throw new Error("التقييم متاح بعد إتمام الخدمة");
  if (!phonesMatch(b.customer_phone, phone)) throw new Error("غير مصرّح");
  if (b.rating_id) throw new Error("تم التقييم مسبقاً");
  if (stars < 1 || stars > 5) throw new Error("التقييم من ١ إلى ٥");

  const rating: BookingRating = {
    id: randomUUID(),
    booking_id: bookingId,
    customer_phone: normalizePhone(phone),
    stars,
    comment: comment.trim(),
    created_at: new Date().toISOString(),
  };
  store().ratings.push(rating);
  b.rating_id = rating.id;
  persist();
  return rating;
}

export function getRatings(): BookingRating[] {
  return [...store().ratings];
}

export function getRatingForBooking(bookingId: string): BookingRating | null {
  return store().ratings.find((r) => r.booking_id === bookingId) ?? null;
}

export function getReportsSummary(): ReportsSummary {
  return buildReports(
    filterBookingsByScope(store().bookings, "active"),
    store().ratings,
    store().therapists,
  );
}

export function getTherapistTodayBookings(therapistId: number): BookingWithServices[] {
  return getBookingsForTherapistToday(
    filterBookingsByScope(store().bookings, "active"),
    therapistId,
  );
}

// ─── الإشعارات ───

export function getNotifications(filter: {
  audience: NotificationAudience;
  phone?: string;
  therapistId?: number;
}): AppNotification[] {
  ensureReminderNotifications();
  const list = store().notifications.filter((n) => {
    if (n.audience !== filter.audience) return false;
    if (filter.audience === "customer" && filter.phone) {
      return phonesMatch(n.phone ?? "", filter.phone);
    }
    if (filter.audience === "therapist" && filter.therapistId) {
      return n.therapist_id === filter.therapistId;
    }
    return true;
  });
  return list.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getUnreadNotificationCount(filter: {
  audience: NotificationAudience;
  phone?: string;
  therapistId?: number;
}): number {
  return getNotifications(filter).filter((n) => !n.read).length;
}

export function markNotificationRead(id: string): AppNotification | null {
  const n = store().notifications.find((x) => x.id === id);
  if (!n) return null;
  n.read = true;
  persist();
  return n;
}

export function markAllNotificationsRead(filter: {
  audience: NotificationAudience;
  phone?: string;
  therapistId?: number;
}): number {
  let count = 0;
  for (const n of store().notifications) {
    if (n.audience !== filter.audience) continue;
    if (filter.audience === "customer" && filter.phone && !phonesMatch(n.phone ?? "", filter.phone)) {
      continue;
    }
    if (
      filter.audience === "therapist" &&
      filter.therapistId &&
      n.therapist_id !== filter.therapistId
    ) {
      continue;
    }
    if (!n.read) {
      n.read = true;
      count += 1;
    }
  }
  if (count > 0) persist();
  return count;
}

export function getBookingById(id: string): BookingWithServices | null {
  const key = id?.trim();
  if (!key) return null;
  return store().bookings.find((b) => b.id === key) ?? null;
}

/** إعادة تحميل من Blob والبحث عن حجز — ملف المتجر الكامل */
async function reloadBookingFromBlob(id: string): Promise<BookingWithServices | null> {
  const key = id.trim();
  console.log("[reloadBookingFromBlob] START | id:", key, "| store path:", BLOB_STORE_PATH);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 150 * attempt));
    }
    const data = await readFromBlob();
    if (data) {
      globalRef().__softStore = data;
      const found = store().bookings.find((b) => b.id === key);
      if (found) {
        console.log("[reloadBookingFromBlob] FOUND in store | id:", key, "| attempt:", attempt);
        return found;
      }
    }
  }
  console.log("[reloadBookingFromBlob] NOT in store | id:", key);
  return null;
}

function trackBookingId(id: string): void {
  const s = store();
  if (!s.bookingIndex) s.bookingIndex = s.bookings.map((b) => b.id);
  if (!s.bookingIndex.includes(id)) s.bookingIndex.push(id);
}

function mergeBookingIntoStore(booking: BookingWithServices): BookingWithServices {
  const existing = store().bookings.find((b) => b.id === booking.id);
  if (existing) return existing;
  store().bookings.push(booking);
  trackBookingId(booking.id);
  persist();
  console.log("[mergeBookingIntoStore] merged id:", booking.id);
  return booking;
}

export async function confirmDemoPayment(id: string): Promise<BookingWithServices | null> {
  const key = id?.trim();
  console.log("[confirmDemoPayment] START | id:", key);

  if (!key) {
    console.error("[confirmDemoPayment] empty id");
    return null;
  }

  let b = getBookingById(key);
  console.log("[confirmDemoPayment] memory:", b ? "FOUND" : "NOT FOUND", "| ids in memory:", store().bookings.map((x) => x.id));

  if (!b && shouldUseBlob()) {
    b = await readBookingFromBlob(key);
    console.log(
      "[confirmDemoPayment] booking blob file:",
      b ? "FOUND" : "NOT FOUND",
      "| path:",
      bookingBlobPath(key),
    );
    if (b) {
      b = mergeBookingIntoStore(b);
    }
  }

  if (!b && shouldUseBlob()) {
    console.log("[confirmDemoPayment] fallback reload store | path:", BLOB_STORE_PATH);
    b = await reloadBookingFromBlob(key);
  }

  if (!b) {
    console.error(
      "[confirmDemoPayment] NOT FOUND | id:",
      key,
      "| store path:",
      BLOB_STORE_PATH,
      "| booking path:",
      bookingBlobPath(key),
      "| memory ids:",
      store().bookings.map((x) => x.id),
    );
    return null;
  }

  console.log("[confirmDemoPayment] CONFIRMING id:", b.id, "| status before:", b.status);

  if (b.requires_deposit) {
    b.payment_status = "deposit_pending";
    b.status = "awaiting_deposit";
    emitBookingNotifications("deposit_payment", b);
  } else {
    b.payment_status = "paid";
    b.status = "confirmed";
    emitBookingNotifications("booking_confirmed", b);
  }
  b.moyasar_payment_id = "demo-local";
  markBookingDirty(b.id);
  persist();
  console.log("[confirmDemoPayment] DONE id:", b.id, "| status after:", b.status);
  return b;
}

// ─── الإهداءات ───

export function getAllGifts(): GiftCard[] {
  return [...store().gifts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function createGift(input: {
  gifterName: string;
  gifterPhone: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  occasionDate?: string | null;
  cart?: CartItem[];
  serviceSelections?: ServiceSelection[];
}): { gift: GiftCard; amountHalala: number } {
  const pricing = resolvePricing({
    cart: input.cart,
    serviceSelections: input.serviceSelections,
    region: "north",
  });
  if (pricing.lines.length === 0) throw new Error("اختيار خدمة واحدة على الأقل");

  const gift: GiftCard = {
    id: randomUUID(),
    gifter_name: input.gifterName.trim(),
    gifter_phone: input.gifterPhone.trim(),
    recipient_name: input.recipientName.trim(),
    recipient_phone: input.recipientPhone.trim(),
    message: input.message.trim(),
    occasion_date: input.occasionDate?.trim() || null,
    services: pricing.lines,
    total_price: pricing.subtotal,
    payment_status: "pending",
    created_at: new Date().toISOString(),
    sent_at: null,
  };

  store().gifts.push(gift);
  persist();
  return { gift, amountHalala: Math.round(pricing.subtotal * 100) };
}

export function confirmGiftPayment(id: string): GiftCard | null {
  const g = store().gifts.find((x) => x.id === id);
  if (!g) return null;
  g.payment_status = "paid" as GiftPaymentStatus;
  persist();
  return g;
}

export function markGiftSent(id: string): GiftCard | null {
  const g = store().gifts.find((x) => x.id === id);
  if (!g) return null;
  g.sent_at = new Date().toISOString();
  persist();
  return g;
}

export function getServices(): CatalogService[] {
  return getCatalog();
}

export type { PromotionInput };
