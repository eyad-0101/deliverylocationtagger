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

-- Active deliveries tracking
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  customer_name text,
  customer_lat double precision,
  customer_lng double precision,
  customer_address text,
  driver_id uuid references drivers(id),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  note text,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deliveries_status on deliveries (status);
create index if not exists idx_deliveries_driver on deliveries (driver_id);
create index if not exists idx_deliveries_created on deliveries (created_at desc);

-- Driver real-time location tracking
create table if not exists driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  battery_level integer,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_locations_driver on driver_locations (driver_id);
create index if not exists idx_driver_locations_last_seen on driver_locations (last_seen_at desc);

-- Keep only the latest location per driver (auto-cleanup old records)
create or replace function keep_latest_driver_location()
returns trigger as $$
begin
  delete from driver_locations
  where driver_id = new.driver_id
  and id != new.id;
  return new;
end;
$$ language plpgsql;

create trigger trg_keep_latest_driver_location
after insert on driver_locations
for each row
execute function keep_latest_driver_location();

-- Auto-update deliveries.updated_at
create or replace function update_delivery_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_update_delivery_timestamp
before update on deliveries
for each row
execute function update_delivery_timestamp();

