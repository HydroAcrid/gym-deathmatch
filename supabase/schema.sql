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
  location text,
  quip text,
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


-- Manual activities: allow logging workouts without Strava
create table if not exists manual_activities (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  player_id text not null references player(id) on delete cascade,
  date timestamptz not null default now(),
  duration_minutes integer null,
  distance_km double precision null,
  type text not null default 'other',
  notes text null,
  created_at timestamptz not null default now()
);
alter table manual_activities enable row level security;

-- Members (or lobby owner) can read activities for their lobby
drop policy if exists manual_act_select_member on manual_activities;
create policy manual_act_select_member on manual_activities
for select using (
  exists (
    select 1 from player p
    where p.id = manual_activities.player_id
      and (p.user_id = auth.uid()
        or exists (select 1 from lobby l where l.id = manual_activities.lobby_id and l.owner_user_id = auth.uid())
      )
  )
);

-- Only the signed-in user can insert rows for their own player in that lobby
drop policy if exists manual_act_insert_self on manual_activities;
create policy manual_act_insert_self on manual_activities
for insert with check (
  exists (
    select 1 from player p
    where p.id = manual_activities.player_id
      and p.user_id = auth.uid()
      and p.lobby_id = manual_activities.lobby_id
  )
);

drop policy if exists manual_act_update_self on manual_activities;
create policy manual_act_update_self on manual_activities
for update using (
  exists (select 1 from player p where p.id = manual_activities.player_id and p.user_id = auth.uid())
);

drop policy if exists manual_act_delete_self_or_owner on manual_activities;
create policy manual_act_delete_self_or_owner on manual_activities
for delete using (
  exists (
    select 1 from player p
    where p.id = manual_activities.player_id
      and (p.user_id = auth.uid()
        or exists (select 1 from lobby l where l.id = manual_activities.lobby_id and l.owner_user_id = auth.uid())
      )
  )
);

-- refresh PostgREST cache
select pg_notify('pgrst', 'reload schema');

