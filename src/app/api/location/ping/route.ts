import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

// Client pings every ~20s, so 10/min gives comfortable headroom without
// letting a runaway loop hammer the database.
const PING_LIMIT = 10;
const PING_WINDOW_SECONDS = 60;

// Any logged-in driver can report their own current position. Upserts a
// single row per driver for "where are they now," and also appends to
// driver_location_history so the trail feature (see /api/location/trail)
// has a real breadcrumb to work with. History is pruned to the last 12h
// per driver on every ping — this only needs to cover a single day's
// trips, not stand in as a permanent audit log.
const HISTORY_RETENTION_HOURS = 12;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const { allowed, retryAfterSeconds } = rateLimit(
    `location-ping:${session.driverId}`,
    PING_LIMIT,
    PING_WINDOW_SECONDS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة جدًا" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "إحداثيات غير صالحة" }, { status: 400 });
  }

  const now = new Date();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("driver_locations").upsert({
    driver_id: session.driverId,
    lat,
    lng,
    updated_at: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort — a dropped history write shouldn't fail the ping itself,
  // since the live "current location" upsert above already succeeded.
  await supabase.from("driver_location_history").insert({
    driver_id: session.driverId,
    lat,
    lng,
    recorded_at: now.toISOString(),
  });
  const cutoff = new Date(now.getTime() - HISTORY_RETENTION_HOURS * 3600 * 1000);
  await supabase
    .from("driver_location_history")
    .delete()
    .eq("driver_id", session.driverId)
    .lt("recorded_at", cutoff.toISOString());

  return NextResponse.json({ ok: true });
}
