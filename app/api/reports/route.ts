import { NextResponse } from "next/server";
import { getReportsSummary } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);

async function handleGET() {
  return NextResponse.json(getReportsSummary());
}
