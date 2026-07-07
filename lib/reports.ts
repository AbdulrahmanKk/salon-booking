/**
 * تقارير وتحليلات سوفت مومنت
 */

import { phonesMatch } from "./customer";
import type {
  BookingRating,
  BookingWithServices,
  Region,
  ReportsSummary,
  Therapist,
} from "./types";
import { REGION_LABELS } from "./types";

const RIYADH_TZ = "Asia/Riyadh";

function dateKeyRiyadh(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: RIYADH_TZ });
}

function monthKeyRiyadh(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: RIYADH_TZ }).slice(0, 7);
}

export function computeDelayMinutes(booking: BookingWithServices): number | null {
  const arrived = booking.visit_timeline?.arrived_at;
  if (!arrived) return null;
  const scheduled = new Date(booking.start_time).getTime();
  const actual = new Date(arrived).getTime();
  const diff = Math.round((actual - scheduled) / 60_000);
  return diff > 5 ? diff : null;
}

export function buildReports(
  bookings: BookingWithServices[],
  ratings: BookingRating[],
  therapists: Therapist[],
): ReportsSummary {
  const today = dateKeyRiyadh(new Date().toISOString());
  const month = monthKeyRiyadh(new Date().toISOString());

  const active = bookings.filter((b) => b.status !== "cancelled");
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const revenueToday = bookings
    .filter((b) => dateKeyRiyadh(b.start_time) === today && b.status !== "cancelled")
    .reduce((s, b) => s + (b.final_price ?? b.total_price), 0);

  const revenueMonth = bookings
    .filter((b) => monthKeyRiyadh(b.start_time) === month && b.status !== "cancelled")
    .reduce((s, b) => s + (b.final_price ?? b.total_price), 0);

  const serviceCounts = new Map<string, number>();
  for (const b of active) {
    for (const line of b.services) {
      serviceCounts.set(line.name, (serviceCounts.get(line.name) ?? 0) + 1);
    }
  }
  const topServices = Array.from(serviceCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const regionCounts = new Map<Region, number>();
  for (const b of active) {
    regionCounts.set(b.region, (regionCounts.get(b.region) ?? 0) + 1);
  }
  const topRegions = Array.from(regionCounts.entries())
    .map(([region, count]) => ({ region, label: REGION_LABELS[region], count }))
    .sort((a, b) => b.count - a.count);

  const therapistCounts = new Map<number, number>();
  for (const b of active) {
    therapistCounts.set(b.therapist_id, (therapistCounts.get(b.therapist_id) ?? 0) + 1);
  }
  const topTherapists = Array.from(therapistCounts.entries())
    .map(([id, count]) => ({
      id,
      name: therapists.find((t) => t.id === id)?.name ?? `ثيرابست ${id}`,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const phoneCounts = new Map<string, number>();
  for (const b of bookings) {
    phoneCounts.set(b.customer_phone, (phoneCounts.get(b.customer_phone) ?? 0) + 1);
  }
  const repeatCustomers = Array.from(phoneCounts.values()).filter((c) => c > 1).length;

  const ratedCount = ratings.length;
  const avgRating = ratedCount
    ? ratings.reduce((s, r) => s + r.stars, 0) / ratedCount
    : 0;

  const delayedVisits = bookings
    .map((b) => {
      const delay = computeDelayMinutes(b);
      if (delay === null) return null;
      return { bookingId: b.id, customerName: b.customer_name, delayMinutes: delay };
    })
    .filter(Boolean) as ReportsSummary["delayedVisits"];

  return {
    totalBookings: bookings.length,
    completedBookings: completed.length,
    cancelledBookings: cancelled.length,
    cancellationRate: bookings.length ? Math.round((cancelled.length / bookings.length) * 100) : 0,
    revenueToday,
    revenueMonth,
    avgRating: Math.round(avgRating * 10) / 10,
    ratedCount,
    topServices,
    topRegions,
    topTherapists,
    repeatCustomers,
    delayedVisits: delayedVisits.sort((a, b) => b.delayMinutes - a.delayMinutes).slice(0, 10),
  };
}

export function getBookingsForTherapistToday(
  bookings: BookingWithServices[],
  therapistId: number,
): BookingWithServices[] {
  const today = dateKeyRiyadh(new Date().toISOString());
  return bookings
    .filter(
      (b) =>
        b.therapist_id === therapistId &&
        dateKeyRiyadh(b.start_time) === today &&
        b.status !== "cancelled" &&
        b.deleted !== true &&
        b.hidden !== true &&
        b.status !== "completed",
    )
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export function phonesMatchBookings(
  bookings: BookingWithServices[],
  phone: string,
): BookingWithServices[] {
  return bookings.filter((b) => phonesMatch(b.customer_phone, phone));
}
