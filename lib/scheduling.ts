/**
 * محرك الجدولة الذكي — سوفت مومنت
 *
 * القواعد:
 * 1. انتهاء الحجز = بدايته + (مجموع مدد الخدمات والإضافات)
 * 2. أول وقت متاح = انتهاء السابق + وقت الطريق + وقت تجهيز
 * 3. وقت تجهيز (قابل للتعديل) قبل وبعد كل خدمة
 * 4. ثلاث ثيرابست — كل واحدة لها جدول مستقل
 * 5. المناطق البعيدة تُوزّع على ثيرابست مختلفة تلقائياً
 *
 * جدول وقت الطريق في travel-matrix.ts (للجدولة فقط — منفصل عن رسوم التوصيل)
 * لاحقاً: ربط Google Maps Distance Matrix API لزحمة فعلية
 */

import { getTravelMinutes } from "./travel-matrix";
import { asArray } from "./arrays";
import type { BookingForSchedule, Region, SalonSettings } from "./types";

const RIYADH_TZ = "Asia/Riyadh";

export interface SlotWithTherapist {
  start: Date;
  therapistId: number;
}

export function calculateEndTime(startTime: Date, durationMinutes: number): Date {
  return new Date(startTime.getTime() + durationMinutes * 60 * 1000);
}

export function sortActiveBookings(
  bookings: BookingForSchedule[] | null | undefined,
): BookingForSchedule[] {
  return asArray<BookingForSchedule>(bookings)
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export function getDayBusinessStart(day: Date, settings: SalonSettings): Date {
  const d = new Date(day);
  d.setHours(settings.businessStartHour, 0, 0, 0);
  return d;
}

export function getDayBusinessEnd(day: Date, settings: SalonSettings): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  if (settings.businessEndHour === 24) return d;
  d.setHours(settings.businessEndHour, 0, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function roundUpToSlot(date: Date, interval: number): Date {
  const d = new Date(date);
  const mins = d.getMinutes();
  const rem = mins % interval;
  if (rem !== 0) {
    d.setMinutes(mins + (interval - rem), 0, 0);
  } else {
    d.setSeconds(0, 0);
  }
  return d;
}

/** حجوزات ثيرابست معيّنة */
export function bookingsForTherapist(
  bookings: BookingForSchedule[],
  therapistId: number,
): BookingForSchedule[] {
  return sortActiveBookings(bookings).filter((b) => b.therapist_id === therapistId);
}

/**
 * هل الموعد صالح لثيرابست معيّنة؟
 * يُحسب وقت التجهيز + وقت الطريق بين المناطق
 */
export function isSlotValidForTherapist(
  start: Date,
  end: Date,
  region: Region,
  therapistBookings: BookingForSchedule[],
  prepMinutes: number,
  excludeBookingId?: string,
): boolean {
  const active = therapistBookings.filter(
    (b) => b.id !== excludeBookingId && b.status !== "cancelled",
  );

  const blockStart = addMinutes(start, -prepMinutes);
  const blockEnd = addMinutes(end, prepMinutes);

  for (const b of active) {
    const bStart = addMinutes(new Date(b.start_time), -prepMinutes);
    const bEnd = addMinutes(new Date(b.end_time), prepMinutes);
    const travelToB = getTravelMinutes(region, b.region);
    const travelFromB = getTravelMinutes(b.region, region);

    if (blockEnd.getTime() <= bStart.getTime()) {
      if (blockEnd.getTime() + travelToB * 60_000 > bStart.getTime()) return false;
    } else if (blockStart.getTime() >= bEnd.getTime()) {
      if (blockStart.getTime() < bEnd.getTime() + travelFromB * 60_000) return false;
    } else {
      return false;
    }
  }
  return true;
}

/** أول ثيرابست متاحة للموعد */
export function findAvailableTherapist(
  start: Date,
  end: Date,
  region: Region,
  allBookings: BookingForSchedule[],
  settings: SalonSettings,
  excludeBookingId?: string,
): number | null {
  for (let t = 1; t <= settings.therapistCount; t++) {
    const therapistBookings = bookingsForTherapist(allBookings, t);
    if (
      isSlotValidForTherapist(
        start,
        end,
        region,
        therapistBookings,
        settings.prepTimeMinutes,
        excludeBookingId,
      )
    ) {
      return t;
    }
  }
  return null;
}

/**
 * كل الأوقات المتاحة — مع تخصيص ثيرابست لكل وقت
 */
export function getAvailableSlots(
  existingBookings: BookingForSchedule[],
  region: Region,
  durationMinutes: number,
  settings: SalonSettings,
  from: Date = new Date(),
  therapistId?: number,
): SlotWithTherapist[] {
  if (durationMinutes <= 0) return [];

  const slots: SlotWithTherapist[] = [];
  const now = new Date(from);
  const interval = settings.slotIntervalMinutes;
  const therapists =
    therapistId != null
      ? [therapistId]
      : Array.from({ length: settings.therapistCount }, (_, i) => i + 1);

  for (let dayOffset = 0; dayOffset < settings.daysAhead; dayOffset++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + dayOffset);

    const dayStart = getDayBusinessStart(day, settings);
    const dayEnd = getDayBusinessEnd(day, settings);

    let cursor = roundUpToSlot(dayStart, interval);
    if (dayOffset === 0 && cursor < now) {
      cursor = roundUpToSlot(now, interval);
    }

    while (cursor < dayEnd) {
      const end = calculateEndTime(cursor, durationMinutes);
      if (end > dayEnd) break;

      for (const t of therapists) {
        const therapistBookings = bookingsForTherapist(existingBookings, t);
        if (
          isSlotValidForTherapist(
            cursor,
            end,
            region,
            therapistBookings,
            settings.prepTimeMinutes,
          )
        ) {
          slots.push({ start: new Date(cursor), therapistId: t });
          break;
        }
      }
      cursor = addMinutes(cursor, interval);
    }
  }

  return slots;
}

export function formatTimeAr12(date: Date): string {
  const str = date.toLocaleTimeString("ar-SA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: RIYADH_TZ,
  });
  return str.replace("ص", "صباحاً").replace("م", "مساءً");
}

