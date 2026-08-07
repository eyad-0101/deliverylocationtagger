import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  verifyPassword,
  hashPassword,
  createSessionCookie,
} from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const BAD_CREDENTIALS = { error: "بيانات الدخول غير صحيحة" };
const NAME_NOT_UNIQUE = {
  error: "الاسم غير فريد — سجّل الدخول برقم الهاتف بدلًا من ذلك",
};
const RATE_LIMITED = {
  error: "محاولات كثيرة جدًا، حاول مرة أخرى بعد قليل",
};

// The two shared shift passwords. Any driver — new or existing — can log in
// with one of these instead of an individual password. This is intentionally
// simple for an internal tool: it is NOT per-driver secret, it's just a
// shift gate. First-time name/phone combos are auto-registered here.
const SHIFT_WORDS = ["day", "night"];

// This endpoint both logs drivers in AND silently creates new accounts on
// the shift-word path, so it's worth limiting harder than a typical login
// route — otherwise a script could spam-create driver accounts.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = rateLimit(
    `login:${ip}`,
    LOGIN_LIMIT,
    LOGIN_WINDOW_SECONDS
  );

  if (!allowed) {
    return NextResponse.json(RATE_LIMITED, {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }

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
  } else if (isShiftLogin && !driver.is_admin) {
    // Existing NON-admin account + shift-word path: no per-account check,
    // the shift word itself is the credential. Admin accounts are
    // deliberately excluded from this branch — the shift word is a low-
    // friction gate for regular drivers, not a master password. Without
    // this check, anyone who knew (or guessed) an admin's phone/name could
    // log in as that admin using just "day"/"night", skipping their real
    // password entirely.
  } else {
    // Either a real-password login, or a shift-word attempt against an
    // admin account (which is intentionally NOT allowed to use the shift
    // word) — verify against the account's own password hash either way.
    const valid = await verifyPassword(password, driver.password_hash);
    if (!valid) {
      return NextResponse.json(BAD_CREDENTIALS, { status: 401 });
    }
  }

  await createSessionCookie({
    driverId: driver.id,
    phone: driver.phone,
    name: driver.name,
    isAdmin: driver.is_admin,
  });

  return NextResponse.json({ ok: true });
}
