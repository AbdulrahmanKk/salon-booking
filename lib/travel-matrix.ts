/**
 * جدول المسافات بين المناطق (وقت الطريق بالدقائق)
 * قابل للتعديل — لاحقاً يمكن استبداله بـ Google Maps Distance Matrix API
 */

import type { Region } from "./types";

/** من \ إلى — north | south | east | west */
export const TRAVEL_MATRIX: Record<Region, Record<Region, number>> = {
  north: { north: 25, south: 70, east: 60, west: 65 },
  south: { north: 70, south: 25, east: 60, west: 60 },
  east:  { north: 60, south: 60, east: 25, west: 70 },
  west:  { north: 65, south: 60, east: 70, west: 25 },
};

/**
 * وقت الطريق بالدقائق بين منطقتين
 */
export function getTravelMinutes(from: Region, to: Region): number {
  return TRAVEL_MATRIX[from][to];
}
