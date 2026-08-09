import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// PATCH: alter an existing pin's details. Any logged-in driver can do this —
// same access level as tagging in the first place. Note this updates the
// row in place rather than adding a new version-history entry; use the
// existing "flag as wrong + re-tag" flow instead if you want the change
// preserved in history. We do stamp edited_by/edited_at so there's at
// least a record of who last touched it and when.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const updates: Record<string, unknown> = {};

  if (body?.lat !== undefined || body?.lng !== undefined) {
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const coordsValid =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;
    if (!coordsValid) {
      return NextResponse.json(
        { error: "إحداثيات غير صالحة" },
        { status: 400 }
      );
    }
    updates.lat = lat;
    updates.lng = lng;
  }
  if (typeof body?.note === "string") updates.note = body.note || null;
  if (typeof body?.label === "string") updates.label = body.label || null;
  if (typeof body?.customerName === "string")
    updates.customer_name = body.customerName || null;
  if (typeof body?.photoUrl === "string") {
    // Same rule as tag creation: only accept URLs from our own bucket, and
    // allow an explicit empty string through as "remove the photo."
    if (body.photoUrl && !body.photoUrl.includes("/pin-photos/")) {
      return NextResponse.json({ error: "رابط صورة غير صالح" }, { status: 400 });
    }
    updates.photo_url = body.photoUrl || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "لا يوجد تعديلات" }, { status: 400 });
  }

  updates.edited_by = session.driverId;
  updates.edited_at = new Date().toISOString();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("location_tags")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tag: data });
}

// DELETE: admins only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "المسؤولون فقط يمكنهم الحذف" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("location_tags").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
