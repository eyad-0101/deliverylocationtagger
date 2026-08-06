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
  created_at timestamptz not null default now()
);

-- If you're running this against an EXISTING database that already has
-- "phone text unique not null", apply this migration instead of re-running
-- the create table above:
--   alter table drivers alter column phone drop not null;

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
  created_at timestamptz not null default now()
);

-- If you're running this against an EXISTING database, apply this
-- migration instead of re-running the create table above:
--   alter table location_tags add column if not exists edited_by uuid references drivers(id);
--   alter table location_tags add column if not exists edited_at timestamptz;

create index if not exists idx_location_tags_phone on location_tags (customer_phone, created_at desc);
create index if not exists idx_location_tags_added_by on location_tags (added_by);

-- Convenience view: latest non-superseded tag per phone number
create or replace view latest_location_tags as
select distinct on (customer_phone)
  *
from location_tags
where not superseded
order by customer_phone, created_at desc;
