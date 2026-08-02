import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Any logged-in driver can see all current pins at once — this doesn't
// expose anything beyond what per-number search already allows (any driver
// can already look up any phone number one at a time), it's just a
// different presentation of the same access level.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
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
