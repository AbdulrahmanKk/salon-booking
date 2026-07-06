import type { CatalogService } from "./types";

/** خدمة عروس: الاسم يحتوي «عروس» */
export function isBrideService(service: Pick<CatalogService, "name">): boolean {
  return service.name.includes("عروس");
}

/** هل السلة تحتوي خدمة عروس بالفعل؟ */
export function cartHasBrideService(
  cart: { serviceId: string }[],
  catalog: CatalogService[],
): boolean {
  return cart.some((item) => {
    const svc = catalog.find((s) => s.id === item.serviceId);
    return svc ? isBrideService(svc) : false;
  });
}
