import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.customerPhone ?? "");
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const note = (body?.note as string | undefined)?.trim() || null;
  const label = (body?.label as string | undefined) || null;
  const customerName = (body?.customerName as string | undefined)?.trim() || null;

  if (!phone || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "بيانات غير مكتملة أو رقم هاتف غير صالح" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("location_tags")
    .insert({
      customer_phone: phone,
      customer_name: customerName,
      lat,
      lng,
      note,
      label,
      added_by: session.driverId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tag: data });
}
