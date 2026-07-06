"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { asArray } from "@/lib/arrays";
import type {
  AvailableSlot,
  CartItem,
  CatalogService,
  PricingResult,
  Region,
  ServiceAddon,
} from "@/lib/types";
import { REGION_LABELS } from "@/lib/types";
import type { SectionConfig } from "@/lib/sections";
import { isBrideService } from "@/lib/service-helpers";
import AddToCartToast from "./AddToCartToast";
import SectionServiceList from "./SectionServiceList";
import TimeSlotPicker from "./TimeSlotPicker";

interface SlotPreview extends PricingResult {
  slots: AvailableSlot[];
  earliestAfterLast: string | null;
  travelFromLastMinutes: number | null;
}

const REGIONS: Region[] = ["north", "south", "east", "west"];

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Props {
  section: SectionConfig;
}

export default function SectionBookingForm({ section }: Props) {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [region, setRegion] = useState<Region | "">("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [cartPricing, setCartPricing] = useState<PricingResult | null>(null);
  const [slotPreview, setSlotPreview] = useState<SlotPreview | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState<"form" | "done">("form");
  const [confirmedLabel, setConfirmedLabel] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });
  const cartRef = useRef<HTMLElement>(null);

  const sectionServices = services.filter((s) =>
    section.categories.includes(s.category),
  );

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        setServices(asArray<CatalogService>(data.services ?? data));
        setAddons(asArray<ServiceAddon>(data.addons));
      })
      .catch(() => setError("تعذّر تحميل الخدمات"));
  }, []);

  const addToCart = (item: Omit<CartItem, "lineId">) => {
    const svc = services.find((s) => s.id === item.serviceId);
    setCart((prev) => [...prev, { ...item, lineId: newLineId() }]);
    setSlotPreview(null);
    setSelectedSlot(null);
    setToast({
      visible: true,
      message: svc ? `تمت إضافة «${svc.name}» إلى السلة` : "تمت الإضافة إلى السلة",
    });
    requestAnimationFrame(() => {
      cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const showAddError = (message: string) => {
    setToast({ visible: true, message });
  };

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
    setSlotPreview(null);
    setSelectedSlot(null);
  };

  const fetchCartPricing = useCallback(async () => {
    if (!cart.length) {
      setCartPricing(null);
      return;
    }
    try {
      const res = await fetch("/api/cart/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, region: region || undefined }),
      });
      const data = await res.json();
      if (res.ok) setCartPricing(data);
    } catch {
      /* ignore */
    }
  }, [cart, region]);

  useEffect(() => {
    const t = setTimeout(fetchCartPricing, 300);
    return () => clearTimeout(t);
  }, [fetchCartPricing]);

  const fetchSlots = useCallback(async () => {
    if (!region || !cart.length) return;
    setLoadingSlots(true);
    setError("");
    try {
      const res = await fetch("/api/available-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, cart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlotPreview({
        ...data,
        slots: asArray<AvailableSlot>(data.slots),
      });
      setSelectedSlot(null);
      setSelectedTherapistId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
      setSlotPreview(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [region, cart]);

  useEffect(() => {
    if (region && cart.length) {
      const t = setTimeout(fetchSlots, 400);
      return () => clearTimeout(t);
    }
  }, [region, cart, fetchSlots]);

  const handleSlotSelect = (iso: string | null) => {
    setSelectedSlot(iso);
    if (!iso) {
      setSelectedTherapistId(null);
      return;
    }
    const slot = asArray<AvailableSlot>(slotPreview?.slots).find((s) => s.iso === iso);
    setSelectedTherapistId(slot?.therapistId ?? null);
  };

  const handleSubmit = async () => {
    setError("");
    if (!cart.length || !region || !name.trim() || !locationUrl || !phone) {
      setError("يرجى تعبئة الخدمة والمنطقة وبيانات التواصل");
      return;
    }
    if (!selectedSlot) {
      setError("يرجى اختيار وقت من المواعيد المتاحة");
      return;
    }
    setSubmitting(true);
    try {
      const companionNotes = cart
        .filter((item) => (item.companionsCount ?? 0) > 0)
        .map((item) => {
          const svc = services.find((s) => s.id === item.serviceId);
          return `${svc?.name ?? item.serviceId}: ${item.companionsCount} مرافقة`;
        })
        .join(" · ");
      const notesCombined = [customerNotes.trim(), companionNotes].filter(Boolean).join("\n");

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          locationUrl,
          customerNotes: notesCombined || undefined,
          region,
          cart,
          startTime: selectedSlot,
          therapistId: selectedTherapistId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const slot = asArray<AvailableSlot>(slotPreview?.slots).find((s) => s.iso === selectedSlot);
      setConfirmedLabel(slot?.dateTimeFormatted ?? "");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="mx-auto max-w-page px-6 py-20 text-center md:py-28">
        <h2 className="page-title">تم الحجز</h2>
        <p className="page-subtitle mt-4">{confirmedLabel}</p>
        <p className="mt-6 text-sm text-sm-muted">
          سنتواصل معكِ {name} على {phone}
        </p>
        <Link href="/" className="btn-primary mt-12 inline-flex">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-page px-6 py-12 md:py-16">
      <AddToCartToast
        message={toast.message}
        visible={toast.visible}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <Link href="/" className="btn-ghost mb-10 inline-block">
        ← الرئيسية
      </Link>

      <header className="mb-12">
        <h1 className="page-title">{section.title}</h1>
        <p className="page-subtitle">{section.subtitle}</p>
        <p className="mt-6 text-sm leading-relaxed text-sm-muted">{section.footnote}</p>
      </header>

      <section className="mb-16">
        <h2 className="mb-6 text-sm font-medium uppercase tracking-widest text-sm-muted">
          الخدمات والأسعار
        </h2>
        <SectionServiceList
          services={sectionServices}
          addons={addons}
          cart={cart}
          onAddToCart={addToCart}
          onAddError={showAddError}
        />
      </section>

      {cart.length > 0 && (
        <section
          ref={cartRef}
          className="mb-12 scroll-mt-24 border border-sm-border p-6 md:p-8"
        >
          <h2 className="mb-4 text-sm font-medium text-sm-muted">سلة التسوق</h2>
          <ul className="space-y-3">
            {cart.map((item) => {
              const svc = services.find((s) => s.id === item.serviceId);
              const bride = svc && isBrideService(svc);
              return (
                <li key={item.lineId} className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    {svc?.name}
                    {!bride && item.peopleCount > 1 ? ` × ${item.peopleCount}` : ""}
                    {bride && (item.companionsCount ?? 0) > 0
                      ? ` · ${item.companionsCount} مرافقة`
                      : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => removeFromCart(item.lineId)}
                  >
                    إزالة
                  </button>
                </li>
              );
            })}
          </ul>
          {cartPricing && (
            <p className="mt-6 border-t border-sm-border pt-4 text-lg">
              الإجمالي:{" "}
              <span className="font-medium">
                {cartPricing.finalTotal ?? cartPricing.totalPrice} ر.س
              </span>
            </p>
          )}
        </section>
      )}

      {cart.length > 0 && (
        <>
          <section className="mb-12">
            <h2 className="mb-4 text-sm font-medium text-sm-muted">المنطقة</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRegion(r);
                    setSlotPreview(null);
                    setSelectedSlot(null);
                  }}
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
          </section>

          <section className="mb-12 space-y-4">
            <h2 className="text-sm font-medium text-sm-muted">بيانات التواصل</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم"
              />
              <input
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>
            <input
              className="input-field"
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder="رابط الموقع (Google Maps)"
              dir="ltr"
            />
            <input
              className="input-field"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
            />
          </section>

          {loadingSlots && (
            <p className="mb-8 text-center text-sm text-sm-muted">جاري تحميل المواعيد...</p>
          )}
          {slotPreview && !loadingSlots && (
            <section className="mb-12">
              <h2 className="mb-4 text-sm font-medium text-sm-muted">اختيار الوقت</h2>
              <TimeSlotPicker
                slots={slotPreview.slots}
                selectedSlot={selectedSlot}
                onSelect={handleSlotSelect}
                earliestAfterLast={slotPreview.earliestAfterLast}
                travelFromLastMinutes={slotPreview.travelFromLastMinutes}
              />
            </section>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={handleSubmit}
            disabled={submitting || !selectedSlot || !region}
          >
            {submitting ? "جاري الحجز..." : "تأكيد الحجز"}
          </button>
        </>
      )}

      {error && (
        <p className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
