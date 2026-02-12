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

-- Idempotent player state columns used by app logic
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='player' and column_name='hearts') then
    alter table player add column hearts int not null default 3;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='player' and column_name='lives_remaining') then
    alter table player add column lives_remaining int not null default 3;
  end if;
end $$;

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
-- Allow lobby members (and owner) to read player rows; service role still bypasses RLS
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player' and policyname = 'player_select_member') then
    create policy player_select_member on player
    for select using (
      exists (
        select 1 from player p2
        where p2.lobby_id = player.lobby_id
          and p2.user_id::text = auth.uid()::text
      )
      or exists (
        select 1 from lobby l where l.id = player.lobby_id and l.owner_user_id::text = auth.uid()::text
      )
    );
  end if;
end $$;

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
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='invite_enabled') then
    alter table lobby add column invite_enabled boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='invite_expires_at') then
    alter table lobby add column invite_expires_at timestamptz null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='invite_token_required') then
    alter table lobby add column invite_token_required boolean not null default true;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='lobby' and column_name='invite_token') then
    alter table lobby add column invite_token text null;
  end if;
  -- Ensure invite token behavior is usable for existing rows too.
  update lobby set invite_token = replace(gen_random_uuid()::text, '-', '') where invite_token is null;
  alter table lobby alter column invite_token set default replace(gen_random_uuid()::text, '-', '');
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
-- Prevent duplicate tight-race summaries (rendered string encodes pot)
create unique index if not exists comments_tight_race_once_idx on comments (lobby_id, type, rendered) where type = 'SUMMARY' and payload ? 'tightRace';

-- Commentary idempotency ledger
create table if not exists commentary_emitted (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  event_type text not null,
  idempotency_key text not null,
  source_type text null,
  source_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(lobby_id, event_type, idempotency_key)
);
alter table commentary_emitted enable row level security;
drop policy if exists commentary_emitted_read_member on commentary_emitted;
create policy commentary_emitted_read_member on commentary_emitted
for select using (
  exists (select 1 from player p where p.lobby_id = commentary_emitted.lobby_id and p.user_id::text = auth.uid()::text)
);
create index if not exists commentary_emitted_lobby_created_idx on commentary_emitted (lobby_id, created_at desc);

-- Event-first commentary pipeline
create table if not exists commentary_events (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  event_type text not null,
  event_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','done','failed','dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  unique(lobby_id, event_type, event_key)
);
create index if not exists commentary_events_status_next_idx on commentary_events (status, next_attempt_at);
create index if not exists commentary_events_lobby_created_idx on commentary_events (lobby_id, created_at desc);
alter table commentary_events enable row level security;
drop policy if exists commentary_events_read_member on commentary_events;
create policy commentary_events_read_member on commentary_events
for select using (
  exists (select 1 from player p where p.lobby_id = commentary_events.lobby_id and p.user_id::text = auth.uid()::text)
  or exists (select 1 from lobby l where l.id = commentary_events.lobby_id and l.owner_user_id::text = auth.uid()::text)
);

create table if not exists commentary_rule_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references commentary_events(id) on delete cascade,
  rule_id text not null,
  channel text not null check (channel in ('feed','history','push')),
  decision text not null check (decision in ('emitted','skipped_budget','skipped_dedupe','skipped_condition','error')),
  score int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists commentary_rule_runs_event_idx on commentary_rule_runs (event_id);
create index if not exists commentary_rule_runs_rule_created_idx on commentary_rule_runs (rule_id, created_at desc);
alter table commentary_rule_runs enable row level security;
drop policy if exists commentary_rule_runs_read_member on commentary_rule_runs;
create policy commentary_rule_runs_read_member on commentary_rule_runs
for select using (
  exists (
    select 1
    from commentary_events e
    join player p on p.lobby_id = e.lobby_id
    where e.id = commentary_rule_runs.event_id
      and p.user_id::text = auth.uid()::text
  )
  or exists (
    select 1
    from commentary_events e
    join lobby l on l.id = e.lobby_id
    where e.id = commentary_rule_runs.event_id
      and l.owner_user_id::text = auth.uid()::text
  )
);

-- Web push subscriptions (per user)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique(endpoint)
);
alter table push_subscriptions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_sub_select_own') then
    create policy push_sub_select_own on push_subscriptions
    for select using (user_id::text = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_sub_insert_own') then
    create policy push_sub_insert_own on push_subscriptions
    for insert with check (user_id::text = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_sub_delete_own') then
    create policy push_sub_delete_own on push_subscriptions
    for delete using (user_id::text = auth.uid()::text);
  end if;
end $$;

-- User-generated comments on manual activities
create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  activity_id uuid not null references manual_activities(id) on delete cascade,
  author_player_id text not null references player(id) on delete cascade,
  parent_id uuid null references post_comments(id) on delete cascade,
  thread_root_id uuid null references post_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check (char_length(body) between 1 and 500)
);
alter table post_comments enable row level security;
create index if not exists post_comments_activity_created_idx on post_comments (activity_id, created_at);
create index if not exists post_comments_parent_idx on post_comments (parent_id);
create index if not exists post_comments_lobby_created_idx on post_comments (lobby_id, created_at);
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'post_comments' and policyname = 'post_comments_select_lobby_member'
  ) then
    create policy post_comments_select_lobby_member on post_comments
    for select using (
      exists (
        select 1 from player p
        where p.lobby_id = post_comments.lobby_id
          and p.user_id::text = auth.uid()::text
      )
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'post_comments' and policyname = 'post_comments_insert_self'
  ) then
    create policy post_comments_insert_self on post_comments
    for insert with check (
      exists (
        select 1 from player p
        where p.id = post_comments.author_player_id
          and p.lobby_id = post_comments.lobby_id
          and p.user_id::text = auth.uid()::text
      )
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'post_comments' and policyname = 'post_comments_delete_self_or_owner'
  ) then
    create policy post_comments_delete_self_or_owner on post_comments
    for delete using (
      exists (
        select 1
        from player p
        where p.id = post_comments.author_player_id
          and p.user_id::text = auth.uid()::text
      )
      or exists (
        select 1
        from lobby l
        where l.id = post_comments.lobby_id
          and l.owner_user_id::text = auth.uid()::text
      )
    );
  end if;
