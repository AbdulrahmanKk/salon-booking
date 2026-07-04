import { NextRequest, NextResponse } from "next/server";
import { DEMO_OTP, normalizePhone } from "@/lib/customer";

const COOKIE = "pt_phone";

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: "رقم الجوال مطلوب" }, { status: 400 });
    }
    if (otp !== DEMO_OTP) {
      return NextResponse.json({ error: "رمز التحقق غير صحيح (تجريبي: 1234)" }, { status: 401 });
    }

    const normalized = normalizePhone(phone);
    const res = NextResponse.json({ ok: true, phone: normalized });
    res.cookies.set(COOKIE, normalized, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "خطأ" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
