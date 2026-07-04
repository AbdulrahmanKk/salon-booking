/**
 * العروض — أكواد الخصم، الباقات، المحفظة، كروت الرصيد
 */

import type {
  BalanceGiftCard,
  CartItem,
  CatalogService,
  CustomerPackage,
  DiscountCode,
  PricingAdjustments,
  PricingResult,
  SalonSettings,
  ServiceAddon,
} from "./types";
import { calculateCartPricing } from "./pricing";
import { getLoyaltyDiscountPercent } from "./loyalty";

export interface PromotionInput {
  phone?: string;
  massageSessionsCompleted?: number;
  discountCode?: string;
  customerPackageId?: string;
  balanceGiftCode?: string;
  useWallet?: boolean;
  walletBalance?: number;
}

export interface PromotionContext {
  discountCodes: DiscountCode[];
  customerPackages: CustomerPackage[];
  balanceGiftCards: BalanceGiftCard[];
  catalog: CatalogService[];
  settings: SalonSettings;
}

function findValidCode(codes: DiscountCode[], code: string): DiscountCode | null {
  const c = codes.find(
    (x) => x.active && x.code.toUpperCase() === code.toUpperCase().trim(),
  );
  if (!c) return null;
  if (c.expires_at && new Date(c.expires_at) < new Date()) return null;
  if (c.max_uses !== null && c.used_count >= c.max_uses) return null;
  return c;
}

function findBalanceGift(cards: BalanceGiftCard[], code: string): BalanceGiftCard | null {
  return (
    cards.find(
      (c) =>
        c.active &&
        c.balance_remaining > 0 &&
        c.code.toUpperCase() === code.toUpperCase().trim(),
    ) ?? null
  );
}

/** هل السلة تحتوي مساج؟ */
function cartHasMassage(cart: CartItem[], catalog: CatalogService[]): boolean {
  return cart.some((item) => {
    const svc = catalog.find((s) => s.id === item.serviceId);
    return svc?.category === "massage";
  });
}

/** أغلى سطر مساج في السلة */
function getMassageLinePrice(result: PricingResult, catalog: CatalogService[]): number {
  let max = 0;
  for (const line of result.lines) {
    const svc = catalog.find((s) => s.id === line.service_id);
    if (svc?.category === "massage") max = Math.max(max, line.price);
  }
  return max;
}

export function applyPromotions(
  cart: CartItem[],
  catalog: CatalogService[],
  addons: ServiceAddon[],
  settings: SalonSettings,
  region: Parameters<typeof calculateCartPricing>[4],
  ctx: PromotionContext,
  promo: PromotionInput,
): PricingResult {
  const base = calculateCartPricing(cart, catalog, addons, settings, region);
  if (!base.lines.length) return base;

  const adjustments: PricingAdjustments = {
    loyaltyDiscount: 0,
    loyaltyPercent: 0,
    discountCodeAmount: 0,
    discountCodeLabel: null,
    packageDiscount: 0,
    packageUsedId: null,
    walletUsed: 0,
    balanceGiftUsed: 0,
  };

  let runningTotal = base.totalPrice;

  // باقة جلسات — تغطي جلسة مساج واحدة
  if (promo.customerPackageId && cartHasMassage(cart, catalog)) {
    const pkg = ctx.customerPackages.find(
      (p) => p.id === promo.customerPackageId && p.sessions_remaining > 0,
    );
    if (pkg) {
      const massagePrice = getMassageLinePrice(base, catalog);
      adjustments.packageDiscount = Math.min(massagePrice, runningTotal);
      adjustments.packageUsedId = pkg.id;
      runningTotal -= adjustments.packageDiscount;
    }
  }

  // ولاء المساج — على المساج فقط
  if (promo.massageSessionsCompleted !== undefined && cartHasMassage(cart, catalog)) {
    const tiers = settings.loyaltyTiers ?? [];
    const pct = getLoyaltyDiscountPercent(promo.massageSessionsCompleted, tiers);
    if (pct > 0) {
      const massageTotal = base.lines
        .filter((l) => catalog.find((s) => s.id === l.service_id)?.category === "massage")
        .reduce((s, l) => s + l.price, 0);
      adjustments.loyaltyPercent = pct;
      adjustments.loyaltyDiscount = Math.round((massageTotal * pct) / 100);
      runningTotal -= adjustments.loyaltyDiscount;
    }
  }

  // كود خصم
  if (promo.discountCode) {
    const code = findValidCode(ctx.discountCodes, promo.discountCode);
    if (code) {
      adjustments.discountCodeLabel = code.code;
      if (code.type === "percent") {
        adjustments.discountCodeAmount = Math.round((runningTotal * code.value) / 100);
      } else {
        adjustments.discountCodeAmount = Math.min(code.value, runningTotal);
      }
      runningTotal -= adjustments.discountCodeAmount;
    }
  }

  // كرت رصيد مالي
  if (promo.balanceGiftCode) {
    const card = findBalanceGift(ctx.balanceGiftCards, promo.balanceGiftCode);
    if (card) {
      adjustments.balanceGiftUsed = Math.min(card.balance_remaining, runningTotal);
      runningTotal -= adjustments.balanceGiftUsed;
    }
  }

  // محفظة العميلة
  if (promo.useWallet && promo.walletBalance && promo.walletBalance > 0) {
    adjustments.walletUsed = Math.min(promo.walletBalance, runningTotal);
    runningTotal -= adjustments.walletUsed;
  }

  return {
    ...base,
    adjustments,
    finalTotal: Math.max(0, runningTotal),
  };
}

export function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "soft-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
