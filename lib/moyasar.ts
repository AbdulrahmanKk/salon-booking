/**
 * التحقق من دفعة Moyasar عبر API
 * https://docs.moyasar.com/api/payments/retrieve-payment
 */

export interface MoyasarPayment {
  id: string;
  status: "initiated" | "paid" | "failed" | "authorized" | "captured" | "refunded" | "voided";
  amount: number;
  currency: string;
}

export async function verifyMoyasarPayment(paymentId: string): Promise<MoyasarPayment | null> {
  const secretKey = process.env.MOYASAR_SECRET_KEY;
  if (!secretKey) {
    console.error("MOYASAR_SECRET_KEY غير مضبوط");
    return null;
  }

  const res = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export function isPaymentPaid(payment: MoyasarPayment): boolean {
  return payment.status === "paid" || payment.status === "captured";
}

/** المبلغ بالهللة (Moyasar يستخدم أصغر وحدة) */
export function riyalToHalala(riyal: number): number {
  return Math.round(riyal * 100);
}
