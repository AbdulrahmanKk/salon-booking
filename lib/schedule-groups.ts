import type { BookingForSchedule, BookingWithServices, CartItem, CatalogService, ScheduleGroup } from "./types";
import { asArray } from "./arrays";

/** كل مجموعة = تقويم مستقل (مزوّدة واحدة) */
export const SCHEDULE_GROUP_THERAPIST: Record<ScheduleGroup, number> = {
  khulood: 1,
  sarah: 2,
  "nails-massage": 3,
};

export const SCHEDULE_GROUP_LABELS: Record<ScheduleGroup, string> = {
  khulood: "خلود الهداب — مكياج",
  sarah: "سارة الهداب — هير ستايل",
  "nails-massage": "أظافر ومساج",
};

const SERVICE_GROUP: Record<string, ScheduleGroup> = {
  "makeup-bride": "khulood",
  "makeup-bride-hair": "khulood",
  "makeup-bride-full": "khulood",
  "makeup-evening": "khulood",
  "hair-bride": "sarah",
  "hair-evening": "sarah",
  "nail-manicure": "nails-massage",
  "nail-pedicure": "nails-massage",
  "nail-both": "nails-massage",
  "nail-color-basic": "nails-massage",
  "nail-color-ombre": "nails-massage",
  "massage-swedish": "nails-massage",
  "massage-relax": "nails-massage",
};

export function scheduleGroupForServiceId(serviceId: string, catalog?: CatalogService[]): ScheduleGroup | null {
  const svc = catalog?.find((s) => s.id === serviceId);
  if (svc?.schedule_group) return svc.schedule_group;
  const mapped = SERVICE_GROUP[serviceId];
  if (mapped) return mapped;
  if (svc?.category === "makeup") return "khulood";
  if (svc?.category === "hair") return "sarah";
  if (svc?.category === "nails" || svc?.category === "massage") return "nails-massage";
  return null;
}

export function resolveScheduleGroupFromCart(
  cart: CartItem[],
  catalog: CatalogService[],
): ScheduleGroup {
  const groups = new Set<ScheduleGroup>();
  for (const item of cart) {
    const g = scheduleGroupForServiceId(item.serviceId, catalog);
    if (g) groups.add(g);
  }
  if (groups.size === 0) throw new Error("لم تُحدَّد خدمات صالحة");
  if (groups.size > 1) throw new Error("اختيار خدمات من أقسام مختلفة غير مسموح في حجز واحد");
  return Array.from(groups)[0];
}

export function inferBookingScheduleGroup(
  booking: Pick<BookingWithServices, "schedule_group" | "therapist_id"> & {
    services?: { service_id: string }[];
  },
  catalog?: CatalogService[],
): ScheduleGroup {
  if (booking.schedule_group) return booking.schedule_group;
  for (const line of asArray<{ service_id: string }>(booking.services)) {
    const g = scheduleGroupForServiceId(line.service_id, catalog);
    if (g) return g;
  }
  if (booking.therapist_id === 1) return "khulood";
  if (booking.therapist_id === 2) return "sarah";
  return "nails-massage";
}

export function bookingsForScheduleGroup(
  bookings: BookingForSchedule[],
  group: ScheduleGroup,
  catalog?: CatalogService[],
): BookingForSchedule[] {
  return bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    if (b.schedule_group) return b.schedule_group === group;
    if (b.services?.length) {
      return inferBookingScheduleGroup(
        { schedule_group: b.schedule_group, services: b.services, therapist_id: b.therapist_id },
        catalog,
      ) === group;
    }
    if (group === "khulood" && b.therapist_id === 1) return true;
    if (group === "sarah" && b.therapist_id === 2) return true;
    if (group === "nails-massage" && b.therapist_id === 3) return true;
    return false;
  });
}
