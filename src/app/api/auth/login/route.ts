import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPassword, createSessionCookie } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

const BAD_CREDENTIALS = { error: "بيانات الدخول غير صحيحة" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const identifier = (body?.identifier ?? body?.phone ?? "") as string;
  const password = body?.password as string | undefined;

  if (!identifier.trim() || !password) {
    return NextResponse.json(BAD_CREDENTIALS, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const asPhone = normalizePhone(identifier);

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
      return NextResponse.json(
        { error: "الاسم غير فريد — سجّل الدخول برقم الهاتف بدلًا من ذلك" },
        { status: 400 }
      );
    }
  }

  if (!driver) {
    return NextResponse.json(BAD_CREDENTIALS, { status: 401 });
  }

  const valid = await verifyPassword(password, driver.password_hash);
  if (!valid) {
    return NextResponse.json(BAD_CREDENTIALS, { status: 401 });
  }

  await createSessionCookie({
    driverId: driver.id,
    phone: driver.phone,
    name: driver.name,
    isAdmin: driver.is_admin,
  });

  return NextResponse.json({ ok: true });
}
