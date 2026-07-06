"use client";

import { useCallback, useEffect, useState } from "react";
import { asArray } from "@/lib/arrays";
import { bookingServiceCategories, logBookingCategorySnapshot, resolveLineCategory } from "@/lib/categories";
import type { BookingStatus, BookingWithServices, CatalogService, PaymentStatus, Region, ServiceCategory, ServiceSelection, Therapist } from "@/lib/types";
import { CATEGORY_LABELS, formatServicesSummary, PAYMENT_LABELS, REGION_LABELS, STATUS_LABELS, VISIT_STATUS_LABELS } from "@/lib/types";
import AdminCalendar from "./AdminCalendar";
import AdminGifts from "./AdminGifts";
import AdminMap from "./AdminMap";
import AdminPromotions from "./AdminPromotions";
import AdminReports from "./AdminReports";
import AdminSettings from "./AdminSettings";
import NotificationCenter from "./NotificationCenter";

const REGIONS: Region[] = ["north", "south", "east", "west"];

interface SlotOption {
  iso: string;
  timeFormatted: string;
  dateTimeFormatted: string;
  dateLabel: string;
}

export default function AdminPanel() {
  const [bookings, setBookings] = useState<BookingWithServices[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"calendar" | "table" | "map" | "reports" | "gifts" | "promotions" | "settings">("calendar");
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [showManual, setShowManual] = useState(false);

  const [mName, setMName] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mLocation, setMLocation] = useState("");
  const [mRegion, setMRegion] = useState<Region>("north");
  const [mQty, setMQty] = useState<Record<string, number>>({});
  const [mSlots, setMSlots] = useState<SlotOption[]>([]);
  const [mSelectedSlot, setMSelectedSlot] = useState("");
  const [mSaving, setMSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes, tRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/services"),
        fetch("/api/therapist?id=1"),
      ]);
      const bData = await bRes.json();
      const sData = await sRes.json();
      const tData = await tRes.json();
      if (!bRes.ok) throw new Error(bData.error);
      const safeBookings = asArray<BookingWithServices>(bData);
      const safeServices = asArray<CatalogService>(sData.services ?? sData);
      for (const b of safeBookings) {
        const isHair = b.services?.some(
          (l) => l.service_id.startsWith("hair-") || resolveLineCategory(l, safeServices) === "hair",
        );
        if (isHair) {
          logBookingCategorySnapshot("AdminPanel/load", b, safeServices);
        }
      }
      console.log(
        "[AdminPanel] bookings loaded:",
        safeBookings.length,
        "| hair:",
        safeBookings.filter((b) => bookingServiceCategories(b, safeServices).includes("hair")).length,
      );
      setBookings(safeBookings);
      setServices(safeServices);
      setTherapists(asArray<Therapist>(tData.therapists));
      const init: Record<string, number> = {};
      safeServices.forEach((s) => { init[s.id] = 0; });
      setMQty(init);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mSelections: ServiceSelection[] = Object.entries(mQty)
    .filter(([, n]) => n > 0)
    .map(([service_id, quantity]) => ({ service_id, quantity }));

  const fetchManualSlots = async () => {
    if (!mSelections.length) return;
    const res = await fetch("/api/available-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: mRegion, serviceSelections: mSelections }),
    });
    const data = await res.json();
    if (res.ok) {
      setMSlots(asArray(data.slots));
      setMSelectedSlot("");
    }
  };

  useEffect(() => {
    if (showManual && mSelections.length) {
      const t = setTimeout(fetchManualSlots, 300);
      return () => clearTimeout(t);
    }
  }, [showManual, mRegion, mQty]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  };

  const reschedule = async (id: string, startTime: string) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "فشل إعادة الجدولة");
    else load();
  };

  const transfer = async (id: string, therapistId: number) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ therapistId }),
    });
    if (res.ok) load();
  };

  const removeBooking = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الحجز؟")) return;
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "فشل الحذف");
      return;
    }
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  const saveManual = async () => {
    if (!mName || !mPhone || !mLocation || !mSelectedSlot || !mSelections.length) {
      setError("أكملي بيانات الحجز اليدوي");
      return;
    }
    setMSaving(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: mName,
          customerPhone: mPhone,
          locationUrl: mLocation,
          region: mRegion,
          serviceSelections: mSelections,
          startTime: mSelectedSlot,
          manual: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowManual(false);
      setMName(""); setMPhone(""); setMLocation(""); setMSelectedSlot("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setMSaving(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("ar-SA", {
      timeZone: "Asia/Riyadh",
      dateStyle: "short",
      timeStyle: "short",
      hour12: true,
    }).replace("ص", "ص").replace("م", "م");

  const formatCategories = (b: BookingWithServices): string => {
    const cats = bookingServiceCategories(b, services);
    return cats.map((c) => CATEGORY_LABELS[c as ServiceCategory] ?? c).join("، ") || "—";
  };

  if (loading) return <p className="text-center text-salon-mauve">جاري التحميل...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">لوحة الإدارة</h2>
        <NotificationCenter audience="admin" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={tab === "calendar" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("calendar")}
        >
          التقويم
        </button>
        <button
          type="button"
          className={tab === "table" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("table")}
        >
          الجدول
        </button>
        <button
          type="button"
          className={tab === "map" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("map")}
        >
          الخريطة
        </button>
        <button
          type="button"
          className={tab === "reports" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("reports")}
        >
          التقارير
        </button>
        <button
          type="button"
          className={tab === "gifts" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("gifts")}
        >
          الإهداءات
        </button>
        <button
          type="button"
          className={tab === "promotions" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("promotions")}
        >
          العروض
        </button>
        <button
          type="button"
          className={tab === "settings" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("settings")}
        >
          الإعدادات
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {showManual && (
        <div className="card space-y-4 border-2 border-salon-accent/40">
          <h3 className="text-lg font-bold">إضافة حجز يدوي (هاتف)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="input-field" placeholder="الاسم" value={mName} onChange={(e) => setMName(e.target.value)} />
            <input className="input-field" placeholder="الجوال" value={mPhone} onChange={(e) => setMPhone(e.target.value)} dir="ltr" />
            <input className="input-field sm:col-span-2" placeholder="رابط اللوكيشن" value={mLocation} onChange={(e) => setMLocation(e.target.value)} dir="ltr" />
          </div>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setMRegion(r)}
                className={`rounded-lg border-2 px-4 py-2 ${mRegion === r ? "border-salon-accent bg-salon-accent text-white" : "border-salon-blush"}`}
              >
                {REGION_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-salon-blush p-2">
                <span>{s.name}</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-secondary h-8 w-8 rounded-full p-0" onClick={() => setMQty((q) => ({ ...q, [s.id]: Math.max(0, (q[s.id] ?? 0) - 1) }))}>−</button>
                  <span className="w-6 text-center">{mQty[s.id] ?? 0}</span>
                  <button type="button" className="btn-secondary h-8 w-8 rounded-full p-0" onClick={() => setMQty((q) => ({ ...q, [s.id]: (q[s.id] ?? 0) + 1 }))}>+</button>
                </div>
              </div>
            ))}
          </div>
          {mSlots.length > 0 && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {mSlots.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => setMSelectedSlot(s.iso)}
                  className={`rounded-lg border px-3 py-1 text-sm ${mSelectedSlot === s.iso ? "border-salon-accent bg-salon-accent text-white" : "border-salon-blush"}`}
                >
                  {s.timeFormatted}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={saveManual} disabled={mSaving}>
              {mSaving ? "جاري الحفظ..." : "حفظ الحجز"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowManual(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {tab === "calendar" ? (
        <AdminCalendar
          bookings={bookings}
          onAddManual={() => setShowManual(true)}
          onRefresh={load}
        />
      ) : tab === "map" ? (
        <AdminMap bookings={bookings} />
      ) : tab === "reports" ? (
        <AdminReports />
      ) : tab === "gifts" ? (
        <AdminGifts />
      ) : tab === "promotions" ? (
        <AdminPromotions />
      ) : tab === "settings" ? (
        <AdminSettings />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-salon-blush bg-salon-blush/40 text-right">
                <th className="p-3">الاسم</th>
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
                <th className="p-3">حذف</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan={16} className="p-8 text-center text-salon-mauve">لا توجد حجوزات</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-b border-salon-blush/60 hover:bg-salon-cream/50">
                    <td className="p-3 font-medium">{b.customer_name || "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div>{formatTime(b.start_time)}</div>
                      <div className="text-xs text-salon-mauve">→ {formatTime(b.end_time)}</div>
                    </td>
                    <td className="p-3">{REGION_LABELS[b.region]}</td>
                    <td className="p-3 text-xs">{formatCategories(b)}</td>
                    <td className="p-3 max-w-[200px]">{formatServicesSummary(b.services)}</td>
                    <td className="p-3">{b.total_duration} د</td>
                    <td className="p-3">{b.total_price} ر.س</td>
                    <td className="p-3" dir="ltr">{b.customer_phone}</td>
                    <td className="p-3">
                      <a href={b.location_url} target="_blank" rel="noopener noreferrer" className="text-salon-accent underline">خريطة</a>
                    </td>
                    <td className="p-3">
                      {b.door_image_url ? (
                        <img src={b.door_image_url} alt="باب" className="h-12 w-12 rounded-lg object-cover" />
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${b.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {PAYMENT_LABELS[b.payment_status as PaymentStatus]}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{VISIT_STATUS_LABELS[b.visit_status ?? "scheduled"]}</td>
                    <td className="p-3 min-w-[140px]">
                      <input
                        type="datetime-local"
                        className="mb-1 w-full rounded border border-salon-blush px-1 py-0.5 text-xs"
                        defaultValue={b.start_time.slice(0, 16)}
                        onBlur={(e) => {
                          if (e.target.value) reschedule(b.id, new Date(e.target.value).toISOString());
                        }}
                      />
                      <select
                        className="w-full rounded border border-salon-blush px-1 py-0.5 text-xs"
                        value={b.therapist_id}
                        onChange={(e) => transfer(b.id, Number(e.target.value))}
                      >
                        {therapists.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-center">{b.therapist_id ?? "—"}</td>
                    <td className="p-3">
                      <select
                        value={b.status}
                        onChange={(e) => updateStatus(b.id, e.target.value as BookingStatus)}
                        className="rounded-lg border border-salon-blush bg-white px-2 py-1 text-xs"
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => removeBooking(b.id)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
