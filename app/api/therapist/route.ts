import { NextRequest, NextResponse } from "next/server";
import { getTherapistTodayBookings, getTherapists } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);

async function handleGET(request: NextRequest) {
  const therapistId = Number(request.nextUrl.searchParams.get("id") ?? "1");
  const therapists = getTherapists();
  const therapist = therapists.find((t) => t.id === therapistId);

  if (!therapist) {
    return NextResponse.json({ error: "ثيرابست غير موجودة" }, { status: 404 });
  }

  const bookings = getTherapistTodayBookings(therapistId);
  return NextResponse.json({ therapist, bookings, therapists });
}
