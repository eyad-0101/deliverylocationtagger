import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const rawPhone = req.nextUrl.searchParams.get("phone") ?? "";
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return NextResponse.json(
      { error: "رقم الهاتف غير صالح" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("location_tags")
    .select(
      "id, customer_phone, customer_name, lat, lng, note, label, superseded, created_at, added_by, edited_by, edited_at, drivers!added_by(name), editor:drivers!edited_by(name)"
    )
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phone, tags: data ?? [] });
}
