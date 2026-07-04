"use client";

import { useEffect, useMemo, useState } from "react";
import { asArray } from "@/lib/arrays";
import {
  filterSlotsByPeriod,
  groupSlotsByDay,
  TIME_PERIODS,
  type TimePeriod,
} from "@/lib/time-picker";
import type { AvailableSlot } from "@/lib/types";

interface Props {
  slots: AvailableSlot[];
  selectedSlot: string | null;
  onSelect: (iso: string | null) => void;
  earliestAfterLast?: string | null;
  travelFromLastMinutes?: number | null;
}

export default function TimeSlotPicker({
  slots: slotsProp,
  selectedSlot,
  onSelect,
  earliestAfterLast,
  travelFromLastMinutes,
}: Props) {
  const slots = asArray<AvailableSlot>(slotsProp);
  const days = useMemo(() => groupSlotsByDay(slots, 7), [slots]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null);

  useEffect(() => {
    if (days.length === 0) {
      setSelectedDayKey(null);
      setSelectedPeriod(null);
      return;
    }
    if (!selectedDayKey || !days.some((d) => d.dateKey === selectedDayKey)) {
      setSelectedDayKey(days[0].dateKey);
      setSelectedPeriod(null);
    }
  }, [days, selectedDayKey]);

  const selectedDay = days.find((d) => d.dateKey === selectedDayKey);
  const daySlots = selectedDay?.slots ?? [];

  const periodsWithSlots = useMemo(() => {
    return TIME_PERIODS.map((p) => ({
      ...p,
      count: filterSlotsByPeriod(daySlots, p.id).length,
    })).filter((p) => p.count > 0);
  }, [daySlots]);

  useEffect(() => {
    if (periodsWithSlots.length === 0) {
      setSelectedPeriod(null);
      return;
    }
    if (!selectedPeriod || !periodsWithSlots.some((p) => p.id === selectedPeriod)) {
      setSelectedPeriod(periodsWithSlots[0].id);
    }
  }, [periodsWithSlots, selectedPeriod]);

  const visibleSlots = selectedPeriod
    ? filterSlotsByPeriod(daySlots, selectedPeriod)
    : [];

  if (!slots.length) {
    return (
      <p className="text-salon-mauve">لا توجد أوقات متاحة حالياً — جرّبي تقليل الخدمات أو غيّري المنطقة</p>
    );
  }

  return (
    <div className="space-y-5">
      {earliestAfterLast && travelFromLastMinutes != null && (
        <p className="text-sm text-salon-mauve">
          بعد آخر حجز + {travelFromLastMinutes} د طريق → من {earliestAfterLast}
        </p>
      )}

      {/* الخطوة أ: اختيار اليوم */}
      <div>
        <p className="mb-2 text-sm font-semibold text-salon-text">أ — اختاري اليوم</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => {
                setSelectedDayKey(day.dateKey);
                setSelectedPeriod(null);
                onSelect(null);
              }}
              className={`shrink-0 rounded-xl border-2 px-4 py-3 text-center transition ${
                selectedDayKey === day.dateKey
                  ? "border-salon-accent bg-salon-accent text-white"
                  : "border-salon-blush bg-white hover:border-salon-rose"
              }`}
            >
              {day.relativeLabel && (
                <div className="text-xs font-bold opacity-90">{day.relativeLabel}</div>
              )}
              <div className="text-sm whitespace-nowrap">{day.dateLabel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* الخطوة ب: الفترة */}
      {selectedDay && periodsWithSlots.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-salon-text">ب — اختاري الفترة</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {periodsWithSlots.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPeriod(p.id);
                  onSelect(null);
                }}
                className={`rounded-xl border-2 px-3 py-3 text-right transition ${
                  selectedPeriod === p.id
                    ? "border-salon-accent bg-salon-blush/60"
                    : "border-salon-blush bg-white hover:border-salon-rose"
                }`}
              >
                <div className="font-medium">
                  {p.emoji} {p.label}
                </div>
                <div className="text-xs text-salon-mauve">{p.range}</div>
                <div className="text-xs text-salon-accent">{p.count} وقت</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* الخطوة ج: الأوقات */}
      {selectedPeriod && visibleSlots.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-salon-text">ج — اختاري الوقت</p>
          <div className="flex flex-wrap gap-2">
            {visibleSlots.map((slot) => (
              <button
                key={slot.iso}
                type="button"
                onClick={() => onSelect(slot.iso)}
                className={`rounded-xl border-2 px-4 py-2 text-sm transition ${
                  selectedSlot === slot.iso
                    ? "border-salon-accent bg-salon-accent text-white"
                    : "border-salon-blush bg-white hover:border-salon-rose"
                }`}
              >
                {slot.timeFormatted}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
