import { NextRequest, NextResponse } from "next/server";
import { asArray } from "@/lib/arrays";
import { getSettings, previewCart, updateSettings } from "@/lib/memory-store";
import type { CartItem, Region } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);
export const GET = withStore(handleGET);
export const PATCH = withStore(handlePATCH);

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cart, region } = body as { cart: CartItem[]; region?: Region };
    const result = previewCart(asArray(cart), region);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

async function handleGET() {
  return NextResponse.json(getSettings());
}

async function handlePATCH(request: NextRequest) {
  try {
    const partial = await request.json();
    const settings = updateSettings(partial);
    return NextResponse.json(settings);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
