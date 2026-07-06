"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export default function AddToCartToast({ message, visible, onHide }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, 3200);
    return () => clearTimeout(t);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-6 z-50 w-[min(90vw,24rem)] -translate-x-1/2 border border-sm-text bg-sm-text px-5 py-4 text-center text-sm text-white shadow-lg"
    >
      {message}
    </div>
  );
}
