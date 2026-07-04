import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerAccount, getSessionPackages } from "@/lib/memory-store";
import { withStore } from "@/lib/with-store";

export const dynamic = "force-dynamic";
export const GET = withStore(handleGET);

async function handleGET() {
  const phone = cookies().get("pt_phone")?.value;
  if (!phone) {
    return NextResponse.json({ loggedIn: false });
  }

  const account = getCustomerAccount(phone);
  const availablePackages = getSessionPackages();

  return NextResponse.json({
    loggedIn: true,
    account,
    availablePackages,
  });
}
