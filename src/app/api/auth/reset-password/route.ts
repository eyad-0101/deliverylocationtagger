import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession, hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

// Forgot-password flow: a driver can't reset their own password. An admin
// logs in and resets it for them here. Keeps auth dead simple with no SMS/
// email provider required.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const targetPhone = normalizePhone(body?.phone ?? "");
  const newPassword = body?.newPassword as string | undefined;

  if (!targetPhone || !newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "رقم غير صالح أو كلمة مرور قصيرة جدًا" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const password_hash = await hashPassword(newPassword);
  const { error } = await supabase
    .from("drivers")
    .update({ password_hash })
    .eq("phone", targetPhone);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
