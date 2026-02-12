# DB Security and Invariants

## Security model
1. Supabase RLS is enabled on all core tables.
2. Public/client reads are constrained to lobby members and lobby owners.
3. Writes for critical workflows (commentary queue, spins, reconcile, stage transitions) are done by server routes with the service-role key.
4. Service-role bypasses RLS, so route/domain authorization is the primary write gate.

## Critical invariants enforced in `supabase/schema.sql`
1. Owner safety
   - `player_lobby_user_unique_idx` prevents duplicate membership rows per user/lobby.
   - `trg_lobby_owner_integrity` enforces `lobby.owner_id` references a player in the same lobby.
   - `trg_prevent_owner_player_delete` blocks deleting the current owner player row.
2. Roulette/spin consistency
   - `lobby_punishments_week_positive` / `lobby_spin_events_week_positive` enforce valid week indexes.
   - `lobby_punishments_single_active_week_idx` allows at most one active punishment per lobby/week.
   - `trg_lobby_punishment_integrity` enforces `created_by`/`chosen_by` player membership consistency.
   - `trg_lobby_spin_event_integrity` enforces:
     - spin rows only during `lobby.status = transition_spin`,
     - spin winner item belongs to same lobby and same week,
     - spin creator belongs to the same lobby.
   - `trg_week_ready_state_integrity` enforces ready rows reference players from the same lobby.
3. Commentary queue state machine
   - `commentary_events_attempts_nonnegative` ensures retry count stays valid.
   - `trg_commentary_event_state_machine` enforces legal transitions:
     - `queued -> processing|failed|done|dead`
     - `processing -> failed|done|dead`
     - `failed -> queued|processing|dead`
     - `done` and `dead` are terminal
   - Ensures `processed_at` is set for terminal statuses and `next_attempt_at` is always populated for retryable statuses.

## Operational checks
1. Local schema contract smoke:
   - `npm run test:migration-smoke`
2. Optional live smoke against a configured Supabase project:
   - set `MIGRATION_SMOKE_SUPABASE_URL`
   - set `MIGRATION_SMOKE_SERVICE_ROLE_KEY`
   - run `npm run test:migration-smoke`
3. Optional CI shadow migration apply:
   - set repository secret `MIGRATION_SMOKE_DATABASE_URL`
   - workflow job `migration-smoke-shadow` applies `supabase/schema.sql` using `psql`.
