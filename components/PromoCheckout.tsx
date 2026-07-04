"use client";

import type { CustomerPackage } from "@/lib/types";

export interface PromoState {
  discountCode: string;
  balanceGiftCode: string;
  useWallet: boolean;
  customerPackageId: string;
}

interface Props {
  promo: PromoState;
  onChange: (p: PromoState) => void;
  walletBalance: number;
  packages: CustomerPackage[];
  loyaltySessions: number;
  loyaltyDiscount: number;
  sessionsUntilNext: number | null;
  nextDiscount: number | null;
}

export function emptyPromo(): PromoState {
  return { discountCode: "", balanceGiftCode: "", useWallet: false, customerPackageId: "" };
}

export function promoToInput(promo: PromoState) {
  return {
    discountCode: promo.discountCode || undefined,
    balanceGiftCode: promo.balanceGiftCode || undefined,
    useWallet: promo.useWallet,
    customerPackageId: promo.customerPackageId || undefined,
  };
}

export default function PromoCheckout({
  promo,
  onChange,
  walletBalance,
  packages,
  loyaltySessions,
  loyaltyDiscount,
  sessionsUntilNext,
  nextDiscount,
}: Props) {
  return (
    <section className="card space-y-4 border border-soft-blush">
      <h3 className="font-bold text-soft-accent">العروض والخصومات</h3>

      {loyaltySessions >= 0 && (
        <div className="rounded-xl bg-soft-blush/40 px-4 py-3 text-sm">
          <div>💆 جلسات مساج مكتملة: <strong>{loyaltySessions}</strong></div>
          {loyaltyDiscount > 0 && (
            <div className="text-green-700">خصم ولاء نشط: {loyaltyDiscount}% على المساج</div>
          )}
          {sessionsUntilNext !== null && nextDiscount !== null && (
            <div className="text-salon-mauve">باقي {sessionsUntilNext} جلسة لخصم {nextDiscount}%</div>
          )}
        </div>
      )}

      <div>
        <label className="label">كود الخصم</label>
        <input
          className="input-field"
          placeholder="مثال: WELCOME10"
          value={promo.discountCode}
          onChange={(e) => onChange({ ...promo, discountCode: e.target.value.toUpperCase() })}
          dir="ltr"
        />
      </div>

      {packages.length > 0 && (
        <div>
          <label className="label">استخدمي جلسة من باقتي</label>
          <select
            className="input-field"
            value={promo.customerPackageId}
            onChange={(e) => onChange({ ...promo, customerPackageId: e.target.value })}
          >
            <option value="">— بدون —</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.package_name} ({p.sessions_remaining} متبقية)
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">كرت رصيد مالي</label>
        <input
          className="input-field font-mono"
          placeholder="soft-XXXXXXXX"
          value={promo.balanceGiftCode}
          onChange={(e) => onChange({ ...promo, balanceGiftCode: e.target.value.toUpperCase() })}
          dir="ltr"
        />
      </div>

      {walletBalance > 0 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-salon-blush px-4 py-3">
          <input
            type="checkbox"
            checked={promo.useWallet}
            onChange={(e) => onChange({ ...promo, useWallet: e.target.checked })}
          />
          <span className="text-sm">استخدمي رصيد المحفظة ({walletBalance} ر.س)</span>
        </label>
      )}
    </section>
  );
}
