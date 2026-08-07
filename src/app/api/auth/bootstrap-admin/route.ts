import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

// One-time setup route: creates the first admin driver account from
// ADMIN_BOOTSTRAP_PHONE / ADMIN_BOOTSTRAP_PASSWORD env vars. Refuses to run
// if an admin already exists, so it's safe to leave deployed.
export async function POST(req: NextRequest) {
  const envPhone = normalizePhone(process.env.ADMIN_BOOTSTRAP_PHONE ?? "");
  const envPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!envPhone || !envPassword) {
    return NextResponse.json(
      { error: "Admin bootstrap is not configured" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  if (
    normalizePhone(body?.phone ?? "") !== envPhone ||
    body?.password !== envPassword
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { count } = await supabase
    .from("drivers")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", true);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "An admin account already exists" },
      { status: 409 }
    );
  }

  // Not "Admin" — that name is guessable, and even with the shift-word
  // exploit fixed, an easily-guessed admin identifier is worth avoiding.
  // Whoever bootstraps the account can rename it later via the admin panel
  // if desired; this is just a safer default.
  const password_hash = await hashPassword(envPassword);
  const { error } = await supabase.from("drivers").insert({
    phone: envPhone,
    password_hash,
    name: `Admin-${envPhone.slice(-4)}`,
    is_admin: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
