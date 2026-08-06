import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Admin-only: browsing every customer location at once is bulk exposure of
// the whole database, not something a regular driver needs — drivers look
// up one phone number at a time via /api/tags/search instead.
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("latest_location_tags")
    .select("id, customer_phone, lat, lng, label")
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tags: data ?? [] });
}
