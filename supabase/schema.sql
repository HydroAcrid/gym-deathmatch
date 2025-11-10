-- Gym Deathmatch minimal schema (run in Supabase SQL editor)

create table if not exists lobby (
  id text primary key,
  name text not null,
  season_number int not null,
  season_start timestamptz not null,
  season_end timestamptz not null,
  cash_pool int not null default 0,
  weekly_target int not null default 3,
  initial_lives int not null default 3
);

create table if not exists player (
  id text primary key,
  lobby_id text not null references lobby(id) on delete cascade,
  name text not null,
  avatar_url text,
  location text,
  quip text
);

create table if not exists strava_token (
  player_id text primary key references player(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

-- Enable RLS; the service role (server key) bypasses RLS automatically.
alter table lobby enable row level security;
alter table player enable row level security;
alter table strava_token enable row level security;

-- Example policy for later (optional): allow read to anon for lobby and player if you want public read.
-- create policy "public read lobby" on lobby for select using (true);
-- create policy "public read player" on player for select using (true);


