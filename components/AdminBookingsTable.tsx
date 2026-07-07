"use client";

import { downloadBookingIcs } from "@/lib/calendar-ics";
import type {
  BookingStatus,
  BookingWithServices,
  PaymentStatus,
  Region,
  Therapist,
} from "@/lib/types";
import {
  formatServicesSummary,
  PAYMENT_LABELS,
  REGION_LABELS,
  STATUS_LABELS,
  VISIT_STATUS_LABELS,
} from "@/lib/types";

const RIYADH_TZ = "Asia/Riyadh";

interface Props {
  title: string;
  bookings: BookingWithServices[];
  therapists: Therapist[];
  formatCategories: (b: BookingWithServices) => string;
  onReschedule: (id: string, startTime: string) => void;
  onTransfer: (id: string, therapistId: number) => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
  onHide: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA", {
    timeZone: RIYADH_TZ,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-SA", {
    timeZone: RIYADH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminBookingsTable({
  title,
  bookings,
  therapists,
  formatCategories,
  onReschedule,
  onTransfer,
  onStatusChange,
  onHide,
  onDelete,
}: Props) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold text-salon-accent">{title}</h3>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-salon-blush bg-salon-blush/40 text-right">
              <th className="p-3">الاسم</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">الوقت</th>
              <th className="p-3">المنطقة</th>
              <th className="p-3">القسم</th>
              <th className="p-3">الخدمات</th>
              <th className="p-3">المدة</th>
              <th className="p-3">السعر</th>
              <th className="p-3">الجوال</th>
              <th className="p-3">اللوكيشن</th>
              <th className="p-3">الباب</th>
              <th className="p-3">الدفع</th>
              <th className="p-3">الزيارة</th>
              <th className="p-3">إدارة</th>
              <th className="p-3">ثيرابست</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={17} className="p-6 text-center text-salon-mauve">
                  لا توجد حجوزات
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="border-b border-salon-blush/60 hover:bg-salon-cream/50">
                  <td className="p-3 font-medium">{b.customer_name || "—"}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => downloadBookingIcs(b)}
                      className="text-salon-accent underline hover:opacity-80"
                      title="إضافة إلى تقويم الجهاز"
                    >
                      {formatDate(b.start_time)}
                    </button>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div>{formatTimeOnly(b.start_time)}</div>
                    <div className="text-xs text-salon-mauve">→ {formatTimeOnly(b.end_time)}</div>
                  </td>
                  <td className="p-3">{REGION_LABELS[b.region as Region]}</td>
                  <td className="p-3 text-xs">{formatCategories(b)}</td>
                  <td className="p-3 max-w-[200px]">{formatServicesSummary(b.services)}</td>
                  <td className="p-3">{b.total_duration} د</td>
                  <td className="p-3">{b.total_price} ر.س</td>
                  <td className="p-3" dir="ltr">
                    {b.customer_phone}
                  </td>
                  <td className="p-3">
                    <a
                      href={b.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-salon-accent underline"
                    >
                      خريطة
                    </a>
                  </td>
                  <td className="p-3">
                    {b.door_image_url ? (
                      <img
                        src={b.door_image_url}
                        alt="باب"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        b.payment_status === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {PAYMENT_LABELS[b.payment_status as PaymentStatus]}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {VISIT_STATUS_LABELS[b.visit_status ?? "scheduled"]}
                  </td>
                  <td className="p-3 min-w-[140px]">
                    <input
                      type="datetime-local"
                      className="mb-1 w-full rounded border border-salon-blush px-1 py-0.5 text-xs"
                      defaultValue={b.start_time.slice(0, 16)}
                      onBlur={(e) => {
                        if (e.target.value) {
                          onReschedule(b.id, new Date(e.target.value).toISOString());
                        }
                      }}
                    />
                    <select
                      className="w-full rounded border border-salon-blush px-1 py-0.5 text-xs"
                      value={b.therapist_id}
                      onChange={(e) => onTransfer(b.id, Number(e.target.value))}
                    >
                      {therapists.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-center">{b.therapist_id ?? "—"}</td>
                  <td className="p-3">
                    <select
                      value={b.status}
                      onChange={(e) => onStatusChange(b.id, e.target.value as BookingStatus)}
                      className="rounded-lg border border-salon-blush bg-white px-2 py-1 text-xs"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded-lg border border-salon-blush px-2 py-1 text-xs hover:bg-salon-cream"
                        onClick={() => onHide(b.id)}
                      >
                        إخفاء
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(b.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
