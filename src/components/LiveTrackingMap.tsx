"use client";

import { useEffect, useRef, useState } from "react";
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

type DriverLocation = {
  driver_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  drivers: { name: string; phone: string } | null;
};

const POLL_INTERVAL_MS = 10000;

function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const mins = Math.round(seconds / 60);
  return `منذ ${mins} د`;
}

export default function LiveTrackingMap() {
  const [locations, setLocations] = useState<DriverLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/driver-locations");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ");
        return;
      }
      setError(null);
      setLocations(data.locations);
    } catch {
      setError("تعذر الاتصال بالخادم");
    }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-destructive)]">
        {error}
      </div>
    );
  }

  const pins: MapPin[] =
    locations?.map((l) => ({
      id: l.driver_id,
      lat: l.lat,
      lng: l.lng,
      variant: "driver",
      popup: (
        <div className="text-sm flex flex-col gap-0.5" dir="rtl">
          <span className="font-bold">{l.drivers?.name ?? "غير معروف"}</span>
          <span className="text-xs text-[var(--color-muted)]" dir="ltr">
            {l.drivers?.phone}
          </span>
          <span className="text-xs text-[var(--color-muted)]">{timeAgo(l.updated_at)}</span>
        </div>
      ),
    })) ?? [];

  return (
    <main className="flex-1 flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">
          {locations ? `${locations.length} مندوب متصل الآن` : "جارٍ التحميل..."}
        </p>
        <p className="text-xs text-[var(--color-muted)]">تحديث كل 10 ثوانٍ</p>
      </div>
      <div className="flex-1">
        <LocationMap pins={pins} height="100%" />
      </div>
    </main>
  );
}
