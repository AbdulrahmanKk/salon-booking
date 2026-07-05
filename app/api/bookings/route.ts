import { NextRequest, NextResponse } from "next/server";
import { asArray } from "@/lib/arrays";
import { createBooking, getAllBookings, getAllServicesAdmin, type PromotionInput } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";
import type { BookingWithServices, CartItem, Region, ServiceSelection } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = withStore(handlePOST);
export const GET = withStore(handleGET);

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      locationUrl,
      region,
      doorImageUrl,
      customerNotes,
      serviceSelections,
      cart,
      startTime,
      therapistId,
      manual,
      promo,
    } = body as {
      customerName: string;
      customerPhone: string;
      locationUrl: string;
      region: Region;
      doorImageUrl?: string;
      customerNotes?: string;
      serviceSelections?: ServiceSelection[];
      cart?: CartItem[];
      startTime: string;
      therapistId?: number;
      manual?: boolean;
      promo?: PromotionInput;
    };

    if (!customerName?.trim() || !customerPhone || !locationUrl || !region || !startTime) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    const hasCart = asArray(cart).length > 0;
    const hasSel = asArray<ServiceSelection>(serviceSelections).some(
      (s) => s.quantity > 0 || (s.people_count ?? 0) > 0,
    );
    if (!hasCart && !hasSel) {
      return NextResponse.json({ error: "اختيار خدمة واحدة على الأقل" }, { status: 400 });
    }

    const catalog = getAllServicesAdmin();
    for (const item of asArray<CartItem>(cart)) {
      const svc = catalog.find((s) => s.id === item.serviceId && s.active !== false);
      if (!svc) {
        console.error("[bookings/POST] خدمة غير موجودة في الكتالوج:", item.serviceId);
        return NextResponse.json(
          { error: `الخدمة غير موجودة أو غير متاحة: ${item.serviceId}` },
          { status: 400 },
        );
      }
    }

    const { booking, amountHalala } = createBooking({
      customerName,
      customerPhone,
      locationUrl,
      region,
      doorImageUrl,
      customerNotes,
      cart: asArray(cart),
      serviceSelections: asArray(serviceSelections),
      startTime,
      therapistId,
      manual: Boolean(manual),
      promo,
    });

    console.log("[bookings/POST] CREATED id:", booking.id, "| flush will write store + booking file");

    return NextResponse.json({ booking, amountHalala });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ في إنشاء الحجز";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleGET() {
  return NextResponse.json(asArray<BookingWithServices>(getAllBookings()));
}
