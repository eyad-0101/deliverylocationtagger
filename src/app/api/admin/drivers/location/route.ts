import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// GET /api/admin/drivers/location - Get all drivers with their latest locations
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  
  // Get all drivers
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id, phone, name, is_admin, created_at");

  if (driversError) {
    return NextResponse.json({ error: driversError.message }, { status: 500 });
  }

  const driverIds = (drivers ?? []).map((d) => d.id);
  
  if (driverIds.length === 0) {
    return NextResponse.json({ drivers: [] });
  }

  // Get latest location for each driver
  const { data: locations, error: locError } = await supabase
    .from("driver_locations")
    .select("driver_id, lat, lng, accuracy, speed, heading, battery_level, is_online, last_seen_at")
    .in("driver_id", driverIds)
    .order("last_seen_at", { ascending: false });

  if (locError) {
    return NextResponse.json({ error: locError.message }, { status: 500 });
  }

  // Keep only the latest location per driver
  const latestLocations = new Map<string, any>();
  (locations ?? []).forEach((loc) => {
    if (!latestLocations.has(loc.driver_id)) {
      latestLocations.set(loc.driver_id, loc);
    }
  });

  // Enrich drivers with location data
  const enriched = (drivers ?? []).map((d) => ({
    ...d,
    location: latestLocations.get(d.id) ?? null,
  }));

  return NextResponse.json({ drivers: enriched });
}

// POST /api/admin/drivers/location - Update driver location (for driver app)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const {
    lat,
    lng,
    accuracy,
    speed,
    heading,
    battery_level,
    is_online = true,
  } = body;

  if (lat === undefined || lng === undefined || !session.driverId) {
    return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("driver_locations")
    .insert({
      driver_id: session.driverId,
      lat,
      lng,
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      heading: heading ?? null,
      battery_level: battery_level ?? null,
      is_online,
      last_seen_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ location: data });
}
