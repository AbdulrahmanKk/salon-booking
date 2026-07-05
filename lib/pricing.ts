/**
 * محرك التسعير — شرائح الأشخاص، زيادات المنطقة، التوصيل، الإضافات
 */

import { normalizeServiceCategory } from "./categories";
import type {
  CartItem,
  CatalogService,
  PriceTier,
  PricingResult,
  Region,
  SalonSettings,
  ServiceAddon,
  ServiceLine,
  ServiceSelection,
} from "./types";

export function getTierPrice(tiers: PriceTier[], peopleCount: number): number {
  const tier = tiers.find(
    (t) => peopleCount >= t.minPeople && (t.maxPeople === null || peopleCount <= t.maxPeople),
  );
  if (!tier) return tiers[tiers.length - 1]?.pricePerPerson ?? 0;
  return tier.pricePerPerson;
}

export function getRegionSurcharge(
  service: CatalogService,
  region: Region,
  settings: SalonSettings,
  peopleCount: number,
): number {
  if (!service.region_surcharge) return 0;
  if (service.region_surcharge === "makeup") {
    if (!settings.makeupSurchargeRegions.includes(region)) return 0;
    return settings.makeupRegionSurcharge * peopleCount;
  }
  if (service.region_surcharge === "hair") {
    if (!settings.hairSurchargeRegions.includes(region)) return 0;
    return settings.hairRegionSurcharge * peopleCount;
  }
  return 0;
}

function resolveLinePrice(
  service: CatalogService,
  peopleCount: number,
  addonIds: string[],
  addons: ServiceAddon[],
): { price: number; duration: number; addonNames: string[] } {
  let price = 0;
  let duration = service.duration_minutes;
  const addonNames: string[] = [];

  switch (service.pricing_model) {
    case "fixed":
      price = (service.price ?? 0) * peopleCount;
      break;
    case "tiered_people":
      price = getTierPrice(service.tiered_prices ?? [], peopleCount) * peopleCount;
      break;
    case "bundle":
    case "custom":
      price = service.bundle_price ?? service.price ?? 0;
      break;
  }

  for (const aid of addonIds) {
    const addon = addons.find((a) => a.id === aid);
    if (addon) {
      price += addon.price;
      duration += addon.duration_minutes;
      addonNames.push(addon.name);
    }
  }

  return { price, duration, addonNames };
}

export function calculateCartPricing(
  cart: CartItem[],
  catalog: CatalogService[],
  addons: ServiceAddon[],
  settings: SalonSettings,
  region?: Region,
): PricingResult {
  const lines: ServiceLine[] = [];
  let subtotal = 0;
  let regionSurchargeTotal = 0;
  let totalDuration = 0;
  let peopleCount = 0;
  let requiresDeposit = false;

  for (const item of cart) {
    const service = catalog.find((s) => s.id === item.serviceId && s.active !== false);
    if (!service) continue;

    const count = Math.max(1, item.peopleCount);
    const { price, duration, addonNames } = resolveLinePrice(
      service,
      count,
      item.addonIds,
      addons,
    );
    const surcharge = region ? getRegionSurcharge(service, region, settings, count) : 0;

    if (service.requires_deposit) requiresDeposit = true;
    peopleCount += count;
    subtotal += price;
    regionSurchargeTotal += surcharge;

    if (service.pricing_model === "bundle" || service.pricing_model === "custom") {
      totalDuration += duration;
    } else {
      totalDuration += duration * count;
    }

    const category = normalizeServiceCategory(service.category) ?? service.category;
    lines.push({
      service_id: service.id,
      category,
      quantity: service.pricing_model === "fixed" ? count : 1,
      people_count: count,
      name: service.name,
      price: price + surcharge,
      duration_minutes: duration,
      addon_names: addonNames.length ? addonNames : undefined,
      region_surcharge: surcharge > 0 ? surcharge : undefined,
    });
  }

  const deliveryFee = lines.length > 0 ? settings.deliveryFee : 0;
  const totalPrice = subtotal + regionSurchargeTotal + deliveryFee;

  return {
    lines,
    subtotal,
    regionSurchargeTotal,
    deliveryFee,
    totalPrice,
    totalDuration,
    peopleCount,
    requiresDeposit,
  };
}

/** تحويل اختيارات API القديمة */
export function calculateFromSelections(
  selections: ServiceSelection[],
  catalog: CatalogService[],
  addons: ServiceAddon[],
  settings: SalonSettings,
  region?: Region,
): PricingResult {
  const cart: CartItem[] = selections
    .filter((s) => s.quantity > 0 || (s.people_count ?? 0) > 0)
    .map((s, i) => ({
      lineId: `sel-${i}`,
      serviceId: s.service_id,
      peopleCount: s.people_count ?? s.quantity,
      addonIds: s.addon_ids ?? [],
    }));
  return calculateCartPricing(cart, catalog, addons, settings, region);
}

export function formatTierLabel(tiers: PriceTier[]): string {
  return tiers
    .map((t) => {
      if (t.maxPeople === null) return `${t.minPeople}+ أشخاص: ${t.pricePerPerson} ر.س/شخص`;
      if (t.minPeople === t.maxPeople) return `${t.minPeople} شخص: ${t.pricePerPerson} ر.س`;
      return `${t.minPeople}-${t.maxPeople}: ${t.pricePerPerson} ر.س/شخص`;
    })
    .join(" · ");
}

export function getServiceDisplayPrice(service: CatalogService, peopleCount = 1): string {
  switch (service.pricing_model) {
    case "fixed":
      return `${service.price} ر.س`;
    case "tiered_people":
      return `من ${getTierPrice(service.tiered_prices ?? [], peopleCount)} ر.س/شخص`;
    case "bundle":
      return `${service.bundle_price} ر.س`;
    case "custom":
      return "يُنسّق مع الإدارة";
    default:
      return "—";
  }
}
