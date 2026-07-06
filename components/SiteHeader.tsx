"use client";

import Link from "next/link";
import CartButton from "./CartButton";

export default function SiteHeader() {
  return (
    <header className="border-b border-sm-border">
      <div className="mx-auto flex max-w-wide items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="text-lg font-medium tracking-wide text-sm-text md:text-xl">
          Soft Moments
        </Link>
        <nav className="flex items-center gap-4 text-sm text-sm-muted md:gap-6">
          <Link href="/" className="hover:text-sm-text">
            الرئيسية
          </Link>
          <Link href="/admin" className="hover:text-sm-text">
            الإدارة
          </Link>
          <CartButton />
        </nav>
      </div>
    </header>
  );
}
