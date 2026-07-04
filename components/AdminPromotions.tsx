"use client";

import { useCallback, useEffect, useState } from "react";
import type { BalanceGiftCard, DiscountCode, SessionPackage } from "@/lib/types";

export default function AdminPromotions() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [balanceGifts, setBalanceGifts] = useState<BalanceGiftCard[]>([]);
  const [newCode, setNewCode] = useState<{ code: string; type: "percent" | "fixed"; value: number }>({ code: "", type: "percent", value: 10 });
  const [newGift, setNewGift] = useState({ gifterName: "", amount: 500, recipientPhone: "", message: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/promotions");
    const data = await res.json();
    setCodes(data.codes ?? []);
    setPackages(data.packages ?? []);
    setBalanceGifts(data.balanceGifts ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCode = async () => {
    const res = await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_code",
        data: { ...newCode, active: true, expires_at: null, max_uses: null },
      }),
    });
    if (res.ok) { setMsg("تم إنشاء الكود"); load(); }
  };

  const createBalanceGift = async () => {
    const res = await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_balance_gift", data: newGift }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`كرت رصيد: ${data.card.code}`);
      load();
    }
  };

  return (
    <div className="space-y-8">
      <section className="card space-y-4">
        <h3 className="font-bold">أكواد الخصم</h3>
        <div className="flex flex-wrap gap-2">
          <input className="input-field w-32" placeholder="الكود" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} />
          <select className="input-field w-28" value={newCode.type} onChange={(e) => setNewCode({ ...newCode, type: e.target.value as "percent" | "fixed" })}>
            <option value="percent">نسبة %</option>
            <option value="fixed">مبلغ</option>
          </select>
          <input type="number" className="input-field w-24" value={newCode.value} onChange={(e) => setNewCode({ ...newCode, value: Number(e.target.value) })} />
          <button type="button" className="btn-primary" onClick={createCode}>إضافة</button>
        </div>
        <ul className="space-y-1 text-sm">
          {codes.map((c) => (
            <li key={c.id} className="flex justify-between rounded-lg bg-salon-cream/50 px-3 py-2">
              <span className="font-mono">{c.code}</span>
              <span>{c.type === "percent" ? `${c.value}%` : `${c.value} ر.س`} · استخدم {c.used_count}×</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h3 className="font-bold">باقات الجلسات</h3>
        {packages.map((p) => (
          <div key={p.id} className="rounded-xl border border-salon-blush p-3 text-sm">
            <div className="font-medium">{p.name}</div>
            <div className="text-salon-mauve">{p.sessions_total} جلسات · {p.price} ر.س</div>
          </div>
        ))}
      </section>

      <section className="card space-y-4">
        <h3 className="font-bold">كروت رصيد مالي</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input-field" placeholder="اسم المُهدي" value={newGift.gifterName} onChange={(e) => setNewGift({ ...newGift, gifterName: e.target.value })} />
          <input type="number" className="input-field" placeholder="المبلغ" value={newGift.amount} onChange={(e) => setNewGift({ ...newGift, amount: Number(e.target.value) })} />
          <input className="input-field" placeholder="جوال المُهدى لها" value={newGift.recipientPhone} onChange={(e) => setNewGift({ ...newGift, recipientPhone: e.target.value })} dir="ltr" />
          <input className="input-field" placeholder="رسالة" value={newGift.message} onChange={(e) => setNewGift({ ...newGift, message: e.target.value })} />
        </div>
        <button type="button" className="btn-primary" onClick={createBalanceGift}>إنشاء كرت رصيد</button>
        <ul className="space-y-1 text-sm">
          {balanceGifts.map((g) => (
            <li key={g.id} className="flex justify-between rounded-lg bg-soft-blush/30 px-3 py-2">
              <span className="font-mono">{g.code}</span>
              <span>{g.balance_remaining} / {g.initial_balance} ر.س</span>
            </li>
          ))}
        </ul>
      </section>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
    </div>
  );
}
