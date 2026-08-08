"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-only client using the public anon key. This key alone grants no
// access to anything — every table (including driver_locations) has RLS
// closed by default; access is opened per-request by a short-lived token
// minted server-side and passed to supabase.realtime.setAuth() (see
// useAdminRealtime in LiveTrackingMap.tsx). Never use this client to read
// or write data directly; it exists only to drive Realtime subscriptions.
let client: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars"
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  return client;
}
