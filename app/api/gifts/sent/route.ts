import { NextRequest, NextResponse } from "next/server";
import { markGiftSent } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);

async function handlePOST(request: NextRequest) {
  try {
    const { giftId } = await request.json();
    if (!giftId) {
      return NextResponse.json({ error: "معرّف الإهداء مطلوب" }, { status: 400 });
    }
    const gift = markGiftSent(giftId);
    if (!gift) {
      return NextResponse.json({ error: "الإهداء غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ sent: true, gift });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطأ" }, { status: 500 });
  }
}
