import { NextRequest, NextResponse } from "next/server";
import { isPaymentPaid, verifyMoyasarPayment } from "@/lib/moyasar";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { bookingId, paymentId } = await request.json();

    if (!bookingId || !paymentId) {
      return NextResponse.json({ error: "معرّفات ناقصة" }, { status: 400 });
    }

    const payment = await verifyMoyasarPayment(paymentId);
    if (!payment || !isPaymentPaid(payment)) {
      const supabase = createAdminClient();
      await supabase
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", bookingId);

      return NextResponse.json({ error: "الدفع غير مكتمل", paid: false }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        status: "confirmed",
        moyasar_payment_id: paymentId,
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ paid: true, booking: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطأ في التحقق" }, { status: 500 });
  }
}
