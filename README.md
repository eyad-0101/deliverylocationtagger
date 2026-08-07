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
- **Auth** — drivers log in with just their name or phone number and pick a
  shift, "Day" or "Night" — there's no individual password to remember. The
  shift word is shared by everyone (it's a shift gate, not a per-driver
  secret): typing a name/phone that doesn't exist yet auto-creates the
  driver account on the spot, no admin step required. Admin accounts (and
  any driver an admin manually assigns a real password to) still log in
  with their own password instead — the login form auto-detects this since
  "Day"/"Night" always takes the self-service path. Because the shift word
  is shared, anyone who knows it can log in as any existing driver by
  typing their name/phone — acceptable for this internal-tool threat model,
  but worth keeping in mind. There's still no self-service password
  *reset* for the admin-password path — an admin resets those from
  `/admin`.
- **Roles & permissions** — admins can promote/demote other drivers to
  admin from `/admin`, and edit or permanently delete any pin, or view
  every current pin at once, from `/admin/pins`. Admins can also delete a
  driver's account entirely from `/admin`.
  Regular drivers can edit (alter) a pin's note/label/customer name from
  the search results on `/dashboard`, but cannot delete pins — deletion is
  admin-only. Note that "alter" updates the pin's row in place rather than
  adding a new version-history entry; use the existing "flag as wrong +
  re-tag" flow instead if you want a change preserved in history.
- **Fullscreen map** — on `/dashboard`, a "ملء الشاشة" link expands
  whichever map is currently showing (the default all-pins view, or a
  found customer's pin + route) to fill the whole screen. Escape or the
  close button returns to normal.
- **Live driver tracking** (`/admin/live`, admin only) — while a driver
  has `/dashboard` open, their browser silently reports its GPS position
  every 20s to `/api/location/ping` (best-effort — fails silently with no
  permission/GPS/connection, never interrupts their work). The admin view
  polls `/api/admin/driver-locations` every 10s and plots each driver as a
  green marker, showing name, phone, and how long ago they last checked
  in. A driver is only shown if their last ping was within 5 minutes, so
  someone who closed the tab or lost signal doesn't linger on the map
  looking falsely "online." This is polling, not a push-based websocket —
  simple and consistent with the rest of the app's architecture, at the
  cost of up to ~10s of lag versus true realtime.

## Keeping the free Supabase project awake
Supabase's free tier pauses a project after 7 days with no activity. There's
a GitHub Actions workflow at `.github/workflows/keep-alive.yml` that pings
the database twice a week (Monday & Thursday) so it never sits idle long
enough to pause. To enable it:

1. In your GitHub repo, go to **Settings > Secrets and variables > Actions**
   and add two repository secrets:
   - `SUPABASE_URL` — same value as `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — same value as your `.env.local`
2. That's it — the workflow runs on its own schedule. You can also trigger
   it manually anytime from the **Actions** tab ("Run workflow") to confirm
   it's wired up correctly.

Two caveats: GitHub disables scheduled workflows automatically if the
*repo itself* (not the DB) gets no commits/activity for 60 days — if that
ever happens, just re-enable it from the Actions tab. And if you're on a
private repo on a free GitHub plan, scheduled Actions minutes still come
out of your free monthly quota, but a twice-weekly ~1-second curl call is
negligible.


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
