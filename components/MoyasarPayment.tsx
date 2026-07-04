"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Moyasar?: {
      init: (config: Record<string, unknown>) => void;
    };
  }
}

interface MoyasarPaymentProps {
  amountHalala: number;
  bookingId: string;
  description: string;
  onSuccess: (paymentId: string) => void;
  onError: (msg: string) => void;
}

export default function MoyasarPayment({
  amountHalala,
  bookingId,
  description,
  onSuccess,
  onError,
}: MoyasarPaymentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const initialized = useRef(false);

  const publishableKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!scriptReady || !publishableKey || !containerRef.current || initialized.current) {
      return;
    }

    initialized.current = true;
    const callbackUrl = `${window.location.origin}/payment/callback?booking_id=${bookingId}`;

    window.Moyasar?.init({
      element: containerRef.current,
      amount: amountHalala,
      currency: "SAR",
      description,
      publishable_api_key: publishableKey,
      callback_url: callbackUrl,
      methods: ["creditcard", "applepay", "stcpay"],
      on_completed: async (payment: { id: string }) => {
        onSuccess(payment.id);
      },
      on_failure: (error: { message?: string }) => {
        onError(error?.message || "فشل الدفع");
      },
    });
  }, [scriptReady, publishableKey, amountHalala, bookingId, description, onSuccess, onError]);

  if (!publishableKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="font-medium">مفاتيح Moyasar غير مضبوطة</p>
        <p className="mt-1 text-sm">
          أضيفي <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY</code>{" "}
          في ملف <code className="rounded bg-amber-100 px-1">.env.local</code>
        </p>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://cdn.moyasar.com/mpf.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <link rel="stylesheet" href="https://cdn.moyasar.com/mpf.css" />
      <div ref={containerRef} className="min-h-[200px] rounded-xl bg-white p-4" />
    </>
  );
}
