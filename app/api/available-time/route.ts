import { NextRequest, NextResponse } from "next/server";
import { asArray } from "@/lib/arrays";
import {
  formatDateTimeAr,
  formatTimeAr12,
  maxBookableDateKey,
  riyadhDateKey,
} from "@/lib/scheduling";
import { getSettings, getSlotsForCartItem } from "@/lib/memory-store";
import type { CartItem, Region } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { region, date, item } = body as {
      region: Region;
      date: string;
      item: CartItem;
    };

    if (!region || !date || !item?.serviceId) {
      return NextResponse.json({ error: "المنطقة والتاريخ والخدمة مطلوبة" }, { status: 400 });
    }

    const settings = getSettings();
    const today = riyadhDateKey();
    const maxDate = maxBookableDateKey(settings);
    if (date < today || date > maxDate) {
      return NextResponse.json({ error: "التاريخ خارج نطاق الحجز المتاح" }, { status: 400 });
    }

    const result = getSlotsForCartItem(region, item, date);

    return NextResponse.json({
      slots: result.slots.map((s) => ({
        iso: s.start.toISOString(),
        therapistId: s.therapistId,
        timeFormatted: formatTimeAr12(s.start),
        dateTimeFormatted: formatDateTimeAr(s.start),
      })),
      totalDuration: result.totalDuration,
      totalPrice: result.totalPrice,
      subtotal: result.subtotal,
      deliveryFee: result.deliveryFee,
      regionSurchargeTotal: result.regionSurchargeTotal,
      scheduleGroup: result.scheduleGroup,
      minDate: today,
      maxDate,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ في الحساب";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
