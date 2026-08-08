"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
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

// A driver is only shown if their last ping was within this window — keeps
// someone who closed the tab or lost signal from lingering on the map
// looking falsely "online." Mirrors the server-side cutoff in
// /api/admin/driver-locations.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
// Realtime push means we don't need to poll for updates, but we still
// re-fetch on this cadence as a safety net (catches a dropped socket that
// silently failed to reconnect, and prunes drivers who went stale without
// sending a final event) and to pick up name/phone for a driver we've
// never seen before.
const RECONCILE_INTERVAL_MS = 45000;
// Realtime tokens are minted with a 5-minute TTL server-side; refresh a
// little before that so the socket's auth never actually lapses.
const TOKEN_REFRESH_MS = 4 * 60 * 1000;

function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const mins = Math.round(seconds / 60);
  return `منذ ${mins} د`;
}

export default function LiveTrackingMap() {
  const [locations, setLocations] = useState<DriverLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const knownDrivers = useRef<Map<string, { name: string; phone: string }>>(new Map());
  const reconcileRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/driver-locations");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ");
        return;
      }
      setError(null);
      const rows: DriverLocation[] = data.locations ?? [];
      for (const row of rows) {
        if (row.drivers) knownDrivers.current.set(row.driver_id, row.drivers);
      }
      setLocations(rows);
    } catch {
      setError("تعذر الاتصال بالخادم");
    }
  }, []);

  const refreshRealtimeAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/realtime-token");
      if (!res.ok) return;
      const { token } = await res.json();
      await supabaseBrowser().realtime.setAuth(token);
    } catch {
      // Best-effort — the reconcile poll covers us if a refresh is missed.
    }
  }, []);

  const upsertLocation = useCallback((row: {
    driver_id: string;
    lat: number;
    lng: number;
    updated_at: string;
  }) => {
    const driver = knownDrivers.current.get(row.driver_id) ?? null;
    if (!driver) {
      // First time seeing this driver this session — we don't have their
      // name/phone from a raw table-change payload, so pull a full
      // snapshot to fill it in rather than showing "unknown."
      loadSnapshot();
      return;
    }
    setLocations((prev) => {
      const next = (prev ?? []).filter((l) => l.driver_id !== row.driver_id);
      next.push({ ...row, drivers: driver });
      return next;
    });
  }, [loadSnapshot]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      await loadSnapshot();
      await refreshRealtimeAuth();
      if (cancelled) return;

      const supabase = supabaseBrowser();
      const channel = supabase
        .channel("admin-driver-locations")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "driver_locations" },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { driver_id?: string }).driver_id;
              if (oldId) {
                setLocations((prev) => (prev ?? []).filter((l) => l.driver_id !== oldId));
              }
              return;
            }
            upsertLocation(
              payload.new as { driver_id: string; lat: number; lng: number; updated_at: string }
            );
          }
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setError("تعذر الاتصال بالتحديث الفوري — يعاد المحاولة...");
          } else if (status === "SUBSCRIBED") {
            setError(null);
          }
        });
      channelRef.current = channel;
    }

    start();
    reconcileRef.current = setInterval(loadSnapshot, RECONCILE_INTERVAL_MS);
    tokenRefreshRef.current = setInterval(refreshRealtimeAuth, TOKEN_REFRESH_MS);

    return () => {
      cancelled = true;
      if (reconcileRef.current) clearInterval(reconcileRef.current);
      if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current);
      if (channelRef.current) supabaseBrowser().removeChannel(channelRef.current);
    };
  }, [loadSnapshot, refreshRealtimeAuth, upsertLocation]);

  // Prune drivers who've gone stale without us receiving a final event
  // (e.g. the tab was just closed, no DELETE row exists to notify us).
  useEffect(() => {
    const timer = setInterval(() => {
      setLocations((prev) =>
        (prev ?? []).filter(
          (l) => Date.now() - new Date(l.updated_at).getTime() < ONLINE_WINDOW_MS
        )
      );
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (error && !locations) {
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
      label: l.drivers?.name ?? "غير معروف",
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

  const statusLine = error
    ? error
    : locations
    ? `${locations.length} مندوب متصل الآن`
    : "جارٍ التحميل...";

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-background)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <p
            className={`text-sm ${
              error ? "text-[var(--color-destructive)]" : "text-[var(--color-muted)]"
            }`}
          >
            {statusLine}
          </p>
          <button className="btn-outline text-sm py-1.5 px-3" onClick={() => setExpanded(false)}>
            إغلاق ملء الشاشة
          </button>
        </div>
        <div className="flex-1">
          <LocationMap pins={pins} height="100%" />
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col gap-3 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <p
          className={`text-sm ${
            error ? "text-[var(--color-destructive)]" : "text-[var(--color-muted)]"
          }`}
        >
          {statusLine}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--color-muted)]">تحديث فوري</p>
          <button
            className="text-xs text-[var(--color-primary)] cursor-pointer"
            onClick={() => setExpanded(true)}
          >
            ملء الشاشة
          </button>
        </div>
      </div>
      <LocationMap pins={pins} />
      {locations && locations.length === 0 && (
        <p className="text-sm text-[var(--color-muted)] text-center py-4">
          لا يوجد مندوبون متصلون حاليًا
        </p>
      )}
      <div className="flex flex-col gap-2">
        {locations?.map((l) => (
          <div key={l.driver_id} className="card flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{l.drivers?.name ?? "غير معروف"}</p>
              <p className="text-xs text-[var(--color-muted)]" dir="ltr">
                {l.drivers?.phone}
              </p>
            </div>
            <span className="text-xs text-[var(--color-muted)]">{timeAgo(l.updated_at)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
