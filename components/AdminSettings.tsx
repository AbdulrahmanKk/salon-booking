"use client";

import { useEffect, useState } from "react";
import type { SalonSettings } from "@/lib/types";

export default function AdminSettings() {
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setMsg("تعذّر التحميل"));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      setMsg("تم الحفظ ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="text-salon-mauve">جاري التحميل...</p>;

  return (
    <div className="card space-y-6">
      <h3 className="text-lg font-bold">إعدادات سوفت مومنت</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">اسم العلامة</label>
          <input
            className="input-field"
            value={settings.brandName}
            onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">الشعار (رابط صورة)</label>
          <input
            className="input-field"
            value={settings.logoUrl ?? ""}
            onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value || null })}
            dir="ltr"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="label">صورة العرض (رابط)</label>
          <input
            className="input-field"
            value={settings.heroImageUrl ?? ""}
            onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value || null })}
            dir="ltr"
          />
        </div>
        <div>
          <label className="label">رسوم التوصيل (ر.س)</label>
          <input
            type="number"
            className="input-field"
            value={settings.deliveryFee}
            onChange={(e) => setSettings({ ...settings, deliveryFee: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">وقت التجهيز (دقيقة)</label>
          <input
            type="number"
            className="input-field"
            value={settings.prepTimeMinutes}
            onChange={(e) => setSettings({ ...settings, prepTimeMinutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">بداية العمل (ساعة)</label>
          <input
            type="number"
            className="input-field"
            value={settings.businessStartHour}
            onChange={(e) => setSettings({ ...settings, businessStartHour: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">زيادة مكياج للمناطق (ر.س)</label>
          <input
            type="number"
            className="input-field"
            value={settings.makeupRegionSurcharge}
            onChange={(e) => setSettings({ ...settings, makeupRegionSurcharge: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">زيادة شعر للمناطق (ر.س)</label>
          <input
            type="number"
            className="input-field"
            value={settings.hairRegionSurcharge}
            onChange={(e) => setSettings({ ...settings, hairRegionSurcharge: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">حذف صور الأبواب بعد (أيام)</label>
          <input
            type="number"
            min={1}
            className="input-field"
            value={settings.doorImageRetentionDays ?? 7}
            onChange={(e) =>
              setSettings({ ...settings, doorImageRetentionDays: Number(e.target.value) })
            }
          />
        </div>
      </div>

      <div>
        <label className="label">ملاحظة العربون</label>
        <textarea
          className="input-field min-h-[80px]"
          value={settings.depositNote}
          onChange={(e) => setSettings({ ...settings, depositNote: e.target.value })}
        />
      </div>

      {settings.logoUrl && (
        <img src={settings.logoUrl} alt="الشعار" className="mx-auto max-h-24 object-contain" />
      )}

      <button type="button" className="btn-primary" onClick={save} disabled={saving}>
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
      {msg && <p className="text-sm text-salon-mauve">{msg}</p>}
    </div>
  );
}
