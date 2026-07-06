"use client";

import { useState } from "react";
import type { CartItem, CatalogService, ServiceAddon } from "@/lib/types";
import { getServiceDisplayPrice, formatTierLabel } from "@/lib/pricing";
import { isBrideService } from "@/lib/service-helpers";

interface Props {
  services: CatalogService[];
  addons: ServiceAddon[];
  cart: CartItem[];
  onAddToCart: (item: Omit<CartItem, "lineId">) => void;
  onAddError: (message: string) => void;
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

export default function SectionServiceList({
  services,
  addons,
  cart,
  onAddToCart,
  onAddError,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [companions, setCompanions] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const massageAddons = addons.filter((a) => a.categories.includes("massage"));

  const reset = () => {
    setQuantity(1);
    setCompanions(0);
    setSelectedAddons([]);
    setExpandedId(null);
  };

  const openPanel = (service: CatalogService) => {
    setExpandedId(service.id);
    setQuantity(1);
    setCompanions(0);
    setSelectedAddons([]);
  };

  const confirmAdd = (service: CatalogService) => {
    const bride = isBrideService(service);

    if (bride && cart.some((c) => {
      const svc = services.find((s) => s.id === c.serviceId);
      return svc && isBrideService(svc);
    })) {
      onAddError("لا يُسمح بأكثر من خدمة عروس في نفس الحجز");
      return;
    }

    const peopleCount = bride
      ? 1
      : service.pricing_model === "tiered_people"
        ? quantity
        : quantity;

    onAddToCart({
      serviceId: service.id,
      peopleCount,
      addonIds: selectedAddons,
      companionsCount: bride ? companions : undefined,
    });
    reset();
  };

  return (
    <div className="divide-y divide-sm-border border-y border-sm-border">
      {services.map((s) => {
        const isExpanded = expandedId === s.id;
        const bride = isBrideService(s);
        const hasAddons = Boolean(s.optional_addons && massageAddons.length > 0);

        return (
          <div key={s.id} className="service-row flex-col items-stretch">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-medium">{s.name}</h3>
                <p className="mt-1 text-sm text-sm-muted">
                  {s.pricing_model === "tiered_people" && s.tiered_prices
                    ? formatTierLabel(s.tiered_prices)
                    : getServiceDisplayPrice(s)}
                  {s.duration_minutes ? ` · ${s.duration_minutes} دقيقة` : ""}
                </p>
                {s.bundle_includes && (
                  <p className="mt-2 text-xs text-sm-muted">{s.bundle_includes.join(" · ")}</p>
                )}
                {s.notes && <p className="mt-2 text-xs text-sm-muted">{s.notes}</p>}
              </div>

              <button
                type="button"
                className="btn-secondary shrink-0 self-start sm:self-center"
                onClick={() => (isExpanded ? reset() : openPanel(s))}
              >
                {isExpanded ? "إلغاء" : "إضافة"}
              </button>
            </div>

            {isExpanded && (
              <div className="w-full space-y-4 border-t border-sm-border pt-4">
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
                              e.target.checked
                                ? [...prev, a.id]
                                : prev.filter((id) => id !== a.id),
                            );
                          }}
                        />
                        {a.name} +{a.price}
                      </label>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => confirmAdd(s)}
                >
                  إضافة للسلة
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
