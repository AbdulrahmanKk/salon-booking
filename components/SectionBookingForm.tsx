"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { asArray } from "@/lib/arrays";
import { useCart } from "@/lib/cart-context";
import type { CatalogService, CartItem, ServiceAddon } from "@/lib/types";
import type { SectionConfig } from "@/lib/sections";
import AddToCartToast from "./AddToCartToast";
import SectionServiceList from "./SectionServiceList";

interface Props {
  section: SectionConfig;
}

export default function SectionBookingForm({ section }: Props) {
  const { items, addItem } = useCart();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [toast, setToast] = useState({ message: "", visible: false });

  const sectionServices = services.filter((s) =>
    section.categories.includes(s.category),
  );

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        setServices(asArray<CatalogService>(data.services ?? data));
        setAddons(asArray<ServiceAddon>(data.addons));
      })
      .catch(() => {});
  }, []);

  const handleAdd = (item: Omit<CartItem, "lineId">) => {
    const svc = services.find((s) => s.id === item.serviceId);
    addItem(item);
    setToast({
      visible: true,
      message: svc ? `تمت إضافة «${svc.name}» إلى السلة` : "تمت الإضافة إلى السلة",
    });
  };

  return (
    <div className="mx-auto max-w-page px-6 py-12 md:py-16">
      <AddToCartToast
        message={toast.message}
        visible={toast.visible}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <Link href="/" className="btn-ghost mb-10 inline-block">
        ← الرئيسية
      </Link>

      <header className="mb-12">
        <h1 className="page-title">{section.title}</h1>
        {section.subtitle ? (
          <p className="page-subtitle">{section.subtitle}</p>
        ) : null}
        {section.footnote && section.slug !== "makeup" ? (
          <p className="mt-6 text-sm leading-relaxed text-sm-muted">{section.footnote}</p>
        ) : null}
      </header>

      <section>
        <h2 className="mb-6 text-sm font-medium uppercase tracking-widest text-sm-muted">
          الخدمات والأسعار
        </h2>
        <SectionServiceList
          services={sectionServices}
          catalog={services}
          addons={addons}
          cart={items}
          onAddToCart={handleAdd}
          onAddError={(msg) => setToast({ visible: true, message: msg })}
        />
      </section>
    </div>
  );
}
