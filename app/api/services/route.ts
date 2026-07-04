import { NextResponse } from "next/server";
import { getAddons, getCatalog, getSettings } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);

async function handleGET() {
  return NextResponse.json({
    services: getCatalog(),
    addons: getAddons(),
    settings: getSettings(),
  });
}
