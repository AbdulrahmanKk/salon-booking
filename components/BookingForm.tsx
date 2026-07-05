"use client";

import { useCallback, useEffect, useState } from "react";
import { asArray } from "@/lib/arrays";
import type {
  AvailableSlot,
  CartItem,
  CatalogService,
  CustomerPackage,
  PricingResult,
  Region,
  SalonSettings,
  ServiceAddon,
} from "@/lib/types";
import { REGION_LABELS } from "@/lib/types";
import { compressImage } from "@/lib/image-compress";
import PromoCheckout, { emptyPromo, promoToInput } from "./PromoCheckout";
import ServiceCatalog from "./ServiceCatalog";
import ShoppingCart from "./ShoppingCart";
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

export default function BookingForm() {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [region, setRegion] = useState<Region | "">("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [doorFile, setDoorFile] = useState<File | null>(null);
  const [doorPreview, setDoorPreview] = useState<string | null>(null);

  const [cartPricing, setCartPricing] = useState<PricingResult | null>(null);
  const [slotPreview, setSlotPreview] = useState<SlotPreview | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [confirmedLabel, setConfirmedLabel] = useState("");
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [promo, setPromo] = useState(emptyPromo);
  const [walletBalance, setWalletBalance] = useState(0);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [loyaltyInfo, setLoyaltyInfo] = useState({
    sessions: 0,
    discount: 0,
    untilNext: null as number | null,
    nextDiscount: null as number | null,
  });

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        setServices(asArray<CatalogService>(data.services ?? data));
        setAddons(asArray<ServiceAddon>(data.addons));
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => setError("تعذّر تحميل الخدمات"));

    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.loggedIn && data.account) {
          setPhone(data.account.phone);
          setName(data.account.name ?? "");
          setWalletBalance(data.account.wallet_balance);
          setCustomerPackages(data.account.packages ?? []);
          setLoyaltyInfo({
            sessions: data.account.loyalty.massage_sessions,
            discount: data.account.loyalty.current_discount_percent,
            untilNext: data.account.loyalty.sessions_until_next,
            nextDiscount: data.account.loyalty.next_tier?.discountPercent ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  const addToCart = (item: Omit<CartItem, "lineId">) => {
    setCart((prev) => [...prev, { ...item, lineId: newLineId() }]);
    setSlotPreview(null);
    setSelectedSlot(null);
  };

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
    setSlotPreview(null);
    setSelectedSlot(null);
  };

  const updateCartCount = (lineId: string, peopleCount: number) => {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, peopleCount } : c)));
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
        body: JSON.stringify({
          cart,
          region: region || undefined,
          promo: promoToInput(promo),
          phone: phone || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) setCartPricing(data);
    } catch {
      /* ignore */
    }
  }, [cart, region, promo, phone]);

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
        body: JSON.stringify({
          region,
          cart,
          promo: promoToInput(promo),
          phone: phone || undefined,
        }),
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
  }, [region, cart, promo, phone]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDoorFile(file);
    try {
      const compressed = await compressImage(file);
      setDoorPreview(compressed);
    } catch {
      setDoorPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!cart.length || !region || !name.trim() || !locationUrl || !phone) {
      setError("عبّي الخدمات والمنطقة وبياناتكِ");
      return;
    }
    if (!selectedSlot) {
      setError("اختاري وقتاً من الأوقات المتاحة");
      return;
    }
    setSubmitting(true);
    try {
      const doorImageUrl = doorPreview ?? (doorFile ? await compressImage(doorFile) : undefined);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          locationUrl,
          customerNotes,
          region,
          doorImageUrl,
          cart,
          startTime: selectedSlot,
          therapistId: selectedTherapistId,
          promo: promoToInput(promo),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const slot = asArray<AvailableSlot>(slotPreview?.slots).find((s) => s.iso === selectedSlot);
      setConfirmedLabel(slot?.dateTimeFormatted ?? "");
      setBookingId(data.booking.id);
      setRequiresDeposit(data.booking.requires_deposit);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحجز");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!bookingId) {
      setError("معرّف الحجز مفقود — أعيدي الحجز من البداية");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/payment/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التأكيد");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="card text-center">
        <div className="mb-4 text-5xl">✓</div>
        <h2 className="mb-2 text-2xl font-bold text-soft-accent">
          {requiresDeposit ? "تم الحجز — بانتظار العربون" : "تم الحجز بنجاح!"}
        </h2>
        <p className="text-salon-mauve">{confirmedLabel}</p>
        {requiresDeposit && settings && (
          <p className="mt-2 text-sm text-amber-800">{settings.depositNote}</p>
        )}
        <p className="mt-2 text-sm">سنتواصل معكِ {name} على {phone}</p>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="card space-y-4">
        <h2 className="text-xl font-bold">تأكيد الحجز</h2>
        <p className="text-salon-mauve">
          الموعد: <strong>{confirmedLabel}</strong>
        </p>
        <p className="text-salon-mauve">
          الإجمالي: <strong>{cartPricing?.finalTotal ?? cartPricing?.totalPrice} ر.س</strong>
        </p>
        <p className="rounded-xl bg-soft-blush/50 p-3 text-sm text-salon-text">
          {requiresDeposit
            ? "بانتظار العربون — اضغطي تأكيد للمتابعة"
            : "اضغطي تأكيد لإتمام الحجز"}
        </p>
        <button type="button" className="btn-primary w-full" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "جاري التأكيد..." : requiresDeposit ? "✓ تم / بانتظار العربون" : "✓ تأكيد الحجز"}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* الخدمات */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ServiceCatalog services={services} addons={addons} onAddToCart={addToCart} />
        <ShoppingCart
          cart={cart}
          services={services}
          addons={addons}
          pricing={cartPricing}
          onRemove={removeFromCart}
          onUpdateCount={updateCartCount}
        />
      </div>

      {cart.length > 0 && (
        <>
          {/* المنطقة */}
          <section className="card">
            <h2 className="mb-3 font-bold">وين موقعكِ؟</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRegion(r);
                    setSlotPreview(null);
                    setSelectedSlot(null);
                  }}
                  className={`rounded-xl border-2 py-3 font-medium transition ${
                    region === r
                      ? "border-soft-accent bg-soft-accent text-white"
                      : "border-salon-blush bg-white"
                  }`}
                >
                  {REGION_LABELS[r]}
                </button>
              ))}
            </div>
          </section>

          {/* بيانات العميلة */}
          <section className="card space-y-4">
            <h2 className="font-bold">بياناتكِ</h2>
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div>
              <label className="mb-1 block text-sm text-salon-mauve">صورة الباب (اختياري)</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="input-field" />
              {doorPreview && (
                <img src={doorPreview} alt="باب" className="mt-2 max-h-32 rounded-xl object-cover" />
              )}
            </div>
          </section>

          <PromoCheckout
            promo={promo}
            onChange={setPromo}
            walletBalance={walletBalance}
            packages={customerPackages}
            loyaltySessions={loyaltyInfo.sessions}
            loyaltyDiscount={loyaltyInfo.discount}
            sessionsUntilNext={loyaltyInfo.untilNext}
            nextDiscount={loyaltyInfo.nextDiscount}
          />

          {loadingSlots && (
            <div className="card text-center text-sm text-salon-mauve">جاري حساب الأوقات...</div>
          )}
          {slotPreview && !loadingSlots && (
            <section className="card">
              <h2 className="mb-3 font-bold">اختاري الوقت</h2>
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
            className="btn-primary w-full text-lg"
            onClick={handleSubmit}
            disabled={submitting || !selectedSlot || !region}
          >
            {submitting ? "جاري الحفظ..." : "احجزي الآن"}
          </button>
        </>
      )}

      {cart.length === 0 && (
        <p className="text-center text-salon-mauve text-sm">
          اختاري قسماً من الأعلى ثم أضيفي الخدمات للسلة
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}
    </div>
  );
}
