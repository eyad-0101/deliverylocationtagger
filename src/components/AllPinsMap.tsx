"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { MapPin } from "@/components/LocationMap";

const LocationMap = dynamic(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center card text-sm text-[var(--color-muted)]"
      style={{ height: "100%" }}
    >
      جارٍ تحميل الخريطة...
    </div>
  ),
});

type Tag = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  lat: number;
  lng: number;
  note: string | null;
  label: string | null;
  created_at: string;
  drivers: { name: string } | null;
};

const LABELS: Record<string, string> = { home: "المنزل", work: "العمل", other: "أخرى" };

export default function AllPinsMap() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/all-tags")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? "حدث خطأ");
          return;
        }
        setTags(data.tags);
      })
      .catch(() => setError("تعذر الاتصال بالخادم"));
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-destructive)]">
        {error}
      </div>
    );
  }

  const pins: MapPin[] =
    tags?.map((t) => ({
      id: t.id,
      lat: t.lat,
      lng: t.lng,
      popup: (
        <div className="text-sm flex flex-col gap-0.5" dir="rtl">
          <span className="font-bold" dir="ltr">
            {t.customer_phone}
          </span>
          {t.customer_name && <span>{t.customer_name}</span>}
          {t.label && <span>{LABELS[t.label] ?? t.label}</span>}
          {t.note && <span className="text-[var(--color-muted)]">{t.note}</span>}
          <span className="text-xs text-[var(--color-muted)]">
            أضافه: {t.drivers?.name ?? "غير معروف"}
          </span>
        </div>
      ),
    })) ?? [];

  return (
    <main className="flex-1 flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-muted)]">
        {tags ? `${tags.length} موقع محفوظ` : "جارٍ التحميل..."}
      </p>
      <div className="flex-1">
        <LocationMap pins={pins} height="100%" />
      </div>
    </main>
  );
}
