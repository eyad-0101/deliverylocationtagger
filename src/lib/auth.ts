import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";

const COOKIE_NAME = "driver_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET env var");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  driverId: string;
  phone: string;
  name: string;
  isAdmin: boolean;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload: SessionPayload;
  try {
    const verified = await jwtVerify(token, getSecretKey());
    payload = verified.payload as unknown as SessionPayload;
  } catch {
    return null;
  }

  // The JWT alone only proves "this cookie was issued for this driver at
  // some point in the last 30 days" — it says nothing about whether an
  // admin has since suspended them or changed their role. Re-checking the
  // DB on every call trades a bit of latency (one extra query per request)
  // for an immediate cutoff: revoking approval or admin rights takes
  // effect on the driver's very next request, not on their next login.
  // For an internal tool at this scale that trade is well worth it — a
  // suspended driver staying logged in for up to 30 days otherwise would
  // defeat the point of suspending them.
  const supabase = supabaseAdmin();
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, phone, name, is_admin, approved")
    .eq("id", payload.driverId)
    .maybeSingle();

  if (!driver || !driver.approved) {
    // Deleted or suspended since the cookie was issued — treat as logged
    // out rather than trusting the stale JWT claims.
    return null;
  }

  return {
    driverId: driver.id,
    phone: driver.phone,
    name: driver.name,
    isAdmin: driver.is_admin,
  };
}
