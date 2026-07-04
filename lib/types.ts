/**
 * أنواع سوفت مومنت — نظام تشغيل الصالون المنزلي
 */

import { asArray } from "./arrays";

export type Region = "north" | "south" | "east" | "west";

export type ServiceCategory = "nails" | "massage" | "makeup" | "hair";

export type PricingModel = "fixed" | "tiered_people" | "bundle" | "custom";

export type BookingStatus =
  | "new"
  | "awaiting_deposit"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "deposit_pending";

export type GiftPaymentStatus = "pending" | "paid" | "failed";

export interface PriceTier {
  minPeople: number;
  maxPeople: number | null;
  pricePerPerson: number;
}

export interface ServiceAddon {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  /** فئات الخدمات المسموح إضافتها لها */
  categories: ServiceCategory[];
}

export interface CatalogService {
  id: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  artist?: string;
  instagram?: string;
  pricing_model: PricingModel;
  /** سعر ثابت */
  price?: number;
  duration_minutes: number;
  /** شرائح السعر حسب عدد الأشخاص */
  tiered_prices?: PriceTier[];
  /** سعر الباقة */
  bundle_price?: number;
  /** خدمات ضمن الباقة (للعرض) */
  bundle_includes?: string[];
  /** يتطلب عربون */
  requires_deposit?: boolean;
  /** نوع زيادة المنطقة */
  region_surcharge?: "makeup" | "hair" | null;
  /** خيارات إضافية */
  optional_addons?: boolean;
  notes?: string;
  active?: boolean;
}

export interface ServiceSelection {
  service_id: string;
  quantity: number;
  people_count?: number;
  addon_ids?: string[];
}

export interface ServiceLine {
  service_id: string;
  quantity: number;
  people_count: number;
  name: string;
  price: number;
  duration_minutes: number;
  addon_names?: string[];
  region_surcharge?: number;
}

export interface CartItem {
  lineId: string;
  serviceId: string;
  peopleCount: number;
  addonIds: string[];
}

export interface SalonSettings {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  deliveryFee: number;
  prepTimeMinutes: number;
  businessStartHour: number;
  businessEndHour: number;
  slotIntervalMinutes: number;
  daysAhead: number;
  therapistCount: number;
  makeupRegionSurcharge: number;
  hairRegionSurcharge: number;
  makeupSurchargeRegions: Region[];
  hairSurchargeRegions: Region[];
  depositNote: string;
  /** شرائح ولاء المساج */
  loyaltyTiers: LoyaltyTier[];
  /** رصيد يُضاف عند الإلغاء (نسبة من المبلغ) */
  cancellationCreditPercent: number;
  /** حذف صور الأبواب بعد انتهاء الموعد (أيام) */
  doorImageRetentionDays: number;
}

export interface LoyaltyTier {
  sessions: number;
  discountPercent: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
}

export interface SessionPackage {
  id: string;
  name: string;
  description?: string;
  service_category: ServiceCategory;
  service_ids: string[];
  sessions_total: number;
  price: number;
  active: boolean;
}

export interface CustomerPackage {
  id: string;
  phone: string;
  package_id: string;
  package_name: string;
  sessions_remaining: number;
  sessions_total: number;
  purchased_at: string;
}

export interface BalanceGiftCard {
  id: string;
  code: string;
  initial_balance: number;
  balance_remaining: number;
  gifter_name: string;
  recipient_phone: string | null;
  recipient_name: string | null;
  message: string;
  active: boolean;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  phone: string;
  amount: number;
  reason: string;
  booking_id: string | null;
  created_at: string;
}

export interface CustomerLoyalty {
  phone: string;
  massage_sessions_completed: number;
}

export interface PricingAdjustments {
  loyaltyDiscount: number;
  loyaltyPercent: number;
  discountCodeAmount: number;
  discountCodeLabel: string | null;
  packageDiscount: number;
  packageUsedId: string | null;
  walletUsed: number;
  balanceGiftUsed: number;
}

export interface PricingResult {
  lines: ServiceLine[];
  subtotal: number;
  regionSurchargeTotal: number;
  deliveryFee: number;
  totalPrice: number;
  totalDuration: number;
  peopleCount: number;
  requiresDeposit: boolean;
  adjustments?: PricingAdjustments;
  finalTotal?: number;
}

export interface CustomerAccount {
  phone: string;
  name: string | null;
  wallet_balance: number;
  loyalty: {
    massage_sessions: number;
    current_discount_percent: number;
    next_tier: { sessions: number; discountPercent: number } | null;
    sessions_until_next: number | null;
  };
  packages: CustomerPackage[];
  bookings: BookingWithServices[];
  transactions: WalletTransaction[];
}

export type VisitStatus =
  | "scheduled"
  | "en_route"
  | "arrived"
  | "service_started"
  | "finished";

export interface VisitTimeline {
  en_route_at?: string | null;
  arrived_at?: string | null;
  service_started_at?: string | null;
  finished_at?: string | null;
}

