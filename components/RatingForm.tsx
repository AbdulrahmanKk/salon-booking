"use client";

import { useState } from "react";

interface Props {
  bookingId: string;
  onSubmitted: () => void;
}

export default function RatingForm({ bookingId, onSubmitted }: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (stars < 1) { setError("اختاري عدد النجوم"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, stars, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الإرسال");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-soft-blush bg-soft-blush/20 p-4 space-y-3">
      <p className="text-sm font-medium">قيّمي تجربتكِ (خدمة + ثيرابست)</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            className={`text-2xl transition ${n <= stars ? "opacity-100" : "opacity-30"}`}
          >
            ⭐
          </button>
        ))}
      </div>
      <textarea
        className="input-field min-h-[60px] text-sm"
        placeholder="تعليقكِ (اختياري)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button type="button" className="btn-primary text-sm w-full" onClick={submit} disabled={saving}>
        {saving ? "جاري الإرسال..." : "إرسال التقييم"}
      </button>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
