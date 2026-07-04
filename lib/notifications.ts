/**
 * بناء رسائل الإشعارات الداخلية + تذكيرات المواعيد
 */

import { formatServicesSummary } from "./types";
import type {
  AppNotification,
  BookingWithServices,
  NotificationType,
} from "./types";

const RIYADH_TZ = "Asia/Riyadh";

function formatBookingTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-SA", {
    timeZone: RIYADH_TZ,
    dateStyle: "short",
    timeStyle: "short",
    hour12: true,
  });
}

export function buildNotificationContent(
  type: NotificationType,
  booking: BookingWithServices,
  extra?: { delayMinutes?: number },
): { title: string; body: string } {
  const services = formatServicesSummary(booking.services);
  const when = formatBookingTime(booking.start_time);
  const name = booking.customer_name || "عميلة";

  switch (type) {
    case "booking_confirmed":
      return {
        title: "تم تأكيد حجزكِ",
        body: `${name}، حجزكِ مؤكّد: ${services} — ${when}`,
      };
    case "deposit_payment":
      return {
        title: booking.requires_deposit ? "بانتظار العربون" : "تم استلام الدفع",
        body: booking.requires_deposit
          ? `حجز ${services} بانتظار تحويل العربون — ${when}`
          : `تم تأكيد الدفع لحجز ${services} — ${when}`,
      };
    case "reminder":
      return {
        title: "تذكير بموعدكِ غداً",
        body: `موعدكِ مع سوفت مومنت: ${services} — ${when}`,
      };
    case "en_route":
      return {
        title: "ثيرابستكِ في الطريق",
        body: `الثيرابست في الطريق إليكِ — ${services} · ${when}`,
      };
    case "arrived":
      return {
        title: "وصلت الثيرابست",
        body: `الثيرابست وصلت لموقعكِ — ${services}`,
      };
    case "delay": {
      const mins = extra?.delayMinutes ?? 0;
      return {
        title: "تأخير في الوصول",
        body: `تأخير ${mins} دقيقة عن موعد ${name} — ${services}`,
      };
    }
    case "service_finished":
      return {
        title: "انتهت الخدمة",
        body: `تم إنهاء خدمة ${services} — نتمنى لكِ يوماً جميلاً`,
      };
    case "rating_request":
      return {
        title: "قيّمي تجربتكِ",
        body: `كيف كانت تجربتكِ مع ${services}؟ شاركينا تقييمكِ من حسابكِ`,
      };
    default:
      return { title: "إشعار", body: services };
  }
}

export function isUpcomingForReminder(booking: BookingWithServices, withinHours = 24): boolean {
  if (booking.status === "cancelled" || booking.status === "completed") return false;
  if (!["confirmed", "awaiting_deposit", "in_progress", "new"].includes(booking.status)) {
    return false;
  }
  const start = new Date(booking.start_time).getTime();
  const now = Date.now();
  const windowMs = withinHours * 60 * 60 * 1000;
  return start > now && start - now <= windowMs;
}

export function notificationExists(
  notifications: AppNotification[],
  bookingId: string,
  type: NotificationType,
  audience?: AppNotification["audience"],
): boolean {
  return notifications.some(
    (n) =>
      n.booking_id === bookingId &&
      n.type === type &&
      (audience === undefined || n.audience === audience),
  );
}
