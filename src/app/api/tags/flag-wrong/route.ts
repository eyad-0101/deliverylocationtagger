import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// One-tap "this location is wrong" action. Marks the tag as superseded so
// it stops showing as the current pin, but stays in history for context.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tagId = body?.tagId as string | undefined;
  if (!tagId) {
    return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("location_tags")
    .update({
      superseded: true,
      flagged_by: session.driverId,
      flagged_at: new Date().toISOString(),
    })
    .eq("id", tagId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
