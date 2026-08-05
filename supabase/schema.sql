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

-- Location tags — one row per tag event (never updated, only inserted).
-- This gives a full version history per customer phone number for free:
-- "current" location = most recent row for that phone.
create table if not exists location_tags (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,         -- format: 01012345678
  customer_name text,                   -- optional label
  lat double precision not null,
  lng double precision not null,
  note text,                            -- landmark / building description
  label text,                           -- e.g. 'home' | 'work' | 'other'
  added_by uuid not null references drivers(id),
  superseded boolean not null default false, -- true if a driver flagged this as wrong
  created_at timestamptz not null default now()
);

create index if not exists idx_location_tags_phone on location_tags (customer_phone, created_at desc);
create index if not exists idx_location_tags_added_by on location_tags (added_by);

-- Convenience view: latest non-superseded tag per phone number
create or replace view latest_location_tags as
select distinct on (customer_phone)
  *
from location_tags
where not superseded
order by customer_phone, created_at desc;
