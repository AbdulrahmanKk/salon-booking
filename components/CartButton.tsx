"use client";

import { useCart } from "@/lib/cart-context";

export default function CartButton() {
  const { count, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative border border-sm-border px-4 py-2 text-sm transition hover:border-sm-text"
      aria-label="سلة التسوق"
    >
      السلة
      {count > 0 && (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center bg-sm-text px-1 text-xs text-white">
          {count}
        </span>
      )}
    </button>
  );
}
