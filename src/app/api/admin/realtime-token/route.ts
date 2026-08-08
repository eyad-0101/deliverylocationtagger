import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { mintAdminRealtimeToken } from "@/lib/realtimeAuth";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { token, ttlSeconds } = await mintAdminRealtimeToken();
  return NextResponse.json({ token, ttlSeconds });
}
