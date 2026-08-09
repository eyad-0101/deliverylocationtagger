import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Rolling 30-day window ending today (not the calendar month) — so it's
// always a full 30 days of data rather than showing a mostly-empty chart
// on the 2nd of a new month. Same in-memory aggregation approach as
// /api/admin/driver-stats, for the same reason (small data volume, no
// GROUP BY in the JS client).
const WINDOW_DAYS = 30;

function dayKey(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const driverId = req.nextUrl.searchParams.get("driverId");
  if (!driverId) {
    return NextResponse.json({ error: "driverId مطلوب" }, { status: 400 });
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (WINDOW_DAYS - 1));

  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("location_tags")
    .select("created_at")
    .eq("added_by", driverId)
    .gte("created_at", startDate.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const key = dayKey(r.created_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Always return all 30 days, zero-filled — the chart needs a fixed-width
  // series, not just the days that happen to have activity.
  const days: { date: string; count: number }[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = dayKey(d.toISOString());
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return NextResponse.json({ days, total: days.reduce((sum, d) => sum + d.count, 0) });
}
