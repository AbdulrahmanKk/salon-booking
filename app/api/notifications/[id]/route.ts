import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const PATCH = withStore(handlePATCH);

async function handlePATCH(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = markNotificationRead(params.id);
  if (!data) {
    return NextResponse.json({ error: "الإشعار غير موجود" }, { status: 404 });
  }
  return NextResponse.json(data);
}
