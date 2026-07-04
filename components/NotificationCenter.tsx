"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppNotification, NotificationAudience } from "@/lib/types";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/types";

interface Props {
  audience: NotificationAudience;
  therapistId?: number;
  className?: string;
}

export default function NotificationCenter({ audience, therapistId, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const query = therapistId
    ? `audience=${audience}&therapistId=${therapistId}`
    : `audience=${audience}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?${query}`);
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, [query]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    load();
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, therapistId }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("ar-SA", {
      timeZone: "Asia/Riyadh",
      dateStyle: "short",
      timeStyle: "short",
      hour12: true,
    });

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-salon-text hover:bg-soft-blush/40"
        aria-label="الإشعارات"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-soft-accent px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-soft-blush bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-soft-blush/60 px-4 py-3">
              <h3 className="font-bold text-sm">الإشعارات</h3>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-xs text-soft-accent hover:underline disabled:opacity-50"
                  onClick={markAllRead}
                  disabled={loading}
                >
                  تعيين الكل كمقروء
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <li className="p-6 text-center text-sm text-salon-mauve">لا توجد إشعارات</li>
              ) : (
                items.slice(0, 20).map((n) => (
                  <li
                    key={n.id}
                    className={`border-b border-soft-blush/40 px-4 py-3 text-sm ${
                      n.read ? "opacity-60" : "bg-soft-blush/10"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-right"
                      onClick={() => !n.read && markRead(n.id)}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">{n.title}</span>
                        <span className="text-[10px] text-salon-mauve shrink-0">
                          {NOTIFICATION_TYPE_LABELS[n.type]}
                        </span>
                      </div>
                      <p className="text-salon-mauve text-xs leading-relaxed">{n.body}</p>
                      <p className="mt-1 text-[10px] text-salon-mauve/80">{formatTime(n.created_at)}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="border-t border-soft-blush/40 px-4 py-2 text-[10px] text-salon-mauve">
              الإرسال الخارجي (واتساب/SMS) جاهز للتفعيل لاحقاً
            </p>
          </div>
        </>
      )}
    </div>
  );
}
