-- Gym Deathmatch minimal schema (run in Supabase SQL editor)

create table if not exists lobby (
  id text primary key,
  name text not null,
  season_number int not null,
  season_start timestamptz null,
  season_end timestamptz not null,
  cash_pool int not null default 0,
  weekly_target int not null default 3,
  initial_lives int not null default 3,
  owner_id text references player(id),
  owner_user_id text,
  status text not null default 'pending' check (status in ('pending','scheduled','active','completed')),
  scheduled_start timestamptz null
);

create table if not exists player (
  id text primary key,
  lobby_id text not null references lobby(id) on delete cascade,
  name text not null,
  avatar_url text,
  location text,
  quip text,
  user_id text
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

-- User profile (per auth user)
create table if not exists user_profile (
  user_id text primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table user_profile enable row level security;
-- Example policies (auth.uid() available in Supabase SQL runtime)
-- create policy "profile read own" on user_profile for select using (auth.uid() = user_id);
-- create policy "profile upsert own" on user_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- User-scoped Strava tokens
create table if not exists user_strava_token (
  user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);
alter table user_strava_token enable row level security;
-- Access is via service role only in our API routes (no public policies)

-- Example policy for later (optional): allow read to anon for lobby and player if you want public read.
-- create policy "public read lobby" on lobby for select using (true);
-- create policy "public read player" on player for select using (true);


