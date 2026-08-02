import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const isAdmin = body?.isAdmin;

  if (typeof isAdmin !== "boolean") {
    return NextResponse.json({ error: "قيمة غير صالحة" }, { status: 400 });
  }

  if (id === session.driverId && !isAdmin) {
    return NextResponse.json(
      { error: "لا يمكنك إلغاء صلاحياتك كمسؤول عن نفسك" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("drivers")
    .update({ is_admin: isAdmin })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
