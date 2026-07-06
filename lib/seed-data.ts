/**
 * بيانات افتراضية لـ سوفت مومنت — قابلة للتعديل من الإدارة
 */

import type { CatalogService, DiscountCode, Region, SalonSettings, ServiceAddon, SessionPackage, Therapist } from "./types";
import { DEFAULT_LOYALTY_TIERS } from "./loyalty";

export const DEFAULT_SETTINGS: SalonSettings = {
  brandName: "Soft Moments",
  tagline: "لحظة هدوء وجمال في بيتكِ",
  logoUrl: null,
  heroImageUrl: null,
  deliveryFee: 50,
  prepTimeMinutes: 15,
  businessStartHour: 14,
  businessEndHour: 24,
  slotIntervalMinutes: 15,
  daysAhead: 14,
  therapistCount: 3,
  makeupRegionSurcharge: 200,
  hairRegionSurcharge: 100,
  makeupSurchargeRegions: ["south", "east", "west"] as Region[],
  hairSurchargeRegions: ["south", "east", "west"] as Region[],
  depositNote: "",
  loyaltyTiers: DEFAULT_LOYALTY_TIERS,
  cancellationCreditPercent: 50,
  doorImageRetentionDays: 7,
};

export const DEFAULT_DISCOUNT_CODES: DiscountCode[] = [
  {
    id: "dc-welcome",
    code: "WELCOME10",
    type: "percent",
    value: 10,
    active: true,
    expires_at: null,
    max_uses: 100,
    used_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "dc-pink50",
    code: "PINK50",
    type: "fixed",
    value: 50,
    active: true,
    expires_at: null,
    max_uses: null,
    used_count: 0,
    created_at: new Date().toISOString(),
  },
];

export const DEFAULT_SESSION_PACKAGES: SessionPackage[] = [
  {
    id: "pkg-massage-5",
    name: "باقة ٥ جلسات مساج",
    description: "وفرّي ١٥٠ ر.س — جلسة تُخصم تلقائياً كل حجز",
    service_category: "massage",
    service_ids: ["massage-swedish", "massage-relax"],
    sessions_total: 5,
    price: 1100,
    active: true,
  },
];

export const DEFAULT_THERAPISTS: Therapist[] = [
  { id: 1, name: "خلود الهداب", active: true },
  { id: 2, name: "سارة الهداب", active: true },
  { id: 3, name: "أظافر ومساج", active: true },
];

export const DEFAULT_ADDONS: ServiceAddon[] = [
  { id: "addon-hot-stones", name: "أحجار ساخنة", price: 50, duration_minutes: 15, categories: ["massage"] },
  { id: "addon-cupping", name: "كاسات حجامة", price: 40, duration_minutes: 15, categories: ["massage"] },
  { id: "addon-thermal", name: "سرير حراري", price: 30, duration_minutes: 0, categories: ["massage"] },
];

export const DEFAULT_SERVICES: CatalogService[] = [
  { id: "nail-manicure", category: "nails", schedule_group: "nails-massage", name: "منيكير", pricing_model: "fixed", price: 80, duration_minutes: 30, active: true },
  { id: "nail-pedicure", category: "nails", schedule_group: "nails-massage", name: "بديكير", pricing_model: "fixed", price: 90, duration_minutes: 30, active: true },
  { id: "nail-both", category: "nails", schedule_group: "nails-massage", name: "بديكير منيكير", pricing_model: "fixed", price: 150, duration_minutes: 60, active: true },
  { id: "nail-color-basic", category: "nails", schedule_group: "nails-massage", name: "لون عادي", pricing_model: "fixed", price: 60, duration_minutes: 20, active: true },
  { id: "nail-color-ombre", category: "nails", schedule_group: "nails-massage", name: "لون أمبريه", pricing_model: "fixed", price: 200, duration_minutes: 30, active: true },

  {
    id: "massage-swedish",
    category: "massage",
    schedule_group: "nails-massage",
    name: "مساج سويدي",
    pricing_model: "fixed",
    price: 250,
    duration_minutes: 60,
    optional_addons: true,
    active: true,
  },
  {
    id: "massage-relax",
    category: "massage",
    schedule_group: "nails-massage",
    name: "مساج استرخاء",
    pricing_model: "fixed",
    price: 250,
    duration_minutes: 60,
    optional_addons: true,
    active: true,
  },

  {
    id: "makeup-bride",
    category: "makeup",
    schedule_group: "khulood",
    name: "عروس",
    artist: "خلود الهداب",
    instagram: "makeup_alhddab",
    pricing_model: "fixed",
    price: 1800,
    duration_minutes: 120,
    region_surcharge: "makeup",
    notes: "الأسعار مكياج فقط — الشعر عند الطلب",
    active: true,
  },
  {
    id: "makeup-bride-hair",
    category: "makeup",
    schedule_group: "khulood",
    name: "بكج عروس (مكياج + شعر)",
    artist: "خلود الهداب",
    instagram: "makeup_alhddab",
    pricing_model: "bundle",
    bundle_price: 2300,
    duration_minutes: 180,
    bundle_includes: ["مكياج عروس", "شعر عروس (شبكة)"],
    region_surcharge: "makeup",
    active: true,
  },
  {
    id: "makeup-bride-full",
    category: "makeup",
    schedule_group: "khulood",
    name: "بكج عروس شامل (مكياج + شعر + بديكير ومنيكير)",
    artist: "خلود الهداب",
    instagram: "makeup_alhddab",
    pricing_model: "bundle",
    bundle_price: 2550,
    duration_minutes: 240,
    bundle_includes: ["مكياج عروس", "شعر عروس", "بديكير ومنيكير"],
    region_surcharge: "makeup",
    active: true,
  },
  {
    id: "makeup-evening",
    category: "makeup",
    schedule_group: "khulood",
    name: "سهرة",
    artist: "خلود الهداب",
    instagram: "makeup_alhddab",
    pricing_model: "tiered_people",
    duration_minutes: 60,
    tiered_prices: [
      { minPeople: 1, maxPeople: 1, pricePerPerson: 900 },
      { minPeople: 2, maxPeople: 2, pricePerPerson: 700 },
      { minPeople: 3, maxPeople: null, pricePerPerson: 600 },
    ],
    region_surcharge: "makeup",
    notes: "السعر للشخص — يتغيّر حسب العدد",
    active: true,
  },

  {
    id: "hair-bride",
    category: "hair",
    schedule_group: "sarah",
    name: "عروس / شبكة",
    artist: "سارة الهداب",
    instagram: "hairstylest_sk",
    pricing_model: "fixed",
    price: 800,
    duration_minutes: 90,
    region_surcharge: "hair",
    notes: "السعر يختلف بالعمر وطول الشعر — التأكيد النهائي مع الأرتست",
    active: true,
  },
  {
    id: "hair-evening",
    category: "hair",
    schedule_group: "sarah",
    name: "سهرة",
    artist: "سارة الهداب",
    instagram: "hairstylest_sk",
    pricing_model: "tiered_people",
    duration_minutes: 45,
    tiered_prices: [
      { minPeople: 1, maxPeople: 1, pricePerPerson: 600 },
      { minPeople: 2, maxPeople: 2, pricePerPerson: 500 },
      { minPeople: 3, maxPeople: null, pricePerPerson: 450 },
    ],
    region_surcharge: "hair",
    notes: "الإكستنشن لا يُوصل — يُشتغل عليه إن كان مركّباً بسعر مختلف",
    active: true,
  },
];
