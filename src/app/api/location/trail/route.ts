import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { currentTripFromHistory } from "@/lib/trail";

// A driver's own breadcrumb trail — only ever their own history, scoped
// to whatever "current trip" currentTripFromHistory decides is still in
// progress. Pulls up to 12h back (matches the retention window in
// /api/location/ping) and lets the trip-segmentation logic trim that down.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("driver_location_history")
    .select("lat, lng, recorded_at")
    .eq("driver_id", session.driverId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trip = currentTripFromHistory(
    (data ?? []).map((row) => ({ lat: row.lat, lng: row.lng, recordedAt: row.recorded_at }))
  );

  return NextResponse.json({
    trail: trip.map((p) => [p.lat, p.lng] as [number, number]),
  });
}
