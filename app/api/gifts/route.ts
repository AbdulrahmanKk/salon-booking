import { NextRequest, NextResponse } from "next/server";
import { asArray } from "@/lib/arrays";
import { createGift, getAllGifts } from "@/lib/memory-store";
import type { CartItem, GiftCard, ServiceSelection } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);

async function handleGET() {
  return NextResponse.json(asArray<GiftCard>(getAllGifts()));
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      gifterName,
      gifterPhone,
      recipientName,
      recipientPhone,
      message,
      occasionDate,
      serviceSelections,
      cart,
    } = body as {
      gifterName: string;
      gifterPhone: string;
      recipientName: string;
      recipientPhone: string;
      message?: string;
      occasionDate?: string | null;
      serviceSelections?: ServiceSelection[];
      cart?: CartItem[];
    };

    if (!gifterName?.trim() || !gifterPhone || !recipientName?.trim() || !recipientPhone) {
      return NextResponse.json({ error: "بيانات الإهداء ناقصة" }, { status: 400 });
    }
    const hasCart = asArray(cart).length > 0;
    const hasSel = asArray(serviceSelections).length > 0;
    if (!hasCart && !hasSel) {
      return NextResponse.json({ error: "اختيار خدمة واحدة على الأقل" }, { status: 400 });
    }

    const { gift, amountHalala } = createGift({
      gifterName,
      gifterPhone,
      recipientName,
      recipientPhone,
      message: message ?? "",
      occasionDate,
      cart: asArray(cart),
      serviceSelections: asArray(serviceSelections),
    });

    return NextResponse.json({ gift, amountHalala });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ في إنشاء الإهداء";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
