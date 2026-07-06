import { NextRequest, NextResponse } from "next/server";
import {
  deleteBooking,
  rescheduleBooking,
  transferTherapist,
  updateBookingStatus,
  updateVisitStatus,
} from "@/lib/memory-store";
import type { BookingStatus } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const PATCH = withStore(handlePATCH);
export const DELETE = withStore(handleDELETE);

const VALID_STATUSES: BookingStatus[] = [
  "new",
  "awaiting_deposit",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

async function handlePATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await request.json();

    if (body.visitAction) {
      const data = updateVisitStatus(id, body.visitAction);
      if (!data) return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
      return NextResponse.json(data);
    }

    if (body.startTime) {
      const data = rescheduleBooking(id, body.startTime, body.therapistId);
      return NextResponse.json(data);
    }

    if (body.therapistId !== undefined) {
      const data = transferTherapist(id, Number(body.therapistId));
      if (!data) return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
      return NextResponse.json(data);
    }

    const { status } = body as { status: BookingStatus };
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const data = updateBookingStatus(id, status);
    if (!data) return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

async function handleDELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const deleted = await deleteBooking(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
