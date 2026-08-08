import { SignJWT } from "jose";

// Mints a short-lived token that Supabase's Realtime server (and, if we
// ever pointed it there, PostgREST) will accept as proof of "this
// connection belongs to an admin." It's signed with the project's legacy
// JWT secret (Settings > API > JWT Settings > "JWT Secret" in the
// Supabase dashboard — NOT the anon or service_role key), so only our own
// server can mint one, but it's fully independent of Supabase Auth: we
// never create a Supabase Auth user, we just satisfy the JWT shape
// Supabase's gateway expects (`role`, `exp`) plus our own custom
// `is_admin` claim, which the RLS policy on driver_locations checks via
// auth.jwt() ->> 'is_admin'.
//
// Kept short-lived (5 min) and re-minted by the client on a timer rather
// than made long-lived, so a token copied out of dev tools stops working
// quickly, and revoking admin status (see lib/auth.ts) takes effect on
// the next mint instead of lingering for the life of a long token.
const REALTIME_TOKEN_TTL_SECONDS = 5 * 60;

function getJwtSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing SUPABASE_JWT_SECRET env var");
  }
  return new TextEncoder().encode(secret);
}

export async function mintAdminRealtimeToken() {
  const token = await new SignJWT({
    role: "authenticated",
    is_admin: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REALTIME_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());

  return { token, ttlSeconds: REALTIME_TOKEN_TTL_SECONDS };
}
