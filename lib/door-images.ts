/**
 * صيانة صور أبواب العميلات — حذف بعد انتهاء الموعد
 */

import type { BookingWithServices } from "./types";

export function purgeExpiredDoorImages(
  bookings: BookingWithServices[],
  retentionDays: number,
): number {
  if (retentionDays <= 0) return 0;

  const cutoffMs = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let purged = 0;

  for (const booking of bookings) {
    if (!booking.door_image_url) continue;
    const endedAt = new Date(booking.end_time).getTime();
    if (Number.isNaN(endedAt)) continue;
    if (now - endedAt >= cutoffMs) {
      booking.door_image_url = null;
      purged += 1;
    }
  }

  return purged;
}
