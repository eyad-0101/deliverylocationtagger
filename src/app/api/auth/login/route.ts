import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  verifyPassword,
  hashPassword,
  createSessionCookie,
} from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

const BAD_CREDENTIALS = { error: "بيانات الدخول غير صحيحة" };
const NAME_NOT_UNIQUE = {
  error: "الاسم غير فريد — سجّل الدخول برقم الهاتف بدلًا من ذلك",
};

// The two shared shift passwords. Any driver — new or existing — can log in
// with one of these instead of an individual password. This is intentionally
// simple for an internal tool: it is NOT per-driver secret, it's just a
// shift gate. First-time name/phone combos are auto-registered here.
const SHIFT_WORDS = ["day", "night"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const identifier = (body?.identifier ?? body?.phone ?? "") as string;
  const password = body?.password as string | undefined;

  if (!identifier.trim() || !password) {
    return NextResponse.json(BAD_CREDENTIALS, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const asPhone = normalizePhone(identifier);
  const isShiftLogin = SHIFT_WORDS.includes(password.trim().toLowerCase());

  let driver;

  if (asPhone) {
    // Looks like a phone number — match by phone.
    const { data } = await supabase
      .from("drivers")
      .select("id, phone, password_hash, name, is_admin")
      .eq("phone", asPhone)
      .maybeSingle();
    driver = data;
  } else {
    // Not a valid phone format — try matching by name instead
    // (case-insensitive, trimmed).
    const { data: matches } = await supabase
      .from("drivers")
      .select("id, phone, password_hash, name, is_admin")
      .ilike("name", identifier.trim());

    if (matches && matches.length === 1) {
      driver = matches[0];
    } else if (matches && matches.length > 1) {
      // Name isn't unique — can't safely pick one.
      return NextResponse.json(NAME_NOT_UNIQUE, { status: 400 });
    }
  }

  if (!driver) {
    // No existing account. Only auto-register on the shift-word path —
    // a real (admin-set) password should never silently create an account.
    if (!isShiftLogin) {
      return NextResponse.json(BAD_CREDENTIALS, { status: 401 });
    }

    const password_hash = await hashPassword(password);
    const { data: created, error } = await supabase
      .from("drivers")
      .insert({
        phone: asPhone ?? null,
        name: asPhone ?? identifier.trim(),
        password_hash,
        is_admin: false,
      })
      .select("id, phone, password_hash, name, is_admin")
      .single();

    if (error || !created) {
      // Most likely someone else registered this phone in a race just now.
      return NextResponse.json(
        { error: "تعذر إنشاء الحساب، حاول مرة أخرى" },
        { status: 500 }
      );
    }

    driver = created;
  } else if (!isShiftLogin) {
    // Existing account, real password path — verify against their own hash.
    const valid = await verifyPassword(password, driver.password_hash);
    if (!valid) {
      return NextResponse.json(BAD_CREDENTIALS, { status: 401 });
    }
  }
  // Existing account + shift-word path: no per-account check, the shift
  // word itself is the credential.

  await createSessionCookie({
    driverId: driver.id,
    phone: driver.phone,
    name: driver.name,
    isAdmin: driver.is_admin,
  });

  return NextResponse.json({ ok: true });
}
