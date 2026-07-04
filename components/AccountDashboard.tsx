"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CustomerAccount, CustomerPackage, SessionPackage } from "@/lib/types";
import { formatServicesSummary, STATUS_LABELS } from "@/lib/types";
import NotificationCenter from "./NotificationCenter";
import RatingForm from "./RatingForm";

export default function AccountDashboard() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"login" | "otp" | "dashboard">("login");
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      const data = await res.json();
      if (data.loggedIn) {
        setAccount(data.account);
        setPackages(data.availablePackages ?? []);
        setStep("dashboard");
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  const sendOtp = () => {
    if (!phone.trim()) { setError("أدخلي رقم الجوال"); return; }
    setError("");
    setStep("otp");
  };

  const verifyOtp = async () => {
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الدخول");
    }
  };

  const logout = async () => {
    await fetch("/api/auth/login", { method: "DELETE" });
    setAccount(null);
    setStep("login");
    setPhone("");
    setOtp("");
  };

  const buyPackage = async (packageId: string) => {
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase_package", packageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الشراء");
    }
  };

  if (loading) return <p className="text-center text-salon-mauve">جاري التحميل...</p>;

  if (step !== "dashboard" || !account) {
    return (
      <div className="mx-auto max-w-md card space-y-5">
        <h1 className="text-2xl font-bold text-soft-accent">حسابي</h1>
        {step === "login" ? (
          <>
            <p className="text-sm text-salon-mauve">ادخلي رقم جوالكِ — رمز تجريبي: <strong dir="ltr">1234</strong></p>
            <input
              className="input-field"
              placeholder="05xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
            <button type="button" className="btn-primary w-full" onClick={sendOtp}>
              إرسال رمز التحقق
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-salon-mauve">رمز التحقق وصل لـ {phone}</p>
            <input
              className="input-field text-center text-2xl tracking-widest"
              placeholder="1234"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              dir="ltr"
              maxLength={4}
            />
            <button type="button" className="btn-primary w-full" onClick={verifyOtp}>
              دخول
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => setStep("login")}>
              رجوع
            </button>
          </>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    );
  }

  const upcoming = account.bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "completed" && new Date(b.start_time) >= new Date(),
  );
  const past = account.bookings.filter(
    (b) => b.status === "completed" || new Date(b.start_time) < new Date(),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مرحباً {account.name ?? "عميلتنا"} 💗</h1>
          <p className="text-salon-mauve" dir="ltr">{account.phone}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={logout}>خروج</button>
        <NotificationCenter audience="customer" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card text-center border-soft-blush">
          <div className="text-2xl font-bold text-soft-accent">{account.wallet_balance} ر.س</div>
          <div className="text-sm text-salon-mauve">رصيد المحفظة</div>
        </div>
        <div className="card text-center border-soft-blush">
          <div className="text-2xl font-bold text-soft-accent">{account.loyalty.massage_sessions}</div>
          <div className="text-sm text-salon-mauve">جلسات مساج</div>
          {account.loyalty.current_discount_percent > 0 && (
            <div className="mt-1 text-xs text-green-700">خصم {account.loyalty.current_discount_percent}%</div>
          )}
        </div>
        <div className="card text-center border-soft-blush">
          <div className="text-2xl font-bold text-soft-accent">
            {account.packages.reduce((s, p) => s + p.sessions_remaining, 0)}
          </div>
          <div className="text-sm text-salon-mauve">جلسات باقة متبقية</div>
        </div>
      </div>

      {account.loyalty.next_tier && (
        <div className="card bg-soft-blush/30 text-sm">
          💆 باقي {account.loyalty.sessions_until_next} جلسة للوصول لخصم{" "}
          {account.loyalty.next_tier.discountPercent}% على المساج
        </div>
      )}

      {account.packages.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-bold">باقاتي</h2>
          <ul className="space-y-2">
            {account.packages.map((p: CustomerPackage) => (
              <li key={p.id} className="flex justify-between rounded-xl bg-white/80 px-4 py-2 text-sm">
                <span>{p.package_name}</span>
                <span className="text-soft-accent">{p.sessions_remaining} / {p.sessions_total} جلسة</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {packages.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-bold">اشترِي باقة جلسات</h2>
          <div className="space-y-3">
            {packages.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-salon-blush p-4">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-salon-mauve">{p.description}</div>
                  <div className="text-soft-accent font-bold">{p.price} ر.س · {p.sessions_total} جلسات</div>
                </div>
                <button type="button" className="btn-primary text-sm" onClick={() => buyPackage(p.id)}>
                  شراء (تجريبي)
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-bold">حجوزات قادمة</h2>
        {upcoming.length === 0 ? (
          <p className="text-salon-mauve text-sm">لا توجد حجوزات قادمة</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id} className="rounded-xl border border-salon-blush p-4 text-sm">
                <div className="font-medium">{formatServicesSummary(b.services)}</div>
                <div className="text-salon-mauve">
                  {new Date(b.start_time).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                </div>
                <div className="text-xs">{STATUS_LABELS[b.status]} · {b.final_price ?? b.total_price} ر.س</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">قيّمي تجربتكِ</h2>
        {account.bookings.filter((b) => b.status === "completed" && !b.rating_id).length === 0 ? (
          <p className="text-salon-mauve text-sm">لا حجوزات بانتظار التقييم</p>
        ) : (
          <ul className="space-y-4">
            {account.bookings
              .filter((b) => b.status === "completed" && !b.rating_id)
              .slice(0, 3)
              .map((b) => (
                <li key={b.id} className="rounded-xl border border-salon-blush p-4 text-sm">
                  <div className="font-medium">{formatServicesSummary(b.services)}</div>
                  <div className="text-salon-mauve text-xs mb-2">
                    {new Date(b.start_time).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })}
                  </div>
                  <RatingForm bookingId={b.id} onSubmitted={loadAccount} />
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">سجل الحجوزات</h2>
        {past.length === 0 ? (
          <p className="text-salon-mauve text-sm">لا توجد حجوزات سابقة</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {past.slice(0, 10).map((b) => (
              <li key={b.id} className="flex justify-between rounded-lg bg-salon-cream/50 px-3 py-2 text-sm">
                <span>{formatServicesSummary(b.services)}</span>
                <span className="text-salon-mauve">{STATUS_LABELS[b.status]}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/book" className="btn-primary mt-4 inline-block w-full text-center">
          إعادة الحجز بسهولة
        </Link>
      </section>

      {account.transactions.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-bold">حركة المحفظة</h2>
          <ul className="space-y-1 text-sm">
            {account.transactions.slice(0, 10).map((t) => (
              <li key={t.id} className="flex justify-between">
                <span className="text-salon-mauve">{t.reason}</span>
                <span className={t.amount >= 0 ? "text-green-700" : "text-red-600"}>
                  {t.amount > 0 ? "+" : ""}{t.amount} ر.س
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
