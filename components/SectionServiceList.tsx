"use client";

import { useState } from "react";
import type { CartItem, CatalogService, ServiceAddon } from "@/lib/types";
import { getServiceDisplayPrice, formatTierLabel } from "@/lib/pricing";

interface Props {
  services: CatalogService[];
  addons: ServiceAddon[];
  onAddToCart: (item: Omit<CartItem, "lineId">) => void;
}

export default function SectionServiceList({ services, addons, onAddToCart }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [peopleCount, setPeopleCount] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const massageAddons = addons.filter((a) => a.categories.includes("massage"));

  const reset = () => {
    setPeopleCount(1);
    setSelectedAddons([]);
    setExpandedId(null);
  };

  const handleSelect = (service: CatalogService) => {
    const needsOptions =
      service.pricing_model === "tiered_people" || service.optional_addons;

    if (needsOptions && expandedId !== service.id) {
      setExpandedId(service.id);
      setPeopleCount(1);
      setSelectedAddons([]);
      return;
    }

    onAddToCart({
      serviceId: service.id,
      peopleCount: service.pricing_model === "tiered_people" ? peopleCount : 1,
      addonIds: selectedAddons,
    });
    reset();
  };

  return (
    <div className="divide-y divide-sm-border border-y border-sm-border">
      {services.map((s) => {
        const isExpanded = expandedId === s.id;
        const needsOptions =
          s.pricing_model === "tiered_people" || s.optional_addons;

        return (
          <div key={s.id} className="service-row">
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
              {s.notes && (
                <p className="mt-2 text-xs text-sm-muted">{s.notes}</p>
              )}
            </div>

            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => handleSelect(s)}
            >
              {needsOptions && !isExpanded ? "اختيار" : "إضافة"}
            </button>

            {isExpanded && needsOptions && (
              <div className="w-full space-y-4 border-t border-sm-border pt-4 sm:col-span-2">
                {s.pricing_model === "tiered_people" && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-sm-muted">عدد الأشخاص</span>
                    <button
                      type="button"
                      className="btn-secondary h-9 w-9 p-0"
                      onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-medium">{peopleCount}</span>
                    <button
                      type="button"
                      className="btn-secondary h-9 w-9 p-0"
                      onClick={() => setPeopleCount((n) => n + 1)}
                    >
                      +
                    </button>
                  </div>
                )}
                {s.optional_addons && massageAddons.length > 0 && (
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
                <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => handleSelect(s)}>
                  تأكيد الإضافة
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
