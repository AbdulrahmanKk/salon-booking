import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createBalanceGiftCard,
  createDiscountCode,
  getBalanceGiftCards,
  getDiscountCodes,
  getAllSessionPackagesAdmin,
  purchaseSessionPackage,
  toggleDiscountCode,
} from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);

async function handleGET() {
  return NextResponse.json({
    codes: getDiscountCodes(),
    packages: getAllSessionPackagesAdmin(),
    balanceGifts: getBalanceGiftCards(),
  });
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "create_code") {
      const code = createDiscountCode(body.data);
      return NextResponse.json({ code });
    }

    if (action === "toggle_code") {
      const code = toggleDiscountCode(body.id, body.active);
      return NextResponse.json({ code });
    }

    if (action === "purchase_package") {
      const phone = cookies().get("pt_phone")?.value ?? body.phone;
      if (!phone) return NextResponse.json({ error: "سجّلي الدخول أولاً" }, { status: 401 });
      const purchase = purchaseSessionPackage(phone, body.packageId);
      return NextResponse.json({ purchase });
    }

    if (action === "create_balance_gift") {
      const card = createBalanceGiftCard(body.data);
      return NextResponse.json({ card });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
