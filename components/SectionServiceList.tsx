"use client";

import { useState } from "react";
import type { CartItem, CatalogService, ServiceAddon } from "@/lib/types";
import { getServiceDisplayPrice, formatTierLabel } from "@/lib/pricing";
import ServiceAddPanel from "./ServiceAddPanel";

interface Props {
  services: CatalogService[];
  catalog: CatalogService[];
  addons: ServiceAddon[];
  cart: CartItem[];
  onAddToCart: (item: Omit<CartItem, "lineId">) => void;
  onAddError: (message: string) => void;
}

export default function SectionServiceList({
  services,
  catalog,
  addons,
  cart,
  onAddToCart,
  onAddError,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-sm-border border-y border-sm-border">
      {services.map((s) => {
        const isExpanded = expandedId === s.id;

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
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                {isExpanded ? "إلغاء" : "إضافة"}
              </button>
            </div>

            {isExpanded && (
              <ServiceAddPanel
                service={s}
                addons={addons}
                catalog={catalog}
                cart={cart}
                onConfirm={(item) => {
                  onAddToCart(item);
                  setExpandedId(null);
                }}
                onError={onAddError}
                onCancel={() => setExpandedId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
