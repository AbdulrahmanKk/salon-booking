"use client";

import type { BookingWithServices } from "@/lib/types";
import { formatServicesSummary, REGION_LABELS, VISIT_STATUS_LABELS } from "@/lib/types";

const REGION_POS: Record<string, { x: string; y: string }> = {
  north: { x: "50%", y: "15%" },
  east: { x: "82%", y: "50%" },
  west: { x: "18%", y: "50%" },
  south: { x: "50%", y: "85%" },
};

interface Props {
  bookings: BookingWithServices[];
}

export default function AdminMap({ bookings }: Props) {
  const active = bookings.filter((b) => b.status !== "cancelled");

  return (
    <div className="card space-y-4">
      <h3 className="font-bold">خريطة الحجوزات — الرياض</h3>
      <p className="text-sm text-salon-mauve">مواقع اليوم والقادمة حسب المنطقة</p>

      <div className="relative mx-auto aspect-square max-w-lg rounded-3xl border-2 border-soft-blush bg-gradient-to-br from-soft-blush/30 to-salon-cream">
        {Object.entries(REGION_POS).map(([region, pos]) => (
          <div
            key={region}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold shadow"
            style={{ left: pos.x, top: pos.y }}
          >
            {REGION_LABELS[region as keyof typeof REGION_LABELS]}
          </div>
        ))}

        {active.map((b, i) => {
          const pos = REGION_POS[b.region];
          const offset = (i % 3) * 12 - 12;
          return (
            <a
              key={b.id}
              href={b.location_url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${b.customer_name} — ${formatServicesSummary(b.services)}`}
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-soft-accent text-xs text-white shadow-lg hover:scale-110 transition"
              style={{
                left: `calc(${pos.x} + ${offset}px)`,
                top: `calc(${pos.y} + ${offset}px)`,
              }}
            >
              📍
            </a>
          );
        })}
      </div>

      <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
        {active.slice(0, 15).map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
            <span className="font-medium">{b.customer_name}</span>
            <span className="text-salon-mauve">{REGION_LABELS[b.region]}</span>
            <span className="text-xs">{VISIT_STATUS_LABELS[b.visit_status ?? "scheduled"]}</span>
            <a href={b.location_url} target="_blank" rel="noopener noreferrer" className="text-soft-accent underline text-xs">
              خريطة
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
