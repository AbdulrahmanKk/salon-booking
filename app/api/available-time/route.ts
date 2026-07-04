import { NextRequest, NextResponse } from "next/server";
import { asArray } from "@/lib/arrays";
import {
  earliestAfterLastBooking,
  formatDateShort,
  formatDateTimeAr,
  formatTimeAr12,
} from "@/lib/scheduling";
import { getBookingsForSchedule, getSettings, getSlotsForSelections } from "@/lib/memory-store";
import type { CartItem, Region, ServiceSelection } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const POST = withStore(handlePOST);

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { region, serviceSelections, cart, promo, phone } = body as {
      region: Region;
      serviceSelections?: ServiceSelection[];
      cart?: CartItem[];
      promo?: import("@/lib/promotions").PromotionInput;
      phone?: string;
    };

    if (!region || (!cart?.length && !serviceSelections?.length)) {
      return NextResponse.json({ error: "المنطقة والخدمات مطلوبة" }, { status: 400 });
    }

    const result = getSlotsForSelections(region, {
      cart: asArray(cart),
      serviceSelections: asArray(serviceSelections),
      promo,
      phone,
    });

    const settings = getSettings();
    const existing = getBookingsForSchedule();
    const { time: earliest, travelMinutes } = earliestAfterLastBooking(
      existing,
      region,
      settings,
    );

    return NextResponse.json({
      slots: result.slots.map((s) => ({
        iso: s.start.toISOString(),
        therapistId: s.therapistId,
        timeFormatted: formatTimeAr12(s.start),
        dateTimeFormatted: formatDateTimeAr(s.start),
        dateLabel: formatDateShort(s.start),
      })),
      totalDuration: result.totalDuration,
      totalPrice: result.totalPrice,
      subtotal: result.subtotal,
      deliveryFee: result.deliveryFee,
      regionSurchargeTotal: result.regionSurchargeTotal,
      peopleCount: result.peopleCount,
      requiresDeposit: result.requiresDeposit,
      earliestAfterLast: earliest ? formatTimeAr12(earliest) : null,
      travelFromLastMinutes: travelMinutes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ في الحساب";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
