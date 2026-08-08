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
  created_at timestamptz not null default now()
);

-- If you're running this against an EXISTING database, apply this
-- migration instead of re-running the create table above:
--   alter table location_tags add column if not exists edited_by uuid references drivers(id);
--   alter table location_tags add column if not exists edited_at timestamptz;
--   alter table location_tags add column if not exists flagged_by uuid references drivers(id);
--   alter table location_tags add column if not exists flagged_at timestamptz;

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
