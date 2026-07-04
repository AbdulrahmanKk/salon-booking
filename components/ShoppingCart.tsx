"use client";

import type { CartItem, CatalogService, PricingResult, ServiceAddon } from "@/lib/types";
import { formatServicesSummary } from "@/lib/types";

interface Props {
  cart: CartItem[];
  services: CatalogService[];
  addons: ServiceAddon[];
  pricing: PricingResult | null;
  onRemove: (lineId: string) => void;
  onUpdateCount: (lineId: string, peopleCount: number) => void;
}

export default function ShoppingCart({
  cart,
  services,
  addons,
  pricing,
  onRemove,
  onUpdateCount,
}: Props) {
  if (!cart.length) {
    return (
      <div className="card text-center text-salon-mauve">
        <div className="mb-2 text-3xl">🛒</div>
        <p>السلة فارغة — أضيفي خدمات من الأقسام</p>
      </div>
    );
  }

  const lineLabel = (item: CartItem) => {
    const svc = services.find((s) => s.id === item.serviceId);
    if (!svc) return "—";
    const addonNames = item.addonIds
      .map((id) => addons.find((a) => a.id === id)?.name)
      .filter(Boolean);
    let label = svc.name;
    if (item.peopleCount > 1) label += ` ×${item.peopleCount}`;
    if (addonNames.length) label += ` (+${addonNames.join("، ")})`;
    return label;
  };

  return (
    <div className="card sticky top-4 border-2 border-salon-accent/30 bg-salon-blush/20">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <span>🛒</span> السلة
        <span className="rounded-full bg-salon-accent px-2 py-0.5 text-sm text-white">
          {cart.length}
        </span>
      </h2>

      <ul className="mb-4 space-y-2">
        {cart.map((item) => {
          const svc = services.find((s) => s.id === item.serviceId);
          const isTiered = svc?.pricing_model === "tiered_people";
          return (
            <li
              key={item.lineId}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm"
            >
              <span className="flex-1">{lineLabel(item)}</span>
              {isTiered && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="h-6 w-6 rounded-full border border-salon-blush text-xs"
                    onClick={() => onUpdateCount(item.lineId, Math.max(1, item.peopleCount - 1))}
                  >
                    −
                  </button>
                  <span className="w-4 text-center">{item.peopleCount}</span>
                  <button
                    type="button"
                    className="h-6 w-6 rounded-full border border-salon-blush text-xs"
                    onClick={() => onUpdateCount(item.lineId, item.peopleCount + 1)}
                  >
                    +
                  </button>
                </div>
              )}
              <button
                type="button"
                className="text-red-400 hover:text-red-600"
                onClick={() => onRemove(item.lineId)}
                aria-label="حذف"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      {pricing && (
        <div className="space-y-1 border-t border-salon-blush pt-3 text-sm">
          {pricing.lines.length > 0 && (
            <p className="text-xs text-salon-mauve">{formatServicesSummary(pricing.lines)}</p>
          )}
          <div className="flex justify-between">
            <span className="text-salon-mauve">الخدمات</span>
            <span>{pricing.subtotal} ر.س</span>
          </div>
          {pricing.regionSurchargeTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-salon-mauve">زيادة المنطقة</span>
              <span>+{pricing.regionSurchargeTotal} ر.س</span>
            </div>
          )}
          {pricing.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span className="text-salon-mauve">رسوم التوصيل</span>
              <span>+{pricing.deliveryFee} ر.س</span>
            </div>
          )}
          {pricing.adjustments && pricing.adjustments.packageDiscount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>باقة جلسات</span>
              <span>−{pricing.adjustments.packageDiscount} ر.س</span>
            </div>
          )}
          {pricing.adjustments && pricing.adjustments.loyaltyDiscount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>ولاء مساج ({pricing.adjustments.loyaltyPercent}%)</span>
              <span>−{pricing.adjustments.loyaltyDiscount} ر.س</span>
            </div>
          )}
          {pricing.adjustments && pricing.adjustments.discountCodeAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>كود {pricing.adjustments.discountCodeLabel}</span>
              <span>−{pricing.adjustments.discountCodeAmount} ر.س</span>
            </div>
          )}
          {pricing.adjustments && pricing.adjustments.balanceGiftUsed > 0 && (
            <div className="flex justify-between text-green-700">
              <span>كرت رصيد</span>
              <span>−{pricing.adjustments.balanceGiftUsed} ر.س</span>
            </div>
          )}
          {pricing.adjustments && pricing.adjustments.walletUsed > 0 && (
            <div className="flex justify-between text-green-700">
              <span>المحفظة</span>
              <span>−{pricing.adjustments.walletUsed} ر.س</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-soft-accent">
            <span>{pricing.finalTotal !== undefined ? "الإجمالي النهائي" : "الإجمالي"}</span>
            <span>{pricing.finalTotal ?? pricing.totalPrice} ر.س</span>
          </div>
          {pricing.finalTotal !== undefined && pricing.finalTotal < pricing.totalPrice && (
            <div className="flex justify-between text-xs text-salon-mauve line-through">
              <span>قبل الخصم</span>
              <span>{pricing.totalPrice} ر.س</span>
            </div>
          )}
          <p className="text-xs text-salon-mauve">المدة التقريبية: {pricing.totalDuration} دقيقة</p>
          {pricing.requiresDeposit && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              ⚠️ يتطلب عربون — التأكيد بعد التحويل
            </p>
          )}
        </div>
      )}
    </div>
  );
}
