import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// GET /api/admin/deliveries - Fetch all active deliveries with driver info
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status");
  const includeCompleted = searchParams.get("includeCompleted") === "true";

  const supabase = supabaseAdmin();
  let query = supabase
    .from("deliveries")
    .select(
      "id, customer_phone, customer_name, customer_lat, customer_lng, customer_address, driver_id, status, note, assigned_at, picked_up_at, delivered_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (!includeCompleted) {
    query = query.in("status", ["pending", "assigned", "picked_up", "in_transit"]);
  } else if (status) {
    query = query.eq("status", status);
  }

  const { data: deliveries, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with driver names and latest driver locations
  const driverIds = Array.from(
    new Set((deliveries ?? []).map((d) => d.driver_id).filter(Boolean))
  );

  let driverInfo = new Map<string, { name: string; lat?: number; lng?: number; is_online?: boolean }>();
  if (driverIds.length > 0) {
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name")
      .in("id", driverIds);

    if (driversError) {
      return NextResponse.json({ error: driversError.message }, { status: 500 });
    }

    const { data: locations, error: locError } = await supabase
      .from("driver_locations")
      .select("driver_id, lat, lng, is_online")
      .in("driver_id", driverIds);

    if (!locError && locations) {
      locations.forEach((loc) => {
        const existing = driverInfo.get(loc.driver_id);
        if (existing) {
          driverInfo.set(loc.driver_id, { ...existing, lat: loc.lat, lng: loc.lng, is_online: loc.is_online });
        }
      });
    }

    (drivers ?? []).forEach((d) => {
      const existing = driverInfo.get(d.id);
      if (existing) {
        driverInfo.set(d.id, { ...existing, name: d.name });
      } else {
        driverInfo.set(d.id, { name: d.name });
      }
    });
  }

  const enriched = (deliveries ?? []).map((d) => ({
    ...d,
    driver: d.driver_id ? driverInfo.get(d.driver_id) ?? null : null,
  }));

  return NextResponse.json({ deliveries: enriched });
}

// POST /api/admin/deliveries - Create a new delivery
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const {
    customer_phone,
    customer_name,
    customer_lat,
    customer_lng,
    customer_address,
    driver_id,
    note,
  } = body;

  if (!customer_phone) {
    return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("deliveries")
    .insert({
      customer_phone,
      customer_name: customer_name ?? null,
      customer_lat: customer_lat ?? null,
      customer_lng: customer_lng ?? null,
      customer_address: customer_address ?? null,
      driver_id: driver_id ?? null,
      status: driver_id ? "assigned" : "pending",
      note: note ?? null,
      assigned_at: driver_id ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ delivery: data });
}
