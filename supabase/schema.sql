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

-- Pot configuration fields (idempotent add)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='initial_pot') then
    alter table lobby add column initial_pot int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='weekly_ante') then
    alter table lobby add column weekly_ante int not null default 10;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='scaling_enabled') then
    alter table lobby add column scaling_enabled boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='per_player_boost') then
    alter table lobby add column per_player_boost int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='season_number') then
    alter table lobby add column season_number int not null default 1;
  end if;
end $$;

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

-- Upgrades for manual_activities to support photo/caption/voting lifecycle
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='manual_activities' and column_name='photo_url') then
    alter table manual_activities add column photo_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manual_activities' and column_name='caption') then
    alter table manual_activities add column caption text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manual_activities' and column_name='status') then
    alter table manual_activities add column status text not null default 'pending';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manual_activities' and column_name='vote_deadline') then
    alter table manual_activities add column vote_deadline timestamptz null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='manual_activities' and column_name='decided_at') then
    alter table manual_activities add column decided_at timestamptz null;
  end if;
end $$;

-- Votes on manual activities
create table if not exists activity_votes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references manual_activities(id) on delete cascade,
  voter_player_id text not null references player(id) on delete cascade,
  choice text not null check (choice in ('legit','sus')),
  created_at timestamptz not null default now(),
  unique(activity_id, voter_player_id)
);
alter table activity_votes enable row level security;
drop policy if exists activity_votes_member on activity_votes;
create policy activity_votes_member on activity_votes
for all using (
  exists (
    select 1 from manual_activities a
    where a.id = activity_votes.activity_id
      and exists (select 1 from player p where p.id = activity_votes.voter_player_id and p.lobby_id = a.lobby_id)
  )
) with check (
  exists (
    select 1 from manual_activities a
    where a.id = activity_votes.activity_id
      and exists (select 1 from player p where p.id = activity_votes.voter_player_id and p.lobby_id = a.lobby_id)
  )
);

-- History events for transparency
create table if not exists history_events (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  actor_player_id text null references player(id) on delete set null,
  target_player_id text null references player(id) on delete set null,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table history_events enable row level security;
drop policy if exists history_events_lobby_read on history_events;
create policy history_events_lobby_read on history_events
for select using (
  exists (select 1 from player p where p.lobby_id = history_events.lobby_id and p.user_id = auth.uid())
);

-- Heart adjustments (owner overrides)
create table if not exists heart_adjustments (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  target_player_id text not null references player(id) on delete cascade,
  delta int not null,
  created_at timestamptz not null default now()
);
alter table heart_adjustments enable row level security;
drop policy if exists heart_adj_lobby_read on heart_adjustments;
create policy heart_adj_lobby_read on heart_adjustments
for select using (
  exists (select 1 from player p where p.lobby_id = heart_adjustments.lobby_id and p.user_id = auth.uid())
);

-- Weekly pot contributions (for precise accounting)
create table if not exists weekly_pot_contributions (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  week_start timestamptz not null,
  amount int not null,
  player_count int not null,
  created_at timestamptz not null default now(),
  unique(lobby_id, week_start)
);
alter table weekly_pot_contributions enable row level security;
drop policy if exists weekly_pot_select_member on weekly_pot_contributions;
create policy weekly_pot_select_member on weekly_pot_contributions
for select using (
  exists (select 1 from player p where p.lobby_id = weekly_pot_contributions.lobby_id and p.user_id = auth.uid())
);

-- Commentary / quips
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  type text not null check (type in ('ACTIVITY','VOTE','HEARTS','POT','KO','SUMMARY')),
  primary_player_id text null references player(id) on delete set null,
  secondary_player_id text null references player(id) on delete set null,
  activity_id uuid null references manual_activities(id) on delete set null,
  payload jsonb not null,
  rendered text not null,
  visibility text not null default 'both' check (visibility in ('feed','history','both')),
  created_at timestamptz not null default now()
);
alter table comments enable row level security;
drop policy if exists comments_read_member on comments;
create policy comments_read_member on comments
for select using (
  exists (select 1 from player p where p.lobby_id = comments.lobby_id and p.user_id = auth.uid())
);
-- service-role writes only via API; no public insert policy
create index if not exists comments_lobby_created_idx on comments (lobby_id, created_at desc);
-- Dedupe helper: prevent duplicates per activity/rendered
create unique index if not exists comments_activity_dedupe_idx on comments (lobby_id, type, activity_id, rendered) where activity_id is not null;

