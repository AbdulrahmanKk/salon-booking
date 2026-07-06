import type { CartItem, CatalogService, ServiceAddon } from "./types";
import { isBrideService } from "./service-helpers";

/** دقائق إضافية لكل مرافقة مع العروس */
export const COMPANION_DURATION_MINUTES = 40;

export function computeCartItemDuration(
  item: CartItem,
  service: CatalogService,
  addons: ServiceAddon[],
): number {
  const count = Math.max(1, item.peopleCount);
  let duration = service.duration_minutes;

  for (const aid of item.addonIds) {
    const addon = addons.find((a) => a.id === aid);
    if (addon) duration += addon.duration_minutes;
  }

  if (service.pricing_model === "bundle" || service.pricing_model === "custom") {
    // مدة الباقة ثابتة
  } else if (service.pricing_model !== "tiered_people" && service.pricing_model !== "fixed") {
    duration *= count;
  } else if (service.pricing_model === "fixed" && !isBrideService(service)) {
    duration *= count;
  }

  const companions = item.companionsCount ?? 0;
  if (isBrideService(service) && companions > 0) {
    duration += companions * COMPANION_DURATION_MINUTES;
  }

  return duration;
}