end $$;

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

create table if not exists lobby_spin_events (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  week int not null,
  winner_item_id uuid not null references lobby_punishments(id) on delete cascade,
  started_at timestamptz not null,
  created_by text null references player(id) on delete set null,
  created_at timestamptz default now(),
  unique(lobby_id, week)
);
alter table lobby_spin_events enable row level security;
drop policy if exists lobby_spin_events_member_read on lobby_spin_events;
create policy lobby_spin_events_member_read on lobby_spin_events
for select using (
  exists (select 1 from player p where p.lobby_id = lobby_spin_events.lobby_id and p.user_id = auth.uid())
);
create index if not exists lobby_spin_events_lobby_week_idx on lobby_spin_events (lobby_id, week desc, created_at desc);

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

-- Persisted live snapshots (read-optimized, refreshed from write paths/jobs)
create table if not exists lobby_live_snapshots (
  lobby_id text not null references lobby(id) on delete cascade,
  timezone_offset_minutes int not null default 0 check (timezone_offset_minutes between -840 and 840),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (lobby_id, timezone_offset_minutes)
);
create index if not exists lobby_live_snapshots_updated_idx on lobby_live_snapshots (updated_at desc);
alter table lobby_live_snapshots enable row level security;
drop policy if exists lobby_live_snapshots_member_read on lobby_live_snapshots;
create policy lobby_live_snapshots_member_read on lobby_live_snapshots
for select using (
  exists (select 1 from player p where p.lobby_id = lobby_live_snapshots.lobby_id and p.user_id::text = auth.uid()::text)
  or exists (select 1 from lobby l where l.id = lobby_live_snapshots.lobby_id and l.owner_user_id::text = auth.uid()::text)
);

-- Archived per-lobby season snapshots (historical seasons for one lobby id)
create table if not exists lobby_seasons (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null references lobby(id) on delete cascade,
  lobby_name text not null,
  season_number int not null,
  mode text null,
  stage text null,
  status text null,
  season_start timestamptz null,
  season_end timestamptz null,
  final_pot int not null default 0,
  summary jsonb null,
  players jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  unique(lobby_id, season_number)
);
create index if not exists lobby_seasons_lobby_idx on lobby_seasons (lobby_id, season_number desc);
create index if not exists lobby_seasons_archived_idx on lobby_seasons (archived_at desc);
alter table lobby_seasons enable row level security;
drop policy if exists lobby_seasons_member_read on lobby_seasons;
create policy lobby_seasons_member_read on lobby_seasons
for select using (
  exists (select 1 from player p where p.lobby_id = lobby_seasons.lobby_id and p.user_id::text = auth.uid()::text)
  or exists (select 1 from lobby l where l.id = lobby_seasons.lobby_id and l.owner_user_id::text = auth.uid()::text)
  or exists (
    select 1
    from jsonb_array_elements(coalesce(lobby_seasons.players, '[]'::jsonb)) as pp
    where pp->>'userId' = auth.uid()::text
  )
);

-- DB invariant: one linked player row per (lobby,user)
create unique index if not exists player_lobby_user_unique_idx
  on player (lobby_id, user_id)
  where user_id is not null;

-- DB invariant: lobby.owner_id must reference a player in the same lobby,
-- and owner_user_id must match owner player's user_id when both are present.
create or replace function enforce_lobby_owner_integrity()
returns trigger as $$
declare
  owner_row record;
begin
  if new.owner_id is not null then
    select id, lobby_id, user_id
      into owner_row
    from player
    where id = new.owner_id;

    if owner_row.id is null then
      raise exception 'owner_id % not found in player', new.owner_id;
    end if;
    if owner_row.lobby_id is distinct from new.id then
      raise exception 'owner_id % does not belong to lobby %', new.owner_id, new.id;
    end if;

    if new.owner_user_id is null then
      new.owner_user_id := owner_row.user_id;
    elsif owner_row.user_id is not null and new.owner_user_id is distinct from owner_row.user_id then
      raise exception 'owner_user_id % does not match owner player user_id %', new.owner_user_id, owner_row.user_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lobby_owner_integrity on lobby;
create trigger trg_lobby_owner_integrity
before insert or update on lobby
for each row execute function enforce_lobby_owner_integrity();

-- DB invariant: prevent deleting the current lobby owner player row.
create or replace function prevent_owner_player_delete()
returns trigger as $$
begin
  if exists (
    select 1
    from lobby l
    where l.id = old.lobby_id
      and (
        l.owner_id = old.id
        or (l.owner_user_id is not null and old.user_id is not null and l.owner_user_id = old.user_id)
      )
  ) then
    raise exception 'cannot delete current lobby owner player row';
  end if;

  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_owner_player_delete on player;
create trigger trg_prevent_owner_player_delete
before delete on player
for each row execute function prevent_owner_player_delete();
