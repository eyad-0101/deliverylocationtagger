import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Returns the current (latest, non-superseded) tag for every customer
// phone number — used to render the "all pins" overview map. Admin-only:
// this is the one place customer locations are browsable in bulk rather
// than looked up one phone number at a time.
//
// Driver names are joined manually (a second query + in-memory map) rather
// than via PostgREST's relationship embedding (drivers!added_by(name)).
// Embedding through a view like latest_location_tags is unreliable —
// PostgREST can't always resolve the underlying foreign key through a
// view's query plan, which surfaces as "Could not find a relationship...".
// A manual join sidesteps that class of error entirely.
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data: tags, error } = await supabase
    .from("latest_location_tags")
    .select(
      "id, customer_phone, customer_name, lat, lng, note, label, created_at, added_by, edited_by, edited_at"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const driverIds = Array.from(
    new Set(
      (tags ?? []).flatMap((t) => [t.added_by, t.edited_by].filter(Boolean))
    )
  );

  let driverNames = new Map<string, string>();
  if (driverIds.length > 0) {
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name")
      .in("id", driverIds);

    if (driversError) {
      return NextResponse.json({ error: driversError.message }, { status: 500 });
    }
    driverNames = new Map((drivers ?? []).map((d) => [d.id, d.name]));
  }

  const enriched = (tags ?? []).map((t) => ({
    ...t,
    drivers: { name: driverNames.get(t.added_by) ?? "غير معروف" },
    editor: t.edited_by
      ? { name: driverNames.get(t.edited_by) ?? "غير معروف" }
      : null,
  }));

  return NextResponse.json({ tags: enriched });
}
