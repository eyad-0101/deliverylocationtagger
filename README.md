# Delivery Location Tagger

Internal tool for delivery drivers: search a customer's phone number to see
their saved location on a map, or tag a new one if it's not saved yet.

## Stack
- Next.js (App Router) + React + TypeScript + Tailwind CSS
- Supabase (Postgres) for data
- Leaflet + OpenStreetMap for the map (no API key, no billing account, no card required)
- Custom phone + password auth (no third-party auth provider)

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Supabase project** at https://supabase.com, then run the SQL
   in `supabase/schema.sql` in the Supabase SQL editor. This creates the
   `drivers` and `location_tags` tables.

3. **Copy the env file and fill in your keys:**
   ```
   cp .env.local.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
     `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Settings > API
   - `SESSION_SECRET` — generate with `openssl rand -base64 32`
   - `ADMIN_BOOTSTRAP_PHONE` / `ADMIN_BOOTSTRAP_PASSWORD` — credentials for
     the first admin account (change the password after first login)

   No map API key needed — the map runs on Leaflet + OpenStreetMap, which
   requires no account, no billing, and no card.

4. **Run locally:**
   ```
   npm run dev
   ```

5. **Create the first admin account** — with the app running, call:
   ```
   curl -X POST http://localhost:3000/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"phone":"<ADMIN_BOOTSTRAP_PHONE>","password":"<ADMIN_BOOTSTRAP_PASSWORD>"}'
   ```
   This only works once (it refuses if an admin already exists). Log in at
   `/login`, then go to `/admin` to add driver accounts.

## How it works

- **Search** (`/dashboard`) — a driver enters a customer's phone number.
  If a location exists, the most recent (non-superseded) tag shows as the
  current pin; older tags show faded on the map with full history below,
  including who added each one and when.
- **Miss -> tag** — if nothing is found, the driver is prompted to tag the
  location immediately: tap the map or use their current GPS position, add
  an optional landmark note and label (home/work/other).
- **Wrong tag** — any driver can mark the current pin "wrong," which flags
  it as superseded (kept in history, no longer shown as current) without
  deleting anything.
- **Version history** — every tag is a new row in `location_tags`, never
  edited in place, so conflicts (customer moved, mistagged) just show up as
  history rather than overwriting data.
- **Offline queue** — if a tag is submitted with no connection, it's saved
  to `localStorage` and automatically retried the moment the browser comes
  back online (see `src/lib/offlineQueue.ts`).
- **Auth** — simple phone + password login for drivers. There's no
  self-service password reset by design (keeps things simple, no SMS/email
  provider needed) — an admin resets a driver's password from `/admin`.
- **Roles & permissions** — admins can promote/demote other drivers to
  admin from `/admin`, edit or permanently delete any pin from
  `/admin/pins`, and view every current pin at once on `/admin/map`.
  Regular drivers can edit (alter) a pin's note/label/customer name from
  the search results on `/dashboard`, but cannot delete pins — deletion is
  admin-only. Note that "alter" updates the pin's row in place rather than
  adding a new version-history entry; use the existing "flag as wrong +
  re-tag" flow instead if you want a change preserved in history.

## Not included yet (intentionally out of scope for v1)
- Confirmation/trust scoring on tags (e.g. "3 drivers confirmed this pin")
- Push notifications
- Native mobile app (this is a responsive web app, no offline app-shell
  caching / service worker added yet — only tag submissions queue offline)
- True turn-by-turn navigation (live rerouting, voice guidance). Instead,
  "drive mode" draws a route preview on the map (distance + ETA) using the
  free OSRM public routing server, then hands off to the driver's own
  Google Maps or Waze app for actual navigation — reusing a mature
  navigation engine rather than rebuilding one. Note: the public OSRM demo
  server is rate-limited and not meant for heavy production traffic; if
  driver count grows, self-hosting OSRM (open source) is the next step.
