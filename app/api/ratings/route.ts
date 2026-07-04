import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { submitRating } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);

async function handlePOST(request: NextRequest) {
  try {
    const phone = cookies().get("pt_phone")?.value;
    if (!phone) {
      return NextResponse.json({ error: "سجّلي الدخول أولاً" }, { status: 401 });
    }

    const { bookingId, stars, comment } = await request.json();
    if (!bookingId || !stars) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const rating = submitRating(bookingId, phone, Number(stars), comment ?? "");
    return NextResponse.json({ rating });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
