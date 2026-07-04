/**
 * نظام الولاء — جلسات المساج والخصم التلقائي
 */

import type { LoyaltyTier, SalonSettings } from "./types";

export const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  { sessions: 3, discountPercent: 5 },
  { sessions: 6, discountPercent: 10 },
  { sessions: 10, discountPercent: 15 },
];

export function getLoyaltyDiscountPercent(
  completedSessions: number,
  tiers: LoyaltyTier[] = DEFAULT_LOYALTY_TIERS,
): number {
  const sorted = [...tiers].sort((a, b) => b.sessions - a.sessions);
  for (const tier of sorted) {
    if (completedSessions >= tier.sessions) return tier.discountPercent;
  }
  return 0;
}

export function getNextLoyaltyTier(
  completedSessions: number,
  tiers: LoyaltyTier[] = DEFAULT_LOYALTY_TIERS,
): { tier: LoyaltyTier; sessionsUntil: number } | null {
  const sorted = [...tiers].sort((a, b) => a.sessions - b.sessions);
  for (const tier of sorted) {
    if (completedSessions < tier.sessions) {
      return { tier, sessionsUntil: tier.sessions - completedSessions };
    }
  }
  return null;
}

export function countMassageSessionsInBooking(
  serviceIds: string[],
  catalogIds: string[],
): number {
  const massageIds = new Set(
    catalogIds.filter((id) => id.startsWith("massage-")),
  );
  return serviceIds.filter((id) => massageIds.has(id) || id.startsWith("massage-")).length;
}
