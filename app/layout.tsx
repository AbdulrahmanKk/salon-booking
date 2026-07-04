import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import HeaderNotifications from "@/components/HeaderNotifications";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "سوفت مومنت — خدمات منزلية في الرياض",
  description: "احجزي خدمات التجميل والمساج في منزلك — سوفت مومنت الرياض",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${tajawal.variable} font-arabic antialiased`}>
        <header className="border-b border-soft-blush/60 bg-white/70 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-2">
            <p className="text-center text-xs text-amber-700 bg-amber-50 rounded-lg py-1.5">
              وضع تجريبي — بيانات محلية · الدفع شكلي · جاهز لربط Moyasar لاحقاً
            </p>
          </div>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <a href="/" className="flex items-center gap-2 text-xl font-bold text-soft-accent">
              <span className="text-2xl">🌿</span> سوفت مومنت
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/book" className="text-salon-text hover:text-soft-accent">احجزي الآن</a>
              <a href="/account" className="text-salon-text hover:text-soft-accent">حسابي</a>
              <a href="/therapist" className="text-salon-text hover:text-soft-accent">الثيرابست</a>
              <a href="/admin" className="text-salon-mauve hover:text-soft-accent">الإدارة</a>
              <HeaderNotifications />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-soft-blush/60 py-6 text-center text-sm text-salon-mauve">
          سوفت مومنت — لحظة هدوء وجمال في بيتكِ © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
