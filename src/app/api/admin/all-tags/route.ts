import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Returns the current (latest, non-superseded) tag for every customer
// phone number — used to render the "all pins" overview map. Admin-only:
// this is the one place customer locations are browsable in bulk rather
// than looked up one phone number at a time.
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("latest_location_tags")
    .select(
      "id, customer_phone, customer_name, lat, lng, note, label, created_at, added_by, edited_by, edited_at, drivers!location_tags_added_by_fkey(name), editor:drivers!location_tags_edited_by_fkey(name)"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tags: data ?? [] });
}
