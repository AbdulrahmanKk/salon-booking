"use client";

import { useEffect, useState } from "react";
import type { ReportsSummary } from "@/lib/types";

function BarChart({ items, labelKey }: { items: { count: number; [k: string]: unknown }[]; labelKey: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{String(item[labelKey])}</span>
            <span className="text-salon-mauve">{item.count}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-salon-blush">
            <div
              className="h-full rounded-full bg-soft-accent transition-all"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminReports() {
  const [data, setData] = useState<ReportsSummary | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-salon-mauve">جاري تحميل التقارير...</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "أرباح اليوم", value: `${data.revenueToday} ر.س`, icon: "💰" },
          { label: "أرباح الشهر", value: `${data.revenueMonth} ر.س`, icon: "📅" },
          { label: "متوسط التقييم", value: data.ratedCount ? `${data.avgRating} ⭐` : "—", icon: "⭐" },
          { label: "نسبة الإلغاء", value: `${data.cancellationRate}%`, icon: "📉" },
        ].map((c) => (
          <div key={c.label} className="card text-center">
            <div className="text-2xl">{c.icon}</div>
            <div className="text-xl font-bold text-soft-accent">{c.value}</div>
            <div className="text-sm text-salon-mauve">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-bold">أكثر خدمة طلباً</h3>
          <BarChart items={data.topServices} labelKey="name" />
        </div>
        <div className="card">
          <h3 className="mb-4 font-bold">أكثر منطقة حجوزات</h3>
          <BarChart items={data.topRegions} labelKey="label" />
        </div>
        <div className="card">
          <h3 className="mb-4 font-bold">أكثر ثيرابست طلباً</h3>
          <BarChart items={data.topTherapists} labelKey="name" />
        </div>
        <div className="card">
          <h3 className="mb-4 font-bold">إحصائيات عامة</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>إجمالي الحجوزات</span><span>{data.totalBookings}</span></li>
            <li className="flex justify-between"><span>مكتملة</span><span>{data.completedBookings}</span></li>
            <li className="flex justify-between"><span>ملغاة</span><span>{data.cancelledBookings}</span></li>
            <li className="flex justify-between"><span>عملاء متكررون</span><span>{data.repeatCustomers}</span></li>
            <li className="flex justify-between"><span>تقييمات</span><span>{data.ratedCount}</span></li>
          </ul>
        </div>
      </div>

      {data.delayedVisits.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-bold text-amber-800">⚠️ تأخيرات الوصول</h3>
          <ul className="space-y-1 text-sm">
            {data.delayedVisits.map((d) => (
              <li key={d.bookingId} className="flex justify-between rounded-lg bg-amber-50 px-3 py-2">
                <span>{d.customerName}</span>
                <span className="text-amber-800">+{d.delayMinutes} دقيقة</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
