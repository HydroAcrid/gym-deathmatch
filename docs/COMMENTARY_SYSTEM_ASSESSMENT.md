# Commentary System — Assessment & Improvement Plan

## Implementation Status (February 9, 2026)

- Implemented: commentary side-effects were removed from `GET /api/lobby/[lobbyId]/live`.
- Implemented: global idempotency ledger `commentary_emitted` added in `supabase/schema.sql`.
- Implemented: cron routes added:
  - `POST /api/cron/commentary/daily`
  - `POST /api/cron/commentary/weekly`
- Implemented: streak milestone/PR commentary moved to manual activity write path.
- Implemented: all-ready commentary moved to ready write path.
- Implemented: weekend/Monday/photo quips now include explicit `dedupeKey`.
- Implemented: `insertQuipOnce` now returns whether a comment was inserted, and push sends are gated on actual insert for deduped events.

Remaining architectural work (optional, next):

- Fully separate push policy from commentary generation.
- Move remaining non-commentary state mutations out of `GET /live` so `/live` can become fully read-only.
- Move templates/copy to config or DB for non-code edits and i18n.

## How It Works Today

- **Storage**: All commentary lives in the `comments` table (type, rendered, payload, visibility, primary_player_id).
- **Triggers**: Scattered across the codebase:
  - **GET `/api/lobby/[lobbyId]/live`** — side-effects: `onHeartsChanged`, `onPerfectWeek`, `onGhostWeek`, `onStreakMilestone`, `onStreakPR`, `onDailyReminder`, `onWeeklyHype`, `onTightRace, onWeeklyReset`, `onKO`.
  - **POST** routes: manual activity → `onActivityLogged` (+ flavor quips); vote resolve → `generateQuips`; pot → `onPotChanged`; spin → `onSpin`; ready/stage → `onReadyChanged`; punishment resolve → `onPunishmentResolved`.
- **Dedup**: Per-handler (time windows, payload checks, or `insertQuipOnce` with `dedupeKey`). No global event id.
- **Templates**: Inline in `lib/commentary.ts`; deterministic pick via hash where we fixed duplication.

---

## Would I Have Built It This Way?

**Short answer: No.** The current design works and is fixable (we fixed the worst bugs), but I would make different core choices.

### 1. **Commentary as side-effect of GET /live**

**Problem**: A **read** endpoint (GET /live) mutates data (inserts comments). That violates HTTP semantics, makes caching and retries dangerous, and caused the feedback loop (realtime on `comments` → refresh → more commentary).

**Better**: Emit commentary only from **write** paths:

- **Hearts**: When something actually changes hearts (week rollover job, or a dedicated "process week" endpoint that runs once per week per lobby), call `onHeartsChanged` / `onPerfectWeek` there — not on every /live poll.
- **Streaks / PRs**: When an activity is logged or Strava sync runs, compute streak and call `onStreakMilestone` / `onStreakPR` in that context.
- **Daily reminder**: A scheduled job (cron / Vercel cron / Supabase Edge Function) that runs once per day, computes "who has 0 activities today," and calls `onDailyReminder` once per player.

So: **no commentary from GET /live**. Use a small number of well-defined write/scheduled paths.

### 2. **Single event bus instead of many `on*` handlers**

**Problem**: Many `onHeartsChanged`, `onPotChanged`, `onActivityLogged`, etc., each with its own dedup and DB calls. Hard to reason about ordering, rate, and "did we already say this?"

**Better**: One **commentary pipeline**:

- **Input**: A single stream of typed events, e.g.  
  `{ type: 'HEARTS_CHANGED', lobbyId, playerId, delta, reason, weekStart }`  
  `{ type: 'ACTIVITY_LOGGED', lobbyId, activityId, playerId, ... }`  
  `{ type: 'POT_CHANGED', lobbyId, delta, pot }`  
  etc.
- **Pipeline**: Normalize → **idempotency** (e.g. `(lobbyId, type, idempotencyKey)` in DB or in a small `commentary_emitted` table) → **template selector** (deterministic) → **render** (name substitution) → **insert one row**.
- **Idempotency key**: e.g. for HEARTS: `playerId:weekStart:delta`. One row per logical event; duplicate events are no-ops.

That gives one place for "have we already emitted this?" and one place for template logic.

### 3. **Templates and copy**

**Current**: Templates live in code; no i18n, no experiments, no non-dev edits.

**Improvements**:

