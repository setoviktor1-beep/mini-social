-- Išplečiame profilius
alter table profiles add column if not exists is_pro boolean default false;
alter table profiles add column if not exists pro_category text;
alter table profiles add column if not exists pro_radius_km int default 2;
alter table profiles add column if not exists location geography(POINT, 4326);

-- Sukuriame užsakymų lentelę
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id),
  pro_id uuid references profiles(id),
  description text not null,
  photo_url text,
  ai_estimate_min int,
  ai_estimate_max int,
  status text default 'pending', -- pending, accepted, rejected, completed
  created_at timestamp with time zone default now()
);

-- Pridedame indeksą greitai kaimynų paieškai
create index if not exists spatial_location_idx on profiles using gist (location);
