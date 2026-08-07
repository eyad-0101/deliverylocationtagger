import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// Admin-only activity feed. location_tags doesn't store one row per event —
// it stores one row per pin, with added_by/edited_by/flagged_by columns
// layered on top. This route unpacks each row into up to three separate
// timeline events (tagged, edited, flagged) so the admin UI can show a
// simple reverse-chronological "who did what, when" list without the
// client needing to know about the underlying table shape.
//
// Pulls the most recent ROWS (not events) up to AUDIT_ROW_LIMIT, then
// expands those into events — so on a busy install this reflects the most
// recent activity on the most recently-touched pins, which is the
// common case for an admin checking "what happened today/this week".
const AUDIT_ROW_LIMIT = 500;

type AuditEvent = {
  id: string; // synthetic, unique per event (row id + event type)
  type: "tagged" | "edited" | "flagged";
  at: string;
  actorId: string | null;
  actorName: string;
  tagId: string;
  customerPhone: string;
  customerName: string | null;
  label: string | null;
};

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("location_tags")
    .select(
      "id, customer_phone, customer_name, label, added_by, created_at, edited_by, edited_at, flagged_by, flagged_at, superseded"
    )
    .order("created_at", { ascending: false })
    .limit(AUDIT_ROW_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const driverIds = Array.from(
    new Set(
      (rows ?? []).flatMap((r) => [r.added_by, r.edited_by, r.flagged_by].filter(Boolean))
    )
  );

  let driverNames = new Map<string, string>();
  if (driverIds.length > 0) {
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name")
      .in("id", driverIds);

    if (driversError) {
      return NextResponse.json({ error: driversError.message }, { status: 500 });
    }
    driverNames = new Map((drivers ?? []).map((d) => [d.id, d.name]));
  }

  const nameOf = (id: string | null) =>
    id ? driverNames.get(id) ?? "غير معروف" : "غير معروف";

  const events: AuditEvent[] = [];

  for (const r of rows ?? []) {
    events.push({
      id: `${r.id}:tagged`,
      type: "tagged",
      at: r.created_at,
      actorId: r.added_by,
      actorName: nameOf(r.added_by),
      tagId: r.id,
      customerPhone: r.customer_phone,
      customerName: r.customer_name,
      label: r.label,
    });

    if (r.edited_at) {
      events.push({
        id: `${r.id}:edited`,
        type: "edited",
        at: r.edited_at,
        actorId: r.edited_by,
        actorName: nameOf(r.edited_by),
        tagId: r.id,
        customerPhone: r.customer_phone,
        customerName: r.customer_name,
        label: r.label,
      });
    }

    // Older rows may have superseded=true from before flagged_by/flagged_at
    // existed — show them with an unknown actor/time rather than dropping
    // them from the feed entirely.
    if (r.superseded) {
      events.push({
        id: `${r.id}:flagged`,
        type: "flagged",
        at: r.flagged_at ?? r.edited_at ?? r.created_at,
        actorId: r.flagged_by,
        actorName: r.flagged_by ? nameOf(r.flagged_by) : "غير معروف (قبل إضافة السجل)",
        tagId: r.id,
        customerPhone: r.customer_phone,
        customerName: r.customer_name,
        label: r.label,
      });
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({
    events,
    drivers: Array.from(driverNames.entries()).map(([id, name]) => ({ id, name })),
  });
}
