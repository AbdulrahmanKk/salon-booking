import { NextRequest, NextResponse } from "next/server";
import { asArray } from "@/lib/arrays";
import { previewCart, type PromotionInput } from "@/lib/memory-store";
import type { CartItem, Region } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cart, region, promo, phone } = body as {
      cart: CartItem[];
      region?: Region;
      promo?: PromotionInput;
      phone?: string;
    };
    const result = previewCart(asArray(cart), region, promo, phone);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
