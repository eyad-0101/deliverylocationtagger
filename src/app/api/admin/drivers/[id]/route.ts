import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const updates: Record<string, boolean> = {};

  if (typeof body?.isAdmin === "boolean") {
    if (id === session.driverId && !body.isAdmin) {
      return NextResponse.json(
        { error: "لا يمكنك إلغاء صلاحياتك كمسؤول عن نفسك" },
        { status: 400 },
      );
    }
    updates.is_admin = body.isAdmin;
  }

  if (typeof body?.approved === "boolean") {
    if (id === session.driverId && !body.approved) {
      return NextResponse.json(
        { error: "لا يمكنك إيقاف حسابك الخاص" },
        { status: 400 },
      );
    }
    updates.approved = body.approved;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "قيمة غير صالحة" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("drivers").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: admins only. Deletes the driver but KEEPS the location tags they
// created — added_by (and edited_by) just fall back to NULL. Requires the
// migration in supabase/schema.sql that makes location_tags.added_by
// nullable with "on delete set null" (previously it was NOT NULL with no
// cascade behavior, which is why this route used to delete the tags first
// to avoid a foreign key violation).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.driverId) {
    return NextResponse.json(
      { error: "لا يمكنك حذف حسابك الخاص" },
      { status: 400 },
    );
  }

  const supabase = supabaseAdmin();

  // 1. Unlink any tags this driver has edited (edited_by was already
  //    nullable, so this part is unchanged).
  const { error: editError } = await supabase
    .from("location_tags")
    .update({ edited_by: null, edited_at: null })
    .eq("edited_by", id);

  if (editError) {
    return NextResponse.json({ error: editError.message }, { status: 500 });
  }

  // 2. Delete the driver. Tags they added are kept — added_by is set to
  //    NULL automatically by the "on delete set null" foreign key.
  const { error: driverError } = await supabase
    .from("drivers")
    .delete()
    .eq("id", id);

  if (driverError) {
    return NextResponse.json({ error: driverError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
