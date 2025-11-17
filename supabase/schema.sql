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
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='mode') then
    alter table lobby add column mode text not null default 'MONEY_SURVIVAL' check (mode in ('MONEY_SURVIVAL','MONEY_LAST_MAN','CHALLENGE_ROULETTE','CHALLENGE_CUMULATIVE'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='sudden_death_enabled') then
    alter table lobby add column sudden_death_enabled boolean not null default false;
  end if;
end $$;

-- Allow a new intermediate status for challenge roulette transition
do $$
begin
  -- If the table exists and the constraint exists, replace it with a version that includes 'transition_spin'
  if exists (select 1 from information_schema.table_constraints where table_name='lobby' and constraint_name='lobby_status_check') then
    alter table lobby drop constraint lobby_status_check;
  end if;
  alter table lobby add constraint lobby_status_check check (status in ('pending','scheduled','transition_spin','active','completed'));
exception when duplicate_object then
  -- ignore if another migration already created it
  null;
end $$;

-- JSON challenge settings (for challenge modes)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='challenge_settings') then
    alter table lobby add column challenge_settings jsonb null;
  end if;
end $$;

-- Stage machine: PRE_STAGE, ACTIVE, COMPLETED
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='stage') then
    alter table lobby add column stage text check (stage in ('PRE_STAGE','ACTIVE','COMPLETED'));
    -- Initialize stage based on status
    update lobby set stage = case
      when status in ('pending','scheduled') then 'PRE_STAGE'
      when status in ('active','transition_spin') then 'ACTIVE'
      when status = 'completed' then 'COMPLETED'
      else 'PRE_STAGE'
    end;
    -- Set default for new rows
    alter table lobby alter column stage set default 'PRE_STAGE';
  end if;
end $$;

-- Season summary storage (JSONB for flexibility)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='season_summary') then
    alter table lobby add column season_summary jsonb null;
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
      and (p.user_id::text = auth.uid()::text
        or exists (select 1 from lobby l where l.id = manual_activities.lobby_id and l.owner_user_id::text = auth.uid()::text)
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
      and p.user_id::text = auth.uid()::text
      and p.lobby_id = manual_activities.lobby_id
  )
);

drop policy if exists manual_act_update_self on manual_activities;
create policy manual_act_update_self on manual_activities
for update using (
  exists (select 1 from player p where p.id = manual_activities.player_id and p.user_id::text = auth.uid()::text)
);

drop policy if exists manual_act_delete_self_or_owner on manual_activities;
create policy manual_act_delete_self_or_owner on manual_activities
for delete using (
  exists (
    select 1 from player p
    where p.id = manual_activities.player_id
      and (p.user_id::text = auth.uid()::text
        or exists (select 1 from lobby l where l.id = manual_activities.lobby_id and l.owner_user_id::text = auth.uid()::text)
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
  exists (select 1 from player p where p.lobby_id = history_events.lobby_id and p.user_id::text = auth.uid()::text)
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
  exists (select 1 from player p where p.lobby_id = heart_adjustments.lobby_id and p.user_id::text = auth.uid()::text)
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
  exists (select 1 from player p where p.lobby_id = weekly_pot_contributions.lobby_id and p.user_id::text = auth.uid()::text)
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
  exists (select 1 from player p where p.lobby_id = comments.lobby_id and p.user_id::text = auth.uid()::text)
);
-- service-role writes only via API; no public insert policy
create index if not exists comments_lobby_created_idx on comments (lobby_id, created_at desc);
-- Dedupe helper: prevent duplicates per activity/rendered
create unique index if not exists comments_activity_dedupe_idx on comments (lobby_id, type, activity_id, rendered) where activity_id is not null;

-- Idempotent add: per-player sudden death toggle
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='player' and column_name='sudden_death') then
    alter table player add column sudden_death boolean not null default false;
  end if;
end $$;

-- Challenge mode scaffolding tables (punishments/ready states)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='challenge_allow_suggestions') then
    alter table lobby add column challenge_allow_suggestions boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='challenge_require_lock') then
    alter table lobby add column challenge_require_lock boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='challenge_auto_spin') then
    alter table lobby add column challenge_auto_spin boolean not null default false;
  end if;
end $$;

create table if not exists lobby_punishments (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  week int not null,
  text text not null,
  created_by text null references player(id) on delete set null,
  chosen_by text null references player(id) on delete set null,
  active boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz default now()
);

-- Add week_status column if it doesn't exist (for existing tables)
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'lobby_punishments'
      and column_name = 'week_status'
  ) then
    alter table lobby_punishments
      add column week_status text
      check (week_status in ('PENDING_PUNISHMENT','PENDING_CONFIRMATION','ACTIVE','COMPLETE'));
  end if;
end $$;

-- Add unique constraint to prevent duplicate submissions per player/week
-- First drop if exists to allow re-running
drop index if exists lobby_punishments_unique_player_week;
alter table lobby_punishments drop constraint if exists lobby_punishments_unique_player_week;
-- Create unique constraint (not just index) so upsert works
create unique index lobby_punishments_unique_player_week 
  on lobby_punishments (lobby_id, week, created_by) 
  where created_by is not null;
alter table lobby_punishments enable row level security;
drop policy if exists lobby_punishments_member_read on lobby_punishments;
create policy lobby_punishments_member_read on lobby_punishments
for select using (
  exists (select 1 from player p where p.lobby_id = lobby_punishments.lobby_id and p.user_id = auth.uid())
);

create table if not exists user_punishments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  lobby_id text not null references lobby(id) on delete cascade,
  week int not null,
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz default now()
);
alter table user_punishments enable row level security;
drop policy if exists user_punishments_member_read on user_punishments;
create policy user_punishments_member_read on user_punishments
for select using (
  exists (select 1 from player p where p.lobby_id = user_punishments.lobby_id and p.user_id = auth.uid())
);
drop policy if exists user_punishments_update_self on user_punishments;
create policy user_punishments_update_self on user_punishments
for update using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);
drop policy if exists user_punishments_update_owner on user_punishments;
create policy user_punishments_update_owner on user_punishments
for update using (
  exists (select 1 from lobby l where l.id = user_punishments.lobby_id and l.owner_user_id::text = auth.uid()::text)
);

create table if not exists user_ready_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  lobby_id text not null references lobby(id) on delete cascade,
  ready boolean not null default false,
  updated_at timestamptz default now(),
  unique(user_id, lobby_id)
);
alter table user_ready_states enable row level security;
drop policy if exists user_ready_member on user_ready_states;
create policy user_ready_member on user_ready_states
for select using (
  exists (select 1 from player p where p.lobby_id = user_ready_states.lobby_id and p.user_id::text = auth.uid()::text)
);

-- Week-ready states for challenge modes (per week, not just per lobby)
create table if not exists week_ready_states (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  week int not null,
  player_id text not null references player(id) on delete cascade,
  ready boolean not null default false,
  updated_at timestamptz default now(),
  unique(lobby_id, week, player_id)
);
alter table week_ready_states enable row level security;
drop policy if exists week_ready_member on week_ready_states;
create policy week_ready_member on week_ready_states
for select using (
  exists (select 1 from player p where p.lobby_id = week_ready_states.lobby_id and p.user_id::text = auth.uid()::text)
);

