import type { BookingWithServices, CatalogService, ServiceCategory, ServiceLine } from "./types";
import { CATEGORY_LABELS } from "./types";

const ENGLISH_CATEGORIES = new Set<ServiceCategory>(["nails", "massage", "makeup", "hair"]);

/** تحويل اسم القسم العربي أو أي alias إلى المفتاح الإنجليزي الموحّد */
export function normalizeServiceCategory(raw: string | undefined | null): ServiceCategory | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase() as ServiceCategory;
  if (ENGLISH_CATEGORIES.has(lower)) return lower;

  for (const [key, label] of Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][]) {
    if (trimmed === label || trimmed === key) return key;
  }
  return null;
}

export function resolveLineCategory(
  line: ServiceLine,
  catalog: CatalogService[],
): ServiceCategory | null {
  if (line.category) {
    return normalizeServiceCategory(line.category) ?? line.category;
  }
  const svc = catalog.find((s) => s.id === line.service_id);
  if (!svc) return null;
  return normalizeServiceCategory(svc.category) ?? svc.category;
}

export function bookingServiceCategories(
  booking: BookingWithServices,
  catalog: CatalogService[],
): ServiceCategory[] {
  const lines = booking.services ?? [];
  const cats = lines
    .map((line) => resolveLineCategory(line, catalog))
    .filter((c): c is ServiceCategory => c !== null);
  return Array.from(new Set(cats));
}

export function logBookingCategorySnapshot(
  stage: string,
  booking: Pick<BookingWithServices, "id" | "services">,
  catalog: CatalogService[],
): void {
  const lines = (booking.services ?? []).map((line) => {
    const svc = catalog.find((s) => s.id === line.service_id);
    const normalized = resolveLineCategory(line, catalog);
    return {
      service_id: line.service_id,
      line_category: line.category ?? null,
      catalog_category: svc?.category ?? null,
      normalized,
      mismatch:
        line.category != null &&
        svc != null &&
        normalizeServiceCategory(line.category) !== normalizeServiceCategory(svc.category),
    };
  });
  console.log(`[category] ${stage} | booking:`, booking.id, "| lines:", JSON.stringify(lines));
}
