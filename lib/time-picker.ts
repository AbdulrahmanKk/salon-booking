/**
 * مساعدات اختيار الوقت — يوم → فترة → وقت
 */

import type { AvailableSlot } from "./types";

export type TimePeriod = "afternoon" | "evening" | "night";

export const TIME_PERIODS: { id: TimePeriod; label: string; emoji: string; range: string }[] = [
  { id: "afternoon", label: "عصراً", emoji: "🌅", range: "2:00 – 5:00" },
  { id: "evening", label: "مساءً", emoji: "🌇", range: "5:00 – 8:00" },
  { id: "night", label: "ليلاً", emoji: "🌙", range: "8:00 – 12:00" },
];

const RIYADH_TZ = "Asia/Riyadh";

export function getHourRiyadh(iso: string): number {
  const h = new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: RIYADH_TZ,
  });
  return parseInt(h, 10);
}

export function getPeriodForSlot(iso: string): TimePeriod {
  const hour = getHourRiyadh(iso);
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

export function getDateKeyRiyadh(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: RIYADH_TZ });
}

export function getRelativeDayLabel(iso: string): string {
  const slotKey = getDateKeyRiyadh(iso);
  const todayKey = getDateKeyRiyadh(new Date().toISOString());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getDateKeyRiyadh(tomorrow.toISOString());
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterKey = getDateKeyRiyadh(dayAfter.toISOString());

  if (slotKey === todayKey) return "اليوم";
  if (slotKey === tomorrowKey) return "غداً";
  if (slotKey === dayAfterKey) return "بعد غد";
  return "";
}

export interface DayOption {
  dateKey: string;
  dateLabel: string;
  relativeLabel: string;
  slots: AvailableSlot[];
}

/** تجميع الأوقات حسب اليوم (أول 7 أيام) */
export function groupSlotsByDay(slots: AvailableSlot[], maxDays = 7): DayOption[] {
  const map = new Map<string, DayOption>();
  for (const slot of slots) {
    const dateKey = getDateKeyRiyadh(slot.iso);
    if (!map.has(dateKey)) {
      const relative = getRelativeDayLabel(slot.iso);
      map.set(dateKey, {
        dateKey,
        dateLabel: slot.dateLabel,
        relativeLabel: relative,
        slots: [],
      });
    }
    map.get(dateKey)!.slots.push(slot);
  }
  return Array.from(map.values()).slice(0, maxDays);
}

export function filterSlotsByPeriod(slots: AvailableSlot[], period: TimePeriod): AvailableSlot[] {
  return slots.filter((s) => getPeriodForSlot(s.iso) === period);
}
