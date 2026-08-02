import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. Never import this from
// client components — it bypasses row-level security entirely, which is
// fine here because all access control happens in our own API routes via
// the session cookie (see lib/auth.ts).
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
