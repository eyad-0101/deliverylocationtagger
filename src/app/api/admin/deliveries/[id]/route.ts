import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

// PATCH /api/admin/deliveries/[id] - Update delivery status or assign driver
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
  const {
    status,
    driver_id,
    customer_name,
    customer_lat,
    customer_lng,
    customer_address,
    note,
  } = body;

  const supabase = supabaseAdmin();
  const updates: Record<string, any> = {};

  if (status !== undefined) {
    updates.status = status;
    if (status === "assigned" && driver_id) {
      updates.assigned_at = new Date().toISOString();
    } else if (status === "picked_up") {
      updates.picked_up_at = new Date().toISOString();
    } else if (status === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }
  }

  if (driver_id !== undefined) {
    updates.driver_id = driver_id;
    if (driver_id && !updates.status) {
      updates.status = "assigned";
      updates.assigned_at = new Date().toISOString();
    }
  }

  if (customer_name !== undefined) updates.customer_name = customer_name;
  if (customer_lat !== undefined) updates.customer_lat = customer_lat;
  if (customer_lng !== undefined) updates.customer_lng = customer_lng;
  if (customer_address !== undefined) updates.customer_address = customer_address;
  if (note !== undefined) updates.note = note;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("deliveries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ delivery: data });
}

// DELETE /api/admin/deliveries/[id] - Cancel/delete a delivery
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("deliveries")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
