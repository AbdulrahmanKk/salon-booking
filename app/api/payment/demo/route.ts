import { NextRequest, NextResponse } from "next/server";
import { confirmDemoPayment, confirmGiftPayment } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);

/** دفع تجريبي — بدون Moyasar */
async function handlePOST(request: NextRequest) {
  try {
    const { bookingId, giftId } = await request.json();

    if (giftId) {
      const gift = confirmGiftPayment(giftId);
      if (!gift) {
        return NextResponse.json({ error: "الإهداء غير موجود" }, { status: 404 });
      }
      return NextResponse.json({ paid: true, gift });
    }

    if (!bookingId) {
      return NextResponse.json({ error: "معرّف الحجز أو الإهداء مطلوب" }, { status: 400 });
    }

    const booking = await confirmDemoPayment(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ paid: true, booking });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطأ" }, { status: 500 });
  }
}
