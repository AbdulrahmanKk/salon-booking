"use client";

import { useMemo, useState } from "react";
import { asArray } from "@/lib/arrays";
import type { BookingWithServices } from "@/lib/types";
import { formatServicesSummary, REGION_LABELS } from "@/lib/types";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 14);

function formatTime12(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-SA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Riyadh",
  }).replace("ص", "صباحاً").replace("م", "مساءً");
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 6 ? 0 : day + 1;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

interface Props {
  bookings: BookingWithServices[];
  onAddManual: () => void;
  onRefresh: () => void;
}

export default function AdminCalendar({ bookings: bookingsProp, onAddManual, onRefresh }: Props) {
  const bookings = asArray<BookingWithServices>(bookingsProp);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const bookingsForDay = (day: Date) => {
    const key = day.toDateString();
    return bookings.filter((b) => new Date(b.start_time).toDateString() === key);
  };

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={() => shiftWeek(-1)}>← الأسبوع السابق</button>
        <button type="button" className="btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          هذا الأسبوع
        </button>
        <button type="button" className="btn-secondary" onClick={() => shiftWeek(1)}>الأسبوع التالي →</button>
        <button type="button" className="btn-primary mr-auto" onClick={onAddManual}>
          + إضافة حجز يدوي
        </button>
        <button type="button" className="btn-secondary" onClick={onRefresh}>تحديث</button>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="grid min-w-[800px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
          <div className="border-b border-salon-blush bg-salon-blush/30 p-2" />
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="border-b border-r border-salon-blush bg-salon-blush/30 p-2 text-center text-sm font-semibold">
              {day.toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          ))}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-salon-blush p-1 text-center text-xs text-salon-mauve">
                {hour > 12 ? hour - 12 : hour}{hour >= 12 ? " م" : " ص"}
              </div>
              {weekDays.map((day) => {
                const dayBookings = bookingsForDay(day).filter((b) => {
                  const h = new Date(b.start_time).getHours();
                  return h === hour || (h < hour && new Date(b.end_time).getHours() > hour);
                });
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="relative min-h-[52px] border-b border-r border-salon-blush/60 p-0.5"
                  >
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        className="mb-0.5 rounded-lg bg-salon-accent/90 px-1.5 py-1 text-[10px] leading-tight text-white"
                        title={`${b.customer_name} — ${formatServicesSummary(b.services)}`}
                      >
                        <div className="font-bold truncate">{b.customer_name}</div>
                        <div>{formatTime12(b.start_time)} · {REGION_LABELS[b.region]}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
