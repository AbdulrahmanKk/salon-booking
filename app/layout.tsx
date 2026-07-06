import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "Soft Moments — حجز خدمات منزلية",
  description: "احجزي مكياج، هير ستايل، أظافر ومساج في الرياض",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${tajawal.variable} font-arabic antialiased`}>
        <header className="border-b border-sm-border">
          <div className="mx-auto flex max-w-wide items-center justify-between px-6 py-6 md:px-10">
            <Link href="/" className="text-lg font-medium tracking-wide text-sm-text md:text-xl">
              Soft Moments
            </Link>
            <nav className="flex items-center gap-6 text-sm text-sm-muted">
              <Link href="/" className="hover:text-sm-text">الرئيسية</Link>
              <Link href="/admin" className="hover:text-sm-text">الإدارة</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-24 border-t border-sm-border py-10 text-center text-sm text-sm-muted">
          Soft Moments — الرياض
        </footer>
      </body>
    </html>
  );
}
