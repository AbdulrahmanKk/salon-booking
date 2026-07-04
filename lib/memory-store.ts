/**
 * تخزين سوفت مومنت — ذاكرة + ملف محلي
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { list, put } from "@vercel/blob";
import { join } from "path";
import { randomUUID } from "crypto";
import { asArray } from "./arrays";
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
  isSlotValidForTherapist,
  bookingsForTherapist,
} from "./scheduling";
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
    gifts: asArray(parsed.gifts),
    bookings: asArray(parsed.bookings),
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

// ─── التخزين: Vercel Blob (سحابة) + ملف محلي (للتطوير) ───
//
// على Vercel: البيانات تُحفظ في Vercel Blob (نظام ملفات القرص للقراءة فقط).
// محلياً (بدون توكن): تُحفظ في data/soft-touch.json كما كانت.
//
// دورة الحياة لكل طلب API:
//   initStore()  → يحمّل أحدث نسخة قبل المعالجة
//   ...المعالجة (store()/persist() متزامنة كما هي)...
//   flushStore() → يحفظ التغييرات في السحابة إن وُجدت

const BLOB_PATH = "soft-moment/store.json";
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

interface GlobalStore {
  __softStore?: MemoryStore;
  __softStoreBlobUrl?: string | null;
}

function globalRef(): typeof globalThis & GlobalStore {
  return globalThis as typeof globalThis & GlobalStore;
}

let dirty = false;

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

async function readFromBlob(): Promise<StoreData | null> {
  try {
    const g = globalRef();
    let url = g.__softStoreBlobUrl ?? null;
    if (!url) {
      const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
      url = blobs[0]?.url ?? null;
      g.__softStoreBlobUrl = url;
    }
    if (!url) return null;
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return migrateStore((await res.json()) as Partial<StoreData>);
  } catch (e) {
    console.warn("تعذّر قراءة التخزين السحابي:", e);
    return null;
  }
}

async function writeToBlob(data: StoreData): Promise<void> {
  const { url } = await put(BLOB_PATH, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  globalRef().__softStoreBlobUrl = url;
}

function store(): MemoryStore {
  const g = globalRef();
  if (!g.__softStore) {
    g.__softStore = (useBlob ? null : loadFromFile()) ?? defaultStore();
  }
  return g.__softStore;
}

/** يُستدعى في بداية كل مسار API — يحمّل أحدث بيانات قبل المعالجة */
export async function initStore(): Promise<void> {
  const g = globalRef();
  if (useBlob) {
    const data = await readFromBlob();
    g.__softStore = data ?? g.__softStore ?? defaultStore();
  } else if (!g.__softStore) {
    g.__softStore = loadFromFile() ?? defaultStore();
  }
  runMaintenance();
}

/** يُستدعى في نهاية كل مسار API — يحفظ التغييرات في السحابة إن وُجدت */
export async function flushStore(): Promise<void> {
  if (!dirty) return;
  dirty = false;
  if (useBlob) {
    try {
      await writeToBlob(store());
    } catch (e) {
      dirty = true;
      console.error("تعذّر حفظ التخزين السحابي:", e);
      throw e;
    }
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
    if (isUpcomingForReminder(booking)) {
      emitBookingNotifications("reminder", booking);
    }
  }
  if (store().notifications.length > before) persist();
}

function persist(): void {
  dirty = true;
  if (!useBlob) saveToFile(store());
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
    .filter((b) => phonesMatch(b.customer_phone, key))
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

export function getBookingsForSchedule(): BookingForSchedule[] {
  return store().bookings.map((b) => ({
    id: b.id,
    therapist_id: b.therapist_id,
    region: b.region,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
  }));
}

export function getAllBookings(): BookingWithServices[] {
  return [...store().bookings].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
}

export function getBookingsByPhone(phone: string): BookingWithServices[] {
  return store().bookings.filter((b) => phonesMatch(b.customer_phone, phone));
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
    throw new Error("اختيار خدمة واحدة على الأقل");
  }

  const finalPrice = pricing.finalTotal ?? pricing.totalPrice;
  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) throw new Error("وقت غير صالح");

  const end = calculateEndTime(start, pricing.totalDuration);
  const existing = getBookingsForSchedule();

  let therapistId = input.therapistId;
  if (!therapistId) {
    therapistId = findAvailableTherapist(start, end, input.region, existing, settings) ?? undefined;
  }
  if (!therapistId) throw new Error("الوقت المختار لم يعد متاحاً");

  const therapistBookings = bookingsForTherapist(existing, therapistId);
  if (
    !isSlotValidForTherapist(start, end, input.region, therapistBookings, settings.prepTimeMinutes)
  ) {
    throw new Error("الوقت المختار لم يعد متاحاً — جرّبي وقتاً آخر");
  }

  const requiresDeposit = pricing.requiresDeposit;
  const status: BookingStatus = input.manual
    ? requiresDeposit ? "awaiting_deposit" : "confirmed"
    : "new";
  const paymentStatus: PaymentStatus = requiresDeposit ? "deposit_pending" : "pending";
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
    requires_deposit: requiresDeposit,
    moyasar_payment_id: input.manual ? "manual-admin" : null,
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
  if (status === "confirmed") {
    emitBookingNotifications("booking_confirmed", booking);
  } else {
    emitBookingNotifications("deposit_payment", booking);
  }
  persist();
  return { booking, amountHalala: Math.round(finalPrice * 100) };
}

export function getSlotsForSelections(
  region: Region,
  input: { cart?: CartItem[]; serviceSelections?: ServiceSelection[]; promo?: PromotionInput; phone?: string },
) {
  const settings = getSettings();
  const pricing = resolvePricing({ ...input, region });
  const existing = getBookingsForSchedule();
  const rawSlots = getAvailableSlots(existing, region, pricing.totalDuration, settings);

  return {
    slots: rawSlots,
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
  const existing = getBookingsForSchedule().filter((x) => x.id !== id);

  let tid = therapistId ?? b.therapist_id;
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
    tid = findAvailableTherapist(start, end, b.region, existing, settings, id) ?? tid;
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
  }

  b.start_time = start.toISOString();
  b.end_time = end.toISOString();
  b.therapist_id = tid;
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
  return buildReports(store().bookings, store().ratings, store().therapists);
}

export function getTherapistTodayBookings(therapistId: number): BookingWithServices[] {
  return getBookingsForTherapistToday(store().bookings, therapistId);
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

export function confirmDemoPayment(id: string): BookingWithServices | null {
  const b = store().bookings.find((x) => x.id === id);
  if (!b) return null;
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
  persist();
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
