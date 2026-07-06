"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem, Region } from "@/lib/types";

const STORAGE_KEY = "soft-moments-cart";

interface CartState {
  items: CartItem[];
  region: Region | "";
}

function loadCart(): CartState {
  if (typeof window === "undefined") return { items: [], region: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], region: "" };
    const parsed = JSON.parse(raw) as CartState | CartItem[];
    if (Array.isArray(parsed)) return { items: parsed, region: "" };
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      region: parsed.region ?? "",
    };
  } catch {
    return { items: [], region: "" };
  }
}

function saveCart(state: CartState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface CartContextValue {
  items: CartItem[];
  region: Region | "";
  setRegion: (region: Region | "") => void;
  addItem: (item: Omit<CartItem, "lineId" | "region">) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [region, setRegionState] = useState<Region | "">("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadCart();
    setItems(loaded.items);
    setRegionState(loaded.region);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCart({ items, region });
  }, [items, region, hydrated]);

  const setRegion = useCallback((r: Region | "") => {
    setRegionState(r);
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "lineId" | "region">) => {
    setItems((prev) => [...prev, { ...item, lineId: newLineId() }]);
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setRegionState("");
  }, []);

  const value = useMemo(
    () => ({
      items,
      region,
      setRegion,
      addItem,
      removeItem,
      clearCart,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      count: items.length,
    }),
    [items, region, setRegion, addItem, removeItem, clearCart, drawerOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
