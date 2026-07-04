"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingWithServices, Therapist } from "@/lib/types";
import { formatServicesSummary, REGION_LABELS, VISIT_STATUS_LABELS } from "@/lib/types";
import NotificationCenter from "./NotificationCenter";

export default function TherapistPanel() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [therapistId, setTherapistId] = useState(1);
  const [bookings, setBookings] = useState<BookingWithServices[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/therapist?id=${therapistId}`);
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings ?? []);
        setTherapists(data.therapists ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [therapistId]);

  useEffect(() => { load(); }, [load]);

  const visitAction = async (bookingId: string, action: string) => {
    await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitAction: action }),
    });
    load();
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ar-SA", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Riyadh",
    });

  const etaLabel = (b: BookingWithServices) => {
    if (b.visit_timeline?.arrived_at) return "وصلتِ";
    if (b.visit_timeline?.en_route_at) return "في الطريق";
    return `موعد ${formatTime(b.start_time)}`;
  };

  if (loading) return <p className="text-center text-salon-mauve">جاري التحميل...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">لوحة الثيرابست</h2>
        <NotificationCenter audience="therapist" therapistId={therapistId} />
      </div>
      <div className="flex flex-wrap gap-2">
        {therapists.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTherapistId(t.id)}
            className={`rounded-xl border-2 px-4 py-2 text-sm ${
              therapistId === t.id ? "border-soft-accent bg-soft-accent text-white" : "border-salon-blush"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <h2 className="text-lg font-bold">مواعيد اليوم — {therapists.find((t) => t.id === therapistId)?.name}</h2>

      {bookings.length === 0 ? (
        <div className="card text-center text-salon-mauve">لا مواعيد اليوم 🌸</div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="card space-y-3 border-r-4 border-soft-accent">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-bold text-lg">{b.customer_name}</div>
                  <div className="text-sm text-salon-mauve">{formatServicesSummary(b.services)}</div>
                </div>
                <div className="text-left text-sm">
                  <div>{formatTime(b.start_time)} – {formatTime(b.end_time)}</div>
                  <div className="text-soft-accent">{REGION_LABELS[b.region]}</div>
                  <div className="text-xs">{VISIT_STATUS_LABELS[b.visit_status ?? "scheduled"]}</div>
                </div>
              </div>

              <div className="text-sm text-salon-mauve">⏱ {etaLabel(b)}</div>

              <a
                href={b.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-soft-accent underline"
              >
                📍 فتح موقع العميلة
              </a>

              {b.customer_notes && (
                <p className="rounded-lg bg-salon-cream/80 px-3 py-2 text-sm">📝 {b.customer_notes}</p>
              )}

              {b.door_image_url && (
                <img src={b.door_image_url} alt="باب" className="max-h-24 rounded-xl object-cover" />
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { action: "en_route", label: "🚗 بدأت الطريق", done: !!b.visit_timeline?.en_route_at },
                  { action: "arrived", label: "📍 وصلت", done: !!b.visit_timeline?.arrived_at },
                  { action: "service_started", label: "💆 بدأت الخدمة", done: !!b.visit_timeline?.service_started_at },
                  { action: "finished", label: "✓ انتهت", done: !!b.visit_timeline?.finished_at },
                ].map((btn) => (
                  <button
                    key={btn.action}
                    type="button"
                    disabled={btn.done || b.status === "completed"}
                    onClick={() => visitAction(b.id, btn.action)}
                    className={`rounded-xl border-2 px-2 py-2 text-xs transition ${
                      btn.done
                        ? "border-green-300 bg-green-50 text-green-800"
                        : "border-salon-blush hover:border-soft-accent"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
