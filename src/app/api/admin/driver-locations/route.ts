import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Only counts a driver as "online" if their last ping was recent — an old
// stale row shouldn't show someone as currently out on the road.
const ONLINE_WINDOW_MINUTES = 5;

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000).toISOString();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("driver_locations")
    .select("driver_id, lat, lng, updated_at, drivers(name, phone)")
    .gte("updated_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ locations: data ?? [] });
}
