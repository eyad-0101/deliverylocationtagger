-- Delivery Location Tagger — database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists pgcrypto;

-- Drivers (the only accounts that can log in and tag locations)
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  phone text unique,                    -- format: 01012345678 (null if driver
                                         -- self-registered with just a name)
  password_hash text not null,
  name text not null,
  is_admin boolean not null default false,
  -- Gates login. New shift-word self-registrations start FALSE (pending
  -- admin approval); admins can also flip an already-approved driver back
  -- to FALSE later to suspend them without deleting their history. This is
  -- re-checked from the DB on every request (see lib/auth.ts), not just at
  -- login, so approving/suspending takes effect immediately — no need for
  -- the driver to log out and back in.
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

-- If you're running this against an EXISTING database that already has
-- "phone text unique not null", apply this migration instead of re-running
-- the create table above:
--   alter table drivers alter column phone drop not null;
--   alter table drivers add column if not exists approved boolean not null default true;

-- Location tags — one row per tag event, created via insert. Edits are
-- allowed in place (via PATCH) but tracked with edited_by/edited_at so
-- there's still a record of who last touched a pin and when, even though
-- the original values aren't preserved. If you need full before/after
-- history, use the "flag as wrong + re-tag" flow instead, which always
-- inserts a new row.
create table if not exists location_tags (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,         -- format: 01012345678
  customer_name text,                   -- optional label
  lat double precision not null,
  lng double precision not null,
  note text,                            -- landmark / building description
  label text,                           -- e.g. 'home' | 'work' | 'other'
  added_by uuid not null references drivers(id),
  edited_by uuid references drivers(id), -- who last edited this row, if ever
  edited_at timestamptz,                 -- when it was last edited, if ever
  superseded boolean not null default false, -- true if a driver flagged this as wrong
  flagged_by uuid references drivers(id),   -- who flagged it wrong, if ever
  flagged_at timestamptz,                    -- when it was flagged, if ever
  photo_url text,                       -- public URL in the pin-photos bucket, if any
  created_at timestamptz not null default now()
);

-- If you're running this against an EXISTING database, apply this
-- migration instead of re-running the create table above:
--   alter table location_tags add column if not exists edited_by uuid references drivers(id);
--   alter table location_tags add column if not exists edited_at timestamptz;
--   alter table location_tags add column if not exists flagged_by uuid references drivers(id);
--   alter table location_tags add column if not exists flagged_at timestamptz;
--   alter table location_tags add column if not exists photo_url text;

create index if not exists idx_location_tags_phone on location_tags (customer_phone, created_at desc);
create index if not exists idx_location_tags_added_by on location_tags (added_by);

-- Convenience view: latest non-superseded tag per phone number
create or replace view latest_location_tags as
select distinct on (customer_phone)
  *
from location_tags
where not superseded
order by customer_phone, created_at desc;

-- Live driver locations — one row per driver, overwritten on every ping
-- (not a history log). The admin "live tracking" view polls this table.
create table if not exists driver_locations (
  driver_id uuid primary key references drivers(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

-- If you're running this against an EXISTING database, apply this
-- migration instead of re-running the create table above:
--   create table if not exists driver_locations (
--     driver_id uuid primary key references drivers(id) on delete cascade,
--     lat double precision not null,
--     lng double precision not null,
--     updated_at timestamptz not null default now()
--   );

-- Driver location HISTORY — unlike driver_locations above, this is an
-- append-only log, one row per ping. Powers the "trail" feature on the
-- dashboard search view: a driver's own breadcrumb path since their last
-- idle/offline gap (see lib/trail.ts for the trip-segmentation logic).
-- Pruned to the last 12h per driver on every ping (see
-- /api/location/ping) — this is meant to cover a single day's trips, not
-- serve as a permanent audit log, so it stays small without a separate
-- cleanup job.
create table if not exists driver_location_history (
  id bigint generated always as identity primary key,
  driver_id uuid not null references drivers(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);

create index if not exists driver_location_history_driver_time_idx
  on driver_location_history (driver_id, recorded_at desc);

-- Photo-on-tag storage ----------------------------------------------------
-- Uploads go through /api/tags/photo using the service role key (see
-- lib/supabase/server.ts), which bypasses storage RLS entirely — so no
-- storage policy is needed to allow uploads. The bucket is marked public
-- purely so the *read* side works: photos are shown with plain <img>
-- tags in the dashboard, which needs a directly-loadable URL with no
-- auth header attached. This mirrors the rest of the app's model (access
-- control lives in our own session-gated API routes, not RLS) rather
-- than adding a new one. Practically, a photo is only reachable if you
-- already know its full random path (driverId/uuid.ext) — there's no
-- listing/enumeration exposed — so this is a low-risk trade-off for an
-- internal tool, same as the one already accepted for shift-word auth.
insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', true)
on conflict (id) do nothing;

-- Realtime for driver_locations ------------------------------------------
-- The admin live-tracking map subscribes to this table directly from the
-- browser via Supabase Realtime (see src/lib/realtimeAuth.ts) instead of
-- polling. The browser only ever holds the public anon key, which on its
-- own grants no access to this table — RLS below requires a short-lived
-- token minted server-side (by /api/admin/realtime-token, gated on the
-- existing admin session cookie) with an `is_admin: true` claim, signed
-- with the project's Realtime/legacy JWT secret. Without that token,
-- Realtime and PostgREST both see this table as inaccessible.

alter table driver_locations enable row level security;

drop policy if exists "admins can read driver_locations via realtime" on driver_locations;
create policy "admins can read driver_locations via realtime"
  on driver_locations for select
  using (coalesce((auth.jwt() ->> 'is_admin')::boolean, false));

-- Adds the table to Supabase's realtime publication so change events are
-- broadcast at all. Safe to re-run.
alter publication supabase_realtime add table driver_locations;
