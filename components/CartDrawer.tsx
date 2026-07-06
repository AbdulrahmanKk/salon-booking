"use client";

import { useEffect, useState } from "react";
import { asArray } from "@/lib/arrays";
import { useCart } from "@/lib/cart-context";
import type { CatalogService, PricingResult, Region } from "@/lib/types";
import { REGION_LABELS } from "@/lib/types";
import { isBrideService } from "@/lib/service-helpers";
import { formatDateTimeAr } from "@/lib/scheduling";

const REGIONS: Region[] = ["north", "south", "east", "west"];

export default function CartDrawer() {
  const { items, region, setRegion, removeItem, clearCart, drawerOpen, closeDrawer } = useCart();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [linePrices, setLinePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => setServices(asArray<CatalogService>(data.services ?? data)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!drawerOpen || !items.length || !region) {
      setLinePrices({});
      return;
    }
    const prices: Record<string, number> = {};
    Promise.all(
      items.map(async (item) => {
        const res = await fetch("/api/cart/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: [item], region }),
        });
        const data = (await res.json()) as PricingResult;
        if (res.ok) prices[item.lineId] = data.finalTotal ?? data.totalPrice;
      }),
    ).then(() => setLinePrices(prices));
  }, [drawerOpen, items, region]);

  const total = Object.values(linePrices).reduce((a, b) => a + b, 0);

  const handleCheckout = async () => {
    setError("");
    if (!region) {
      setError("اختاري المنطقة");
      return;
    }
    if (!name.trim() || !phone || !locationUrl) {
      setError("يرجى تعبئة الاسم والجوال ورابط الموقع");
      return;
    }
    for (const item of items) {
      if (!item.startTime) {
        setError("بعض الخدمات ناقصة الوقت — أزيليها وأضيفيها من جديد");
        return;
      }
    }

    setSubmitting(true);
    try {
      for (const item of items) {
        const companionNote =
          (item.companionsCount ?? 0) > 0
            ? `${services.find((s) => s.id === item.serviceId)?.name}: ${item.companionsCount} مرافقة`
            : "";
        const notes = [customerNotes.trim(), companionNote].filter(Boolean).join("\n");

        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: name,
            customerPhone: phone,
            locationUrl,
            customerNotes: notes || undefined,
            region,
            cart: [item],
            startTime: item.startTime,
            therapistId: item.therapistId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      clearCart();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="إغلاق"
        onClick={() => {
          closeDrawer();
          setDone(false);
        }}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-sm-border px-6 py-5">
          <h2 className="text-lg font-medium">سلة التسوق</h2>
          <button type="button" className="btn-ghost" onClick={closeDrawer}>
            إغلاق
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-xl font-light">تم تأكيد الحجز</p>
              <p className="text-sm text-sm-muted">سنتواصل معكِ قريباً</p>
            </div>
          ) : (
            <>
              <div className={items.length ? "mb-6 border-b border-sm-border pb-6" : ""}>
                <p className="label">المنطقة</p>
                <div className="grid grid-cols-2 gap-2">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegion(r)}
                      className={`border py-3 text-sm transition ${
                        region === r
                          ? "border-sm-text bg-sm-text text-white"
                          : "border-sm-border hover:border-sm-text"
                      }`}
                    >
                      {REGION_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-center text-sm text-sm-muted">السلة فارغة</p>
              ) : (
                <>
                  <ul className="space-y-4 border-b border-sm-border pb-6">
                    {items.map((item) => {
                      const svc = services.find((s) => s.id === item.serviceId);
                      const bride = svc && isBrideService(svc);
                      return (
                        <li key={item.lineId} className="text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">{svc?.name ?? item.serviceId}</span>
                            <button
                              type="button"
                              className="btn-ghost text-xs"
                              onClick={() => removeItem(item.lineId)}
                            >
                              إزالة
                            </button>
                          </div>
                          <p className="mt-1 text-sm-muted">
                            {item.startTime
                              ? formatDateTimeAr(new Date(item.startTime))
                              : "— لم يُحدد الوقت"}
                          </p>
                          {!bride && item.peopleCount > 1 && (
                            <p className="text-sm-muted">العدد: {item.peopleCount}</p>
                          )}
                          {bride && (item.companionsCount ?? 0) > 0 && (
                            <p className="text-sm-muted">مرافقات: {item.companionsCount}</p>
                          )}
                          {linePrices[item.lineId] != null && (
                            <p className="mt-1">{linePrices[item.lineId]} ر.س</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {total > 0 && (
                    <p className="mt-4 text-lg">
                      الإجمالي: <span className="font-medium">{total} ر.س</span>
                    </p>
                  )}

                  <div className="mt-8 space-y-4">
                    <h3 className="text-sm font-medium text-sm-muted">بيانات التواصل</h3>
                    <input
                      className="input-field"
                      placeholder="الاسم"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <input
                      className="input-field"
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <input
                      className="input-field"
                      placeholder="رابط الموقع (Google Maps)"
                      dir="ltr"
                      value={locationUrl}
                      onChange={(e) => setLocationUrl(e.target.value)}
                    />
                    <input
                      className="input-field"
                      placeholder="ملاحظات (اختياري)"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                    />
                  </div>

                  {error && (
                    <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {!done && items.length > 0 && (
          <div className="border-t border-sm-border p-6">
            <button
              type="button"
              className="btn-primary w-full"
              disabled={submitting}
              onClick={handleCheckout}
            >
              {submitting ? "جاري التأكيد..." : "تأكيد الحجز"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
