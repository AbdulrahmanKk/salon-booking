"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

function CallbackContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const paymentId = searchParams.get("id");
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!bookingId || !paymentId) {
      setStatus("fail");
      setMessage("بيانات الدفع ناقصة");
      return;
    }

    fetch("/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, paymentId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.paid) {
          setStatus("ok");
        } else {
          setStatus("fail");
          setMessage(data.error || "فشل التحقق");
        }
      })
      .catch(() => {
        setStatus("fail");
        setMessage("خطأ في الاتصال");
      });
  }, [bookingId, paymentId]);

  return (
    <div className="card mx-auto max-w-md text-center">
      {status === "loading" && <p>جاري التحقق من الدفع...</p>}
      {status === "ok" && (
        <>
          <div className="mb-4 text-5xl text-green-600">✓</div>
          <h2 className="text-xl font-bold">تم الدفع والحجز بنجاح!</h2>
        </>
      )}
      {status === "fail" && (
        <>
          <div className="mb-4 text-5xl text-red-500">✗</div>
          <h2 className="text-xl font-bold">مشكلة في الدفع</h2>
          <p className="mt-2 text-salon-mauve">{message}</p>
        </>
      )}
      <Link href="/" className="btn-primary mt-6 inline-block">
        العودة للرئيسية
      </Link>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="card text-center">جاري التحميل...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
