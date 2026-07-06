"use client";

import { useEffect, useState } from "react";
import { asArray } from "@/lib/arrays";
import { useCart } from "@/lib/cart-context";
import type { CartItem, CatalogService, ServiceAddon } from "@/lib/types";
import { cartHasBrideService, isBrideService } from "@/lib/service-helpers";
import { riyadhDateKey } from "@/lib/scheduling";

interface SlotOption {
  iso: string;
  timeFormatted: string;
  therapistId: number;
}

function Counter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-sm-muted">{label}</span>
      <button
        type="button"
        className="btn-secondary h-9 w-9 p-0"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="إنقاص"
      >
        −
      </button>
      <span className="w-8 text-center font-medium">{value}</span>
      <button
        type="button"
        className="btn-secondary h-9 w-9 p-0"
        onClick={() => onChange(value + 1)}
        aria-label="زيادة"
      >
        +
      </button>
    </div>
  );
}

interface Props {
  service: CatalogService;
  addons: ServiceAddon[];
  catalog: CatalogService[];
  cart: CartItem[];
  onConfirm: (item: Omit<CartItem, "lineId" | "region">) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

export default function ServiceAddPanel({
  service,
  addons,
  catalog,
  cart,
  onConfirm,
  onError,
  onCancel,
}: Props) {
  const { region, openDrawer } = useCart();
  const bride = isBrideService(service);
  const [quantity, setQuantity] = useState(1);
  const [companions, setCompanions] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [minDate, setMinDate] = useState(riyadhDateKey());
  const [maxDate, setMaxDate] = useState("");

  const massageAddons = addons.filter((a) => a.categories.includes("massage"));
  const hasAddons = Boolean(service.optional_addons && massageAddons.length > 0);

  useEffect(() => {
    if (!region || !selectedDate) {
      setSlots([]);
      setSelectedSlot(null);
      setTherapistId(null);
      return;
    }

    const draft: Omit<CartItem, "lineId" | "region"> = {
      serviceId: service.id,
      peopleCount: bride ? 1 : quantity,
      addonIds: selectedAddons,
      companionsCount: bride ? companions : undefined,
    };

    setLoadingSlots(true);
    setSelectedSlot(null);
    setTherapistId(null);

    fetch("/api/available-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, date: selectedDate, item: draft }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSlots(
          asArray<{ iso: string; timeFormatted: string; therapistId: number }>(data.slots).map(
            (s) => ({
              iso: s.iso,
              timeFormatted: s.timeFormatted,
              therapistId: s.therapistId,
            }),
          ),
        );
        if (data.minDate) setMinDate(data.minDate);
        if (data.maxDate) setMaxDate(data.maxDate);
      })
      .catch((e) => {
        onError(e instanceof Error ? e.message : "تعذّر تحميل الأوقات");
        setSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [region, selectedDate, quantity, companions, selectedAddons, service.id, bride, onError]);

  const handleAdd = () => {
    if (bride && cartHasBrideService(cart, catalog)) {
      onError("لا يُسمح بأكثر من خدمة عروس في نفس الحجز");
      return;
    }
    if (!region) {
      onError("حدّدي المنطقة من سلة التسوق أولاً");
      openDrawer();
      return;
    }
    if (!selectedDate) {
      onError("اختاري التاريخ");
      return;
    }
    if (!selectedSlot || !therapistId) {
      onError("اختاري الوقت");
      return;
    }

    onConfirm({
      serviceId: service.id,
      peopleCount: bride ? 1 : quantity,
      addonIds: selectedAddons,
      companionsCount: bride ? companions : undefined,
      selectedDate,
      startTime: selectedSlot,
      therapistId,
    });
  };

  return (
    <div className="w-full space-y-6 border-t border-sm-border pt-6">
      {bride ? (
        <Counter
          label="عدد المرافقات (اختياري)"
          value={companions}
          min={0}
          onChange={setCompanions}
        />
      ) : (
        <Counter label="العدد" value={quantity} min={1} onChange={setQuantity} />
      )}

      {hasAddons && (
        <div className="flex flex-wrap gap-2">
          {massageAddons.map((a) => (
            <label
              key={a.id}
              className={`cursor-pointer border px-3 py-2 text-sm ${
                selectedAddons.includes(a.id)
                  ? "border-sm-text bg-sm-text text-white"
                  : "border-sm-border"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedAddons.includes(a.id)}
                onChange={(e) => {
                  setSelectedAddons((prev) =>
                    e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                  );
                }}
              />
              {a.name} +{a.price}
            </label>
          ))}
        </div>
      )}

      {!region && (
        <p className="text-sm text-sm-muted">
          حدّدي المنطقة من{" "}
          <button type="button" className="underline" onClick={openDrawer}>
            سلة التسوق
          </button>{" "}
          قبل اختيار التاريخ والوقت.
        </p>
      )}

      <div>
        <label className="label" htmlFor={`date-${service.id}`}>
          التاريخ
        </label>
        <input
          id={`date-${service.id}`}
          type="date"
          className="input-field"
          min={minDate}
          max={maxDate || undefined}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={!region}
        />
      </div>

      {region && selectedDate && (
        <div>
          <p className="label">الوقت</p>
          {loadingSlots && (
            <p className="text-sm text-sm-muted">جاري حساب الأوقات المتاحة...</p>
          )}
          {!loadingSlots && slots.length === 0 && (
            <p className="text-sm text-sm-muted">لا توجد أوقات متاحة في هذا اليوم</p>
          )}
          {!loadingSlots && slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(s.iso);
                    setTherapistId(s.therapistId);
                  }}
                  className={`border px-4 py-2 text-sm ${
                    selectedSlot === s.iso
                      ? "border-sm-text bg-sm-text text-white"
                      : "border-sm-border hover:border-sm-text"
                  }`}
                >
                  {s.timeFormatted}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={handleAdd}>
          إضافة للسلة
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
