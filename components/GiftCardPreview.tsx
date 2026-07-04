"use client";

import type { GiftCard, ServiceLine } from "@/lib/types";
import { formatServicesSummary } from "@/lib/types";

interface Props {
  gifterName: string;
  recipientName: string;
  services: ServiceLine[];
  message?: string;
  occasionDate?: string | null;
  compact?: boolean;
}

export default function GiftCardPreview({
  gifterName,
  recipientName,
  services,
  message,
  occasionDate,
  compact = false,
}: Props) {
  const servicesText = formatServicesSummary(services);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 border-salon-rose/40 bg-gradient-to-br from-salon-cream via-white to-salon-blush shadow-lg ${
        compact ? "p-5" : "p-8"
      }`}
    >
      <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-salon-rose/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-salon-accent/10 blur-2xl" />

      <div className="relative text-center">
        <div className="mb-1 text-3xl">🌸</div>
        <h3 className={`font-bold text-soft-accent ${compact ? "text-lg" : "text-2xl"}`}>
          أهديك لحظة استرخاء
        </h3>
        <p className="mb-4 text-sm text-salon-mauve">سوفت مومنت — خدمات منزلية</p>

        <div className="my-4 rounded-2xl border border-salon-blush bg-white/70 px-4 py-3">
          <p className="text-sm text-salon-mauve">من</p>
          <p className={`font-bold text-salon-text ${compact ? "text-base" : "text-lg"}`}>{gifterName}</p>
          <div className="my-2 text-salon-rose">♥</div>
          <p className="text-sm text-salon-mauve">إلى</p>
          <p className={`font-bold text-salon-text ${compact ? "text-base" : "text-lg"}`}>{recipientName}</p>
        </div>

        <div className="mb-4 rounded-xl bg-salon-blush/50 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-salon-mauve">الخدمة المُهداة</p>
          <p className="font-semibold text-salon-text">{servicesText || "—"}</p>
        </div>

        {occasionDate && (
          <p className="mb-3 text-sm text-salon-mauve">📅 {occasionDate}</p>
        )}

        {message?.trim() && (
          <blockquote className="mx-auto max-w-sm rounded-2xl border-r-4 border-salon-accent bg-white/80 px-4 py-3 text-sm italic leading-relaxed text-salon-text">
            «{message.trim()}»
          </blockquote>
        )}

        <div className="mt-5 border-t border-salon-blush pt-4">
          <p className="text-xs tracking-wide text-soft-accent font-semibold">سوفت مومنت</p>
          <p className="text-[10px] text-salon-mauve/80">جمالكِ يجي لباب بيتكِ</p>
        </div>
      </div>
    </div>
  );
}

/** نسخة من بيانات GiftCard كاملة */
export function GiftCardFromRecord({ gift, compact }: { gift: GiftCard; compact?: boolean }) {
  return (
    <GiftCardPreview
      gifterName={gift.gifter_name}
      recipientName={gift.recipient_name}
      services={gift.services}
      message={gift.message}
      occasionDate={gift.occasion_date}
      compact={compact}
    />
  );
}
