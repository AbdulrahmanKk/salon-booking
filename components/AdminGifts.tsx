"use client";

import { useCallback, useEffect, useState } from "react";
import { asArray } from "@/lib/arrays";
import type { GiftCard } from "@/lib/types";
import { formatServicesSummary, GIFT_PAYMENT_LABELS } from "@/lib/types";
import { buildGiftWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { GiftCardFromRecord } from "./GiftCardPreview";

export default function AdminGifts() {
  const [gifts, setGifts] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gifts");
      const data = await res.json();
      setGifts(asArray<GiftCard>(data));
      setError("");
    } catch {
      setError("تعذّر تحميل الإهداءات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWhatsApp = async (gift: GiftCard) => {
    const bookUrl = typeof window !== "undefined" ? `${window.location.origin}/book` : "http://localhost:3000/book";
    const message = buildGiftWhatsAppMessage({
      recipientName: gift.recipient_name,
      gifterName: gift.gifter_name,
      servicesSummary: formatServicesSummary(gift.services),
      message: gift.message,
      occasionDate: gift.occasion_date,
      bookUrl,
    });
    const url = buildWhatsAppUrl(gift.recipient_phone, message);
    window.open(url, "_blank", "noopener,noreferrer");

    await fetch("/api/gifts/sent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giftId: gift.id }),
    });
    load();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ar-SA", {
      timeZone: "Asia/Riyadh",
      dateStyle: "medium",
      timeStyle: "short",
    });

  if (loading) return <p className="text-center text-salon-mauve">جاري تحميل الإهداءات...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-salon-mauve">كروت الإهداء المدفوعة — أرسليها للمُهدى لها عبر واتساب</p>
        <button type="button" className="btn-secondary" onClick={load}>تحديث</button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {gifts.length === 0 ? (
        <div className="card text-center text-salon-mauve">لا توجد إهداءات بعد</div>
      ) : (
        <div className="space-y-8">
          {gifts.map((gift) => (
            <div key={gift.id} className="card space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-salon-accent">
                    {gift.gifter_name} → {gift.recipient_name}
                  </h3>
                  <p className="text-sm text-salon-mauve">
                    {formatServicesSummary(gift.services)} · {gift.total_price} ر.س
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    gift.payment_status === "paid"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {GIFT_PAYMENT_LABELS[gift.payment_status]}
                </span>
              </div>

              <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-salon-blush/30 p-3">
                  <p className="text-xs text-salon-mauve">المُهدية</p>
                  <p className="font-medium">{gift.gifter_name}</p>
                  <p dir="ltr" className="text-salon-mauve">{gift.gifter_phone}</p>
                </div>
                <div className="rounded-xl bg-salon-blush/30 p-3">
                  <p className="text-xs text-salon-mauve">المُهدى لها</p>
                  <p className="font-medium">{gift.recipient_name}</p>
                  <p dir="ltr" className="text-salon-mauve">{gift.recipient_phone}</p>
                </div>
                <div className="rounded-xl bg-salon-blush/30 p-3 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs text-salon-mauve">تاريخ الطلب</p>
                  <p>{formatDate(gift.created_at)}</p>
                  {gift.occasion_date && (
                    <p className="mt-1 text-salon-mauve">مناسبة: {gift.occasion_date}</p>
                  )}
                  {gift.sent_at && (
                    <p className="mt-1 text-green-700 text-xs">✓ أُرسل {formatDate(gift.sent_at)}</p>
                  )}
                </div>
              </div>

              {gift.message && (
                <blockquote className="rounded-xl border-r-4 border-salon-rose bg-salon-cream/50 px-4 py-3 text-sm italic">
                  «{gift.message}»
                </blockquote>
              )}

              <div className="max-w-md mx-auto">
                <GiftCardFromRecord gift={gift} compact />
              </div>

              {gift.payment_status === "paid" && (
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => handleWhatsApp(gift)}
                >
                  📱 إرسال للمُهدى لها عبر واتساب
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