export interface BookingRating {
  id: string;
  booking_id: string;
  customer_phone: string;
  stars: number;
  comment: string;
  created_at: string;
}

export type NotificationType =
  | "booking_confirmed"
  | "deposit_payment"
  | "reminder"
  | "en_route"
  | "arrived"
  | "delay"
  | "service_finished"
  | "rating_request";

export type NotificationAudience = "customer" | "admin" | "therapist";

export interface AppNotification {
  id: string;
  type: NotificationType;
  audience: NotificationAudience;
  title: string;
  body: string;
  booking_id: string | null;
  phone: string | null;
  therapist_id: number | null;
  read: boolean;
  created_at: string;
  external_dispatch: {
    channel: "sms" | "whatsapp" | null;
    dispatched: boolean;
    dispatched_at: string | null;
  };
}

export interface Therapist {
  id: number;
  name: string;
  active: boolean;
}

export interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  location_url: string;
  region: Region;
  door_image_url: string | null;
  customer_notes: string | null;
  therapist_id: number;
  start_time: string;
  end_time: string;
  total_duration: number;
  total_price: number;
  delivery_fee: number;
  region_surcharge_total: number;
  subtotal: number;
  people_count: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  requires_deposit: boolean;
  moyasar_payment_id: string | null;
  created_at: string;
  booking_type: "self" | "gift_redeem";
  discount_code?: string | null;
  loyalty_discount?: number;
  package_discount?: number;
  wallet_used?: number;
  balance_gift_used?: number;
  customer_package_id?: string | null;
  final_price?: number;
  visit_status?: VisitStatus;
  visit_timeline?: VisitTimeline;
  rating_id?: string | null;
}

export interface BookingWithServices extends Booking {
  services: ServiceLine[];
}

export interface BookingForSchedule {
  id: string;
  therapist_id: number;
  region: Region;
  start_time: string;
  end_time: string;
  status: BookingStatus;
}

export interface AvailableSlot {
  iso: string;
  timeFormatted: string;
  dateTimeFormatted: string;
  dateLabel: string;
  therapistId: number;
}

export interface GiftCard {
  id: string;
  gifter_name: string;
  gifter_phone: string;
  recipient_name: string;
  recipient_phone: string;
  message: string;
  occasion_date: string | null;
  services: ServiceLine[];
  total_price: number;
  payment_status: GiftPaymentStatus;
  created_at: string;
  sent_at: string | null;
}

export const REGION_LABELS: Record<Region, string> = {
  north: "شمال",
  south: "جنوب",
  east: "شرق",
  west: "غرب",
};

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  nails: "الأظافر",
  massage: "المساج",
  makeup: "المكياج",
  hair: "الشعر",
};

export const CATEGORY_EMOJI: Record<ServiceCategory, string> = {
  nails: "💅",
  massage: "💆",
  makeup: "💄",
  hair: "💇‍♀️",
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  new: "جديد",
  awaiting_deposit: "بانتظار العربون",
  confirmed: "مؤكّد",
  in_progress: "جارٍ",
  completed: "منتهٍ",
  cancelled: "ملغى",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "بانتظار الدفع",
  paid: "مدفوع",
  failed: "فشل الدفع",
  deposit_pending: "بانتظار العربون",
};

export const GIFT_PAYMENT_LABELS: Record<GiftPaymentStatus, string> = {
  pending: "بانتظار الدفع",
  paid: "مدفوع",
  failed: "فشل الدفع",
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "مجدول",
  en_route: "في الطريق",
  arrived: "وصلت",
  service_started: "بدأت الخدمة",
  finished: "انتهت الخدمة",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  booking_confirmed: "تأكيد الحجز",
  deposit_payment: "عربون / دفع",
  reminder: "تذكير بالموعد",
  en_route: "بدء الطريق",
  arrived: "وصول الثيرابست",
  delay: "تأخير",
  service_finished: "انتهاء الخدمة",
  rating_request: "طلب تقييم",
};

export interface ReportsSummary {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  revenueToday: number;
  revenueMonth: number;
  avgRating: number;
  ratedCount: number;
  topServices: { name: string; count: number }[];
  topRegions: { region: Region; label: string; count: number }[];
  topTherapists: { id: number; name: string; count: number }[];
  repeatCustomers: number;
  delayedVisits: { bookingId: string; customerName: string; delayMinutes: number }[];
}

export function formatServicesSummary(lines: ServiceLine[] | null | undefined): string {
  return asArray<ServiceLine>(lines)
    .filter((l) => l.quantity > 0 || l.people_count > 0)
    .map((l) => {
      const count = l.people_count || l.quantity;
      const addons = l.addon_names?.length ? ` (+${l.addon_names.join("، ")})` : "";
      return count > 1 ? `${l.name} ×${count}${addons}` : `${l.name}${addons}`;
    })
    .join("، ");
}
