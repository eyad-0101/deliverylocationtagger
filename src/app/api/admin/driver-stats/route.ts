import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Admin-only leaderboard: how many locations has each driver tagged today
// vs. this week. Counts *tagging* events only (created_at), not edits or
// flags — this is meant to reflect field activity, not admin cleanup work.
//
// Supabase's JS client doesn't have a clean GROUP BY, so this pulls raw
// (added_by, created_at) pairs for the last 7 days and aggregates in
// memory. Fine at this data volume (an internal delivery tool); if the
// table grows into the tens of thousands of weekly rows, switch this to a
// Postgres view or RPC instead.
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [{ data: drivers, error: driversError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase.from("drivers").select("id, name"),
      supabase
        .from("location_tags")
        .select("added_by, created_at")
        .gte("created_at", sevenDaysAgo.toISOString()),
    ]);

  if (driversError) {
    return NextResponse.json({ error: driversError.message }, { status: 500 });
  }
  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  const counts = new Map<string, { today: number; week: number }>();
  for (const r of rows ?? []) {
    const entry = counts.get(r.added_by) ?? { today: 0, week: 0 };
    entry.week += 1;
    if (new Date(r.created_at) >= startOfToday) entry.today += 1;
    counts.set(r.added_by, entry);
  }

  const leaderboard = (drivers ?? [])
    .map((d) => ({
      driverId: d.id,
      name: d.name,
      today: counts.get(d.id)?.today ?? 0,
      week: counts.get(d.id)?.week ?? 0,
    }))
    // Only show drivers with at least one tag this week — an admin with
    // 40 drivers doesn't need to scroll past 30 rows of zeros.
    .filter((d) => d.week > 0)
    .sort((a, b) => b.week - a.week);

  return NextResponse.json({ leaderboard });
}