export function formatDateAr(date: Date): string {
  return date.toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: RIYADH_TZ,
  });
}

export function formatDateTimeAr(date: Date): string {
  return `${formatDateAr(date)} — ${formatTimeAr12(date)}`;
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("ar-SA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: RIYADH_TZ,
  });
}

/** أقرب وقت ممكن بعد آخر حجز (للعرض) */
export function earliestAfterLastBooking(
  existingBookings: BookingForSchedule[],
  region: Region,
  settings: SalonSettings,
): { time: Date | null; travelMinutes: number | null; therapistId: number | null } {
  const active = sortActiveBookings(existingBookings);
  if (active.length === 0) return { time: null, travelMinutes: null, therapistId: null };

  let best: { time: Date; travel: number; therapistId: number } | null = null;

  for (let t = 1; t <= settings.therapistCount; t++) {
    const tb = bookingsForTherapist(active, t);
    if (tb.length === 0) continue;
    const last = tb[tb.length - 1];
    const travel = getTravelMinutes(last.region, region);
    const time = addMinutes(
      new Date(last.end_time),
      travel + settings.prepTimeMinutes,
    );
    if (!best || time < best.time) {
      best = { time, travel, therapistId: t };
    }
  }

  if (!best) return { time: null, travelMinutes: null, therapistId: null };
  return { time: best.time, travelMinutes: best.travel, therapistId: best.therapistId };
}

/** توافق مع الكود القديم */
export const BUSINESS_START_HOUR = 14;
export const BUSINESS_END_HOUR = 24;
export const SLOT_INTERVAL_MINUTES = 15;
export const DAYS_AHEAD = 14;

export function formatTimeAr(date: Date): string {
  return formatTimeAr12(date);
}
