import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession, hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("drivers")
    .select("id, phone, name, is_admin, approved, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone ?? "");
  const name = (body?.name as string | undefined)?.trim();
  const password = body?.password as string | undefined;

  if (!phone || !name || !password || password.length < 6) {
    return NextResponse.json(
      { error: "بيانات غير مكتملة أو كلمة مرور قصيرة جدًا" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const password_hash = await hashPassword(password);
  const { error } = await supabase.from("drivers").insert({
    phone,
    name,
    password_hash,
    is_admin: false,
    approved: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
