"use client";

import { useState } from "react";
import type { CartItem, CatalogService, ServiceAddon, ServiceCategory } from "@/lib/types";
import { CATEGORY_EMOJI, CATEGORY_LABELS } from "@/lib/types";
import { getServiceDisplayPrice } from "@/lib/pricing";

/** ترتيب الأقسام — الأظافر والمكياج والشعر أولاً */
const CATEGORIES: ServiceCategory[] = ["nails", "makeup", "hair", "massage"];

interface Props {
  services: CatalogService[];
  addons: ServiceAddon[];
  onAddToCart: (item: Omit<CartItem, "lineId">) => void;
}

export default function ServiceCatalog({ services, addons, onAddToCart }: Props) {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("nails");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [peopleCount, setPeopleCount] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const visibleCategories = CATEGORIES.filter((cat) =>
    services.some((s) => s.category === cat),
  );

  const catServices = services.filter((s) => s.category === activeCategory);
  const massageAddons = addons.filter((a) => a.categories.includes("massage"));

  const resetForm = () => {
    setPeopleCount(1);
    setSelectedAddons([]);
    setExpandedId(null);
  };

  const handleAdd = (service: CatalogService) => {
    if (service.pricing_model === "custom") {
      return;
    }

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
    resetForm();
  };

  const artist = catServices.find((s) => s.artist)?.artist;
  const instagram = catServices.find((s) => s.instagram)?.instagram;

  return (
    <div className="space-y-4">
      {/* أقسام الخدمات — اضغطي على القسم */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visibleCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setActiveCategory(cat);
              resetForm();
            }}
            className={`rounded-2xl border-2 px-3 py-4 text-center transition ${
              activeCategory === cat
                ? "border-salon-accent bg-salon-accent text-white shadow-md"
                : "border-salon-blush bg-white hover:border-salon-rose"
            }`}
          >
            <div className="text-2xl">{CATEGORY_EMOJI[cat]}</div>
            <div className="mt-1 text-sm font-bold">{CATEGORY_LABELS[cat]}</div>
          </button>
        ))}
      </div>

      {/* خدمات القسم المختار */}
      <div className="card">
        <div className="mb-4 flex flex-wrap items-baseline gap-2 border-b border-salon-blush pb-3">
          <h2 className="text-lg font-bold">
            {CATEGORY_EMOJI[activeCategory]} {CATEGORY_LABELS[activeCategory]}
          </h2>
          {artist && (
            <span className="text-sm text-salon-mauve">
              {artist}
              {instagram && (
                <span dir="ltr" className="mr-1 text-salon-accent"> @{instagram}</span>
              )}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {catServices.map((s) => {
            const isExpanded = expandedId === s.id;
            const isCustom = s.pricing_model === "custom";
            const needsOptions =
              s.pricing_model === "tiered_people" || s.optional_addons;

            return (
              <div
                key={s.id}
                className={`rounded-xl border p-3 transition ${
                  isExpanded ? "border-salon-accent bg-salon-blush/40" : "border-salon-blush"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {s.pricing_model === "bundle" && (
                        <span className="rounded-full bg-salon-accent/20 px-2 py-0.5 text-xs text-salon-accent">
                          باقة
                        </span>
                      )}
                      {s.requires_deposit && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          عربون
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-salon-mauve">
                      {getServiceDisplayPrice(s)} · {s.duration_minutes} د
                    </p>
                    {s.bundle_includes && (
                      <p className="text-xs text-salon-accent">
                        {s.bundle_includes.join(" + ")}
                      </p>
                    )}
                  </div>

                  {!isCustom && (
                    <button
                      type="button"
                      className="btn-primary shrink-0 px-4 py-2 text-sm"
                      onClick={() => handleAdd(s)}
                    >
                      {needsOptions && !isExpanded ? "اختيار" : "+ أضيفي"}
                    </button>
                  )}
                </div>

                {isExpanded && needsOptions && (
                  <div className="mt-3 space-y-3 border-t border-salon-blush pt-3">
                    {s.pricing_model === "tiered_people" && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm">عدد الأشخاص:</span>
                        <button
                          type="button"
                          className="btn-secondary h-8 w-8 rounded-full p-0 text-sm"
                          onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-bold">{peopleCount}</span>
                        <button
                          type="button"
                          className="btn-secondary h-8 w-8 rounded-full p-0 text-sm"
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
                            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                              selectedAddons.includes(a.id)
                                ? "border-salon-accent bg-salon-blush"
                                : "border-salon-blush"
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
                      className="btn-primary w-full py-2 text-sm"
                      onClick={() => handleAdd(s)}
                    >
                      ✓ أضيفي للسلة
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
