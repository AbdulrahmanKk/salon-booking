import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import Providers from "@/components/Providers";
import SiteHeader from "@/components/SiteHeader";
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
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <footer className="mt-24 border-t border-sm-border py-10 text-center text-sm text-sm-muted">
            Soft Moments — الرياض
          </footer>
        </Providers>
      </body>
    </html>
  );
}
