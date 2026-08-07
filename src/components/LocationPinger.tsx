"use client";

import { useEffect } from "react";

const PING_INTERVAL_MS = 20000;

// Silently reports the driver's current position every 20s while the
// dashboard tab is open, so admins can see live positions in
// /admin/live. Fails silently (no permission, no GPS, offline) — this is
// a nice-to-have, not something that should interrupt a driver's work.
export default function LocationPinger() {
  useEffect(() => {
    if (!window.isSecureContext || !navigator.geolocation) return;

    let cancelled = false;

    function ping() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          fetch("/api/location/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 15000 }
      );
    }

    ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
