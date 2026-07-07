"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { asArray } from "@/lib/arrays";
import { bookingServiceCategories, logBookingCategorySnapshot, resolveLineCategory } from "@/lib/categories";
import { inferBookingScheduleGroup } from "@/lib/schedule-groups";
import type { BookingStatus, BookingWithServices, CatalogService, Region, ServiceCategory, ServiceSelection, Therapist } from "@/lib/types";
import { CATEGORY_LABELS, REGION_LABELS } from "@/lib/types";
import AdminBookingsTable from "./AdminBookingsTable";
import AdminPromotions from "./AdminPromotions";
import NotificationCenter from "./NotificationCenter";

const REGIONS: Region[] = ["north", "south", "east", "west"];

interface SlotOption {
  iso: string;
  timeFormatted: string;
  dateTimeFormatted: string;
  dateLabel: string;
}

type AdminTab = "bookings" | "promotions";

export default function AdminPanel() {
  const [bookings, setBookings] = useState<BookingWithServices[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<AdminTab>("bookings");
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

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
      const scope = showCompleted ? "completed" : "active";
      const [bRes, sRes, tRes] = await Promise.all([
        fetch(`/api/bookings?scope=${scope}`),
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
      setBookings(safeBookings);
      setServices(safeServices);
      setTherapists(asArray<Therapist>(tData.therapists));
      const init: Record<string, number> = {};
      safeServices.forEach((s) => {
        init[s.id] = 0;
      });
      setMQty(init);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [showCompleted]);

  useEffect(() => {
    load();
  }, [load]);

  const partitioned = useMemo(() => {
    const khulood: BookingWithServices[] = [];
    const sarah: BookingWithServices[] = [];
    const salon: BookingWithServices[] = [];
    for (const b of bookings) {
      const group = inferBookingScheduleGroup(b, services);
      if (group === "khulood") khulood.push(b);
      else if (group === "sarah") sarah.push(b);
      else salon.push(b);
    }
    const byTime = (a: BookingWithServices, c: BookingWithServices) =>
      new Date(a.start_time).getTime() - new Date(c.start_time).getTime();
    return {
      khulood: khulood.sort(byTime),
      sarah: sarah.sort(byTime),
      salon: salon.sort(byTime),
    };
  }, [bookings, services]);

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
    if (!res.ok) return;
    if (status === "completed" && !showCompleted) {
      setBookings((prev) => prev.filter((b) => b.id !== id));
      return;
    }
    if (status !== "completed" && showCompleted) {
      setBookings((prev) => prev.filter((b) => b.id !== id));
      return;
    }
    load();
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
    await load();
  };

  const hideBookingRow = async (id: string) => {
    if (!window.confirm("إخفاء هذا الحجز من الجدول؟")) return;
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "فشل الإخفاء");
        return;
      }
      setBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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
      setMName("");
      setMPhone("");
      setMLocation("");
      setMSelectedSlot("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setMSaving(false);
    }
  };

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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === "bookings" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("bookings")}
        >
          الحجوزات
        </button>
        <button
          type="button"
          className={tab === "promotions" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("promotions")}
        >
          العروض
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {tab === "promotions" ? (
        <AdminPromotions />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-salon-mauve">
              {showCompleted
                ? "الحجوزات المنتهية — يمكنك إرجاعها بتغيير الحالة"
                : "الحجوزات النشطة — اضغطي على التاريخ لإضافته إلى تقويم الجهاز"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowManual(true)}>
                إضافة حجز يدوي
              </button>
              <button
                type="button"
                className={showCompleted ? "btn-primary" : "btn-secondary"}
                onClick={() => setShowCompleted((v) => !v)}
              >
                {showCompleted ? "عرض النشطة" : "عرض المنتهية"}
              </button>
            </div>
          </div>

          {showManual && (
            <div className="card space-y-4 border-2 border-salon-accent/40">
              <h3 className="text-lg font-bold">إضافة حجز يدوي (هاتف)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className="input-field"
                  placeholder="الاسم"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="الجوال"
                  value={mPhone}
                  onChange={(e) => setMPhone(e.target.value)}
                  dir="ltr"
                />
                <input
                  className="input-field sm:col-span-2"
                  placeholder="رابط اللوكيشن"
                  value={mLocation}
                  onChange={(e) => setMLocation(e.target.value)}
                  dir="ltr"
                />
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
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-salon-blush p-2"
                  >
                    <span>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary h-8 w-8 rounded-full p-0"
                        onClick={() =>
                          setMQty((q) => ({ ...q, [s.id]: Math.max(0, (q[s.id] ?? 0) - 1) }))
                        }
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{mQty[s.id] ?? 0}</span>
                      <button
                        type="button"
                        className="btn-secondary h-8 w-8 rounded-full p-0"
                        onClick={() => setMQty((q) => ({ ...q, [s.id]: (q[s.id] ?? 0) + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {mSlots.length > 0 && (
                <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
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
                <button type="button" className="btn-secondary" onClick={() => setShowManual(false)}>
                  إلغاء
                </button>
              </div>
            </div>
          )}

          <div className="space-y-10">
            <AdminBookingsTable
              title="جدول خلود (حجوزات المكياج — خلود الهداب)"
              bookings={partitioned.khulood}
              therapists={therapists}
              formatCategories={formatCategories}
              onReschedule={reschedule}
              onTransfer={transfer}
              onStatusChange={updateStatus}
              onHide={hideBookingRow}
              onDelete={removeBooking}
            />
            <AdminBookingsTable
              title="جدول سارة (حجوزات الشعر — سارة الهداب)"
              bookings={partitioned.sarah}
              therapists={therapists}
              formatCategories={formatCategories}
              onReschedule={reschedule}
              onTransfer={transfer}
              onStatusChange={updateStatus}
              onHide={hideBookingRow}
              onDelete={removeBooking}
            />
            <AdminBookingsTable
              title="جدول الصالون (حجوزات الأظافر والمساج)"
              bookings={partitioned.salon}
              therapists={therapists}
              formatCategories={formatCategories}
              onReschedule={reschedule}
              onTransfer={transfer}
              onStatusChange={updateStatus}
              onHide={hideBookingRow}
              onDelete={removeBooking}
            />
          </div>
        </>
      )}
    </div>
  );
}
