import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
} from "@/lib/memory-store";
import type { NotificationAudience } from "@/lib/types";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);
export const PATCH = withStore(handlePATCH);

const VALID_AUDIENCES: NotificationAudience[] = ["customer", "admin", "therapist"];

async function handleGET(request: NextRequest) {
  const audience = request.nextUrl.searchParams.get("audience") as NotificationAudience | null;
  if (!audience || !VALID_AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: "جمهور غير صالح" }, { status: 400 });
  }

  const therapistId = Number(request.nextUrl.searchParams.get("therapistId") ?? "0") || undefined;
  const phone = audience === "customer" ? cookies().get("pt_phone")?.value : undefined;

  if (audience === "customer" && !phone) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const filter = { audience, phone, therapistId };
  return NextResponse.json({
    notifications: getNotifications(filter),
    unreadCount: getUnreadNotificationCount(filter),
  });
}

async function handlePATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const audience = body.audience as NotificationAudience;
    if (!VALID_AUDIENCES.includes(audience)) {
      return NextResponse.json({ error: "جمهور غير صالح" }, { status: 400 });
    }

    const therapistId = body.therapistId ? Number(body.therapistId) : undefined;
    const phone = audience === "customer" ? cookies().get("pt_phone")?.value : undefined;

    const marked = markAllNotificationsRead({ audience, phone, therapistId });
    return NextResponse.json({ marked });
  } catch {
    return NextResponse.json({ error: "خطأ" }, { status: 400 });
  }
}