- **Config-driven copy**: Store templates in DB (e.g. `commentary_templates`: type, key, copy, locale) or in JSON/CSV that the pipeline reads. Enables copy tweaks and later i18n without code deploys.
- **Stable keys**: e.g. `HEARTS_LOST`, `HEARTS_GAINED`, `POT_MILESTONE_50`. Template selector picks by (type, key, optional variant). Deterministic variant (e.g. hash) stays in the pipeline.
- **Optional A/B**: Variant field or experiment id in template row; pipeline chooses variant by experiment config. Keeps code generic.

### 4. **Push notifications**

**Current**: Push is mixed into commentary (e.g. `onHeartsChanged` inserts a quip and then calls `sendPushToLobby`). Coupling is high.

**Better**: Treat push as a separate concern:

- Commentary pipeline only writes to `comments`.
- A separate **notification policy** layer (or small service) subscribes to the same events (or reads "new comment" and metadata) and decides: "for this event type, send push to lobby / to user / to nobody." That way you can change push rules (e.g. only for HEARTS and KO) without touching commentary.

### 5. **Dedup and consistency**

**Current**: Each handler does its own "exists?" check then insert. Race conditions are possible (two requests, both pass the check, both insert).

**Better**:

- **Unique constraint**: e.g. `(lobby_id, type, idempotency_key)` unique in DB (or in a separate `commentary_emitted` table). Then use `INSERT ... ON CONFLICT DO NOTHING` (or equivalent). No race.
- **Single writer**: If commentary is only emitted from a cron + activity/pot/spin endpoints (and not from GET /live), you reduce concurrent writers and make races less likely even before adding the constraint.

---

## Concrete Improvements (Without a Full Rewrite)

If you keep the current structure and only improve it:

1. **Remove all commentary from GET /live**  
   Move heart-change and streak commentary to:
   - A **week rollover** job (runs when a week actually ends): compute hearts for that week, then call `onHeartsChanged` / `onPerfectWeek` once per player for that week.
   - **Activity path**: When manual activity is submitted or Strava sync runs, after computing new streak, call `onStreakMilestone` / `onStreakPR` there.
   - **Daily reminder**: Cron that runs once per day, computes "no activity today," calls `onDailyReminder` once per player.

2. **Add a simple idempotency table**  
   e.g. `commentary_emitted (lobby_id, event_type, idempotency_key, created_at)`. Before inserting a quip, insert into this table with `ON CONFLICT (lobby_id, event_type, idempotency_key) DO NOTHING`; if the insert didn’t change a row, skip writing to `comments`. Gives you one place to prevent duplicates and a clear audit of "what we’ve already said."

3. **Add dedupeKey to remaining insertQuipOnce calls**  
   Weekend opener, Monday motivation, and "Photo of the day" still don’t use `dedupeKey`; add payload-based keys (e.g. `{ weekend: true, day: dayKey }`) so dedup is consistent.

4. **Extract push from commentary**  
   In each handler, only insert the quip. In one place (e.g. a small `notify.ts` or post-insert hook), "on new comment of type X, send push." That keeps commentary pure and push rules easy to change.

5. **Optional: rate / budget**  
   If you ever see "too many quips in one minute," add a simple rate limit: e.g. "max N comments per lobby per minute" or "max 1 HEARTS quip per player per 5 minutes" in the pipeline before insert.

---

## Expansion Ideas

- **Season / game-mode aware copy**: Different templates for MONEY_SURVIVAL vs CHALLENGE_ROULETTE (e.g. "heart lost" vs "punishment earned").
- **Personalization**: Optional "tone" or "spice" level per lobby or user; template selector picks a variant based on that.
- **Recaps**: Weekly or season-end summary quip (e.g. "Week 3 in the books. 4 athletes hit target. Pot at $120.") generated by a scheduled job.
- **Reactions**: Store reactions (e.g. "fire", "sad") on comment rows and show them in the feed.
- **Mentions**: Parse @mentions in manual activity notes and create "X called out Y" style quips or notifications.

---

## Summary

| Aspect              | Current                         | Preferable / Improvement                          |
|---------------------|---------------------------------|---------------------------------------------------|
| Where commentary runs | GET /live + many POST routes   | Only write paths + scheduled jobs                 |
| Dedup                | Per-handler, ad-hoc            | Idempotency key + unique constraint or table      |
| Templates            | In code, random then deterministic | Config-driven, deterministic variant selection |
| Push                 | Inside each handler             | Separate layer that reacts to new comments/events |
| New features         | Add new `on*` + dedup logic    | Add event type + template; pipeline unchanged     |

The current system is **workable** after the duplication fixes. The highest-impact next step is **removing commentary from GET /live** and driving it only from write paths and scheduled jobs; that keeps semantics clear and prevents feedback loops. After that, introducing a single idempotency mechanism and optionally moving templates to config will make the system easier to extend and reason about.
