# Gym Deathmatch — UI Transplant Overview (Migration-Ready)

This document is a comprehensive, migration-ready overview of the **original** Gym Deathmatch codebase. It is structured for another AI (e.g. Lovable) to consume quickly when performing a UI transplant into a redesigned Lovable UI repo. **No code was refactored or changed; this is analysis and report only.**

---

## 1. Framework & Routing Overview

- **Framework:** Next.js **16** (App Router only).
- **Routing model:** File-based routing under `app/`. There is **no** `pages/` directory; this is **App Router only**. No React Router.
- **Entrypoints:**
  - **Root layout:** `app/layout.tsx` — wraps all pages with `AuthProvider`, `ToastProvider`, `Navbar`, `PageMotion`, `MobileNav`, `DebugFooter`, `PWARegister`, `PWAMeta`.
  - **Route tree:** All user-facing routes live under `app/` as `page.tsx` (or `page.tsx` in nested folders). Dynamic segments use `[param]` (e.g. `[lobbyId]`).
- **Special route:** `app/og/lobby/[lobbyId]/route.tsx` — **API route** (GET) that returns an **OG image** (ImageResponse) for social sharing; not a screen.
- **Loading UI:** `app/loading.tsx` (root), `app/lobbies/loading.tsx`, `app/lobby/[lobbyId]/loading.tsx` — Next.js loading boundaries.

---

## 2. Routes & Screens Inventory

| Route | Screen component file | Purpose | Main UI sections | Key child components | Required UI states |
|------|------------------------|---------|------------------|----------------------|--------------------|
| `/` | `app/page.tsx` | Root redirect; no visible screen | — | — | Loading while auth hydrates; then redirect to `/home` or `/lobbies` |
| `/home` | `app/home/page.tsx` | Post-login home: resume last lobby or go to lobbies/rules | Resume-lobby card (last lobby from localStorage), Welcome card with links | Link to lobby, history, lobbies, rules | Normal (with/without last lobby) |
| `/lobbies` | `app/lobbies/page.tsx` | List user's lobbies; create/edit/leave | Header, LobbyFiltersBar, grid of lobby cards | LobbyFiltersBar, OwnerSettingsModal (when editing) | Loading (auth), empty (no lobbies / not signed in), list with filters/sort |
| `/join/[lobbyId]` | `app/join/[lobbyId]/page.tsx` | Join a lobby by ID (public join page) | Header, JoinLobby form | JoinLobby | Normal |
| `/onboard` | `app/onboard/page.tsx` | Onboarding: sign in only | Card with "Continue with Google" | — | Loading (auth), signed-out (sign-in CTA), redirect if already signed in |
| `/onboard/[lobbyId]` | `app/onboard/[lobbyId]/page.tsx` | Invite flow: set profile + join lobby + Strava link | Profile form (name, location, quip, avatar URL/upload), Join button, Strava connect link | — | Loading, signed-out (sign-in), signed-in (profile form, "Already joined" vs "Join this lobby") |
| `/lobby/[lobbyId]` | `app/lobby/[lobbyId]/page.tsx` | **Main arena:** server-fetches lobby then renders LobbySwitcher | LobbySwitcher (chooses PreStage / RouletteTransition / SeasonComplete / LobbyLayout) | LobbySwitcher → PreStageView, RouletteTransitionPanel, SeasonCompleteOverlay, LobbyLayout | Loading (initial), notFound (invalid lobby), Pre-stage / Active / Transition / Completed |
| `/lobby/[lobbyId]/history` | `app/lobby/[lobbyId]/history/page.tsx` | Lobby-scoped history: activities + events + voting + comments | Header, Owner tools (hearts adjust, pot), Chronological feed (posts + events), voting buttons, owner override, ActivityComments, lightbox | Button, StatusPill, StyledSelect, ActivityComments (inline), Lightbox | Loading, signed-out, empty feed, owner vs non-owner |
| `/lobby/[lobbyId]/stats` | `app/lobby/[lobbyId]/stats/page.tsx` | Lobby stats: season totals + per-player stats | Header, summary cards (total workouts, combined streaks, most consistent), per-player cards (time, distance, avg, etc.) | — | Loading, normal |
| `/lobby/[lobbyId]/summary` | `app/lobby/[lobbyId]/summary/page.tsx` | Season summary: final pot, weekly contributions, KO, punishments | Final pot card, weekly contributions list, KO block, user punishments list, "Resolve all" per user | — | Normal (data from Supabase + API) |
| `/rules` | `app/rules/page.tsx` | Rules of the game + pot/lives; optional lobby context | Rules list, Pot & Lives (with lobby data when `?lobbyId=`), OwnerSettingsModal for owner | OwnerSettingsModal | With/without lobbyId; owner sees Edit |
| `/privacy` | `app/privacy/page.tsx` | Static privacy policy | Sections: intro, data collected, use, sharing, Strava, retention, security, children, changes, contact | — | Static |
| `/history` | `app/history/page.tsx` | History landing: "choose a lobby" | Single card + link to /lobbies | — | Static |
| `/stats` | `app/stats/page.tsx` | Stats landing: "select a lobby" | Single card + link to /lobbies | — | Static |

**Note:** `app/lobby/[lobbyId]/history/page.tsx` receives `params` as a **Promise** (Next 15+). It unwraps it in `useEffect` and sets `lobbyId` state; ensure the Lovable app uses the same async params pattern if using App Router.

---

## 3. Component Inventory

### Layout / Navigation
- **`components/Navbar.tsx`** — Sticky top nav: logo "GYM DEATHMATCH", sign in/out, ProfileAvatar, theme toggle, desktop tabs (Home, Lobbies, Stats, History, Rules), CreateLobby, "My Lobbies". Stats/History hrefs switch to per-lobby when `resolvedLobbyId` is set (from path or useLastLobbySnapshot). Used in root layout.
- **`components/MobileNav.tsx`** — Fixed bottom nav (mobile): Home, Lobbies, Log (FAB opens ManualActivityModal), History, More (slide-up menu with Create Lobby, Stats, Rules, IntroGuide). Uses `resolvedLobbyId` for stats/history links and for opening ManualActivityModal. Used in root layout.
- **`components/LobbyLayout.tsx`** — Main arena layout when stage is ACTIVE (or not pre-stage/completed): header strip (share, name, season, mode, Edit for owner), divider, optional Scoreboard or ChallengeHero, RecentFeed, player grid (PlayerCard), KoOverlay, WinnerOverlay, PeriodSummaryOverlay, OwnerSettingsModal. Handles weekStatus for CHALLENGE_ modes (WeekSetup when PENDING_CONFIRMATION). Used by LobbySwitcher.
- **`components/PageMotion.tsx`** — Wrapper for page content (motion). Used in root layout.
- **`components/LobbySwitcher.tsx`** — Chooses view by stage/lobby state: loading overlay, RouletteTransitionPanel (transition_spin + CHALLENGE_ROULETTE + weekStatus !== PENDING_CONFIRMATION), PreStageView (PRE_STAGE or override), SeasonCompleteOverlay (COMPLETED + summary), else LobbyLayout. Uses useLobbyLive, useLobbyRealtime. Used by `app/lobby/[lobbyId]/page.tsx`.

### Lobby management
- **`components/CreateLobby.tsx`** — Modal/trigger to create lobby: name, season start/end, weekly target, lives, mode, sudden death, pot settings, challenge settings; calls `POST /api/lobby/create`. Can be used as trigger or with custom children (e.g. in MobileNav). Props: `children?`.
- **`components/JoinLobby.tsx`** — Form to join a lobby: name, avatar URL, quip; prefills from profile; calls `POST /api/lobby/[lobbyId]/invite`. Props: `lobbyId: string`. Used on `/join/[lobbyId]`.
- **`components/InvitePlayerCard.tsx`** — (Verify usage in codebase; likely invite/onboard related.)
- **`components/LobbyFiltersBar.tsx`** — Search, sort (newest, oldest, season, name), filters (show mine, active, completed, money, challenge). Props: searchQuery, onSearchChange, sortBy, onSortChange, filters, onFiltersChange, totalCount, filteredCount. Used on `/lobbies`.
- **`components/OwnerSettingsModal.tsx`** — Owner-only modal: weekly target, lives, season end, initial pot, weekly ante, scaling, per-player boost, mode, sudden death, challenge settings, danger zone (remove player, transfer owner, delete lobby). Calls PATCH `/api/lobby/[lobbyId]/settings` or POST `season/next` when isNextSeason. Props: lobbyId, ownerPlayerId, defaultWeekly, defaultLives, defaultSeasonEnd, defaultInitialPot, defaultWeeklyAnte, defaultScalingEnabled, defaultPerPlayerBoost, onSaved, autoOpen?, hideTrigger?, onClose?, open?, isNextSeason?. Used on Lobbies page (edit), LobbyLayout (edit), PreStageView (edit), Rules (when owner).

### Arena / Season
- **`components/PreStageView.tsx`** — Pre-stage UI: header with share/Edit, CountdownHero (when scheduled) or "AWAITING HOST", host controls (Start now, schedule datetime, Schedule start, Cancel schedule, Add me to lobby), "Athletes on deck" grid with StatusBadge / Connect Strava. Calls PATCH `/api/lobby/[lobbyId]/stage`, GET live. Props: `lobby: Lobby`.
- **`components/Countdown.tsx`** — Countdown display (assumed used by CountdownHero).
- **`components/CountdownHero.tsx`** — Hero countdown to season start. Props: lobbyId, targetIso, seasonLabel, hostName?, numAthletes?.
- **`components/Scoreboard.tsx`** — Cash pot display; owner can edit (prompt for amount, POST `/api/lobby/[lobbyId]/pot`). Props: amount, endIso, canEdit, onEdit.
- **`components/CashPool.tsx`** — (Likely pot display variant; verify usage.)
- **`components/ChallengeHero.tsx`** — Challenge mode header (season dates, challenge settings). Props: lobbyId, mode, challengeSettings, seasonStart, seasonEnd.
- **`components/ChallengeSettingsCard.tsx`** — Challenge settings form/display. Used inside OwnerSettingsModal / CreateLobby.
- **`components/WeekSetup.tsx`** — Shown when weekStatus === PENDING_CONFIRMATION (CHALLENGE_): punishment text, ready toggles per player, owner "Start week" (POST week-start). Props: lobbyId, week, punishmentText, mode, challengeSettings, players, isOwner.
- **`components/RouletteTransitionPanel.tsx`** — Shown during transition_spin for CHALLENGE_ROULETTE: spin/punishment reveal. Props: lobby.
- **`components/SeasonCompleteOverlay.tsx`** — Full-screen overlay when season COMPLETED: summary, winners/losers, "Start next season" (owner) or "Back to lobbies". Props: lobbyId, seasonNumber, mode, seasonSummary, isOwner, defaultWeekly, defaultLives, defaultSeasonEnd, ownerPlayerId, onNextSeason.
- **`components/PlayerCard.tsx`** — Single player: avatar, name, location, streak boxes, HeartDisplay, weekly target, "Log workout manually" (me), Strava connect/disconnect, QuipBubble, ManualActivityModal. Props: player, lobbyId?, mePlayerId?, showReady?.
- **`components/HeartDisplay.tsx`** — Hearts/lives display. Props: lives (number).

### Live feed / Workouts
- **`components/RecentFeed.tsx`** — "LIVE ARENA FEED": list of feed items from GET `/api/lobby/[lobbyId]/feed`, poll 30s; "View full history →" link. Props: lobbyId?, events? (optional seed).
- **`components/ManualActivityModal.tsx`** — Modal: type, duration, distance, notes, caption, **photo upload (required)** to Supabase "manual-activity-photos", then POST `/api/lobby/[lobbyId]/activities/manual`. Props: open, onClose, lobbyId, onSaved?.

### Voting ("Feels sus")
- Voting UI is **inline on History** (app/lobby/[lobbyId]/history/page.tsx): "Count it ✅", "Feels sus 🚩", "Remove vote". No standalone component; uses `Button`, and POST `/api/activities/[activityId]/vote` with choice: "legit" | "sus" | "remove". Owner override: "APPROVE" / "REJECT" → POST `/api/activities/[activityId]/override`.

### Comments / Replies
- **ActivityComments** — Defined **inline** in `app/lobby/[lobbyId]/history/page.tsx` (not a separate file): loads GET `/api/activity/[activityId]/comments`, post reply (POST same), delete (DELETE `/api/comments/[commentId]`). Threaded (parentId), author/avatar, Reply/Delete. Props: activityId, lobbyId, myPlayerId, ownerUserId.

### Stats / Records / History
- **`components/ui/StatusPill.tsx`** — Status pill (e.g. pending/approved/rejected). Used on History.
- **`components/ui/Button.tsx`** — Button with variant/size. Used across History, modals.
- **`components/ui/StyledSelect.tsx`** — Styled select. Used on History (owner tools).
- Lobby stats/summary are implemented **in-page** in `app/lobby/[lobbyId]/stats/page.tsx` and `app/lobby/[lobbyId]/summary/page.tsx` (no shared stats component).

### Modals / Dialogs
- **`components/OwnerSettingsModal.tsx`** — See Lobby management.
- **`components/ManualActivityModal.tsx`** — See Live feed.
- **`components/CreateLobby.tsx`** — Can render as modal with trigger. See Lobby management.
- **KoOverlay** — Modal for KO (loser name, avatar, pot, link to summary). Props: open, onClose, lobbyId, loserName, loserAvatar?, pot.
- **WinnerOverlay** — Modal for winner celebration; "Celebrate again" (owner). Props: open, onClose, winnerName, winnerAvatar?, pot, lobbyId.
- **PeriodSummaryOverlay** — Daily/weekly summary popover; dismiss stores in localStorage. Props: open, onClose, data, period.

### Punishment / Roulette
- **`components/punishment/PunishmentWheel.tsx`** — Roulette wheel UI (react-custom-roulette). Used by RouletteTransitionPanel.
- **`components/PunishmentBanner.tsx`** — Banner for punishment; "Suggest" link.
- **`components/WeeklyPunishmentCard.tsx`** — Weekly punishment card (verify where used).

### Form controls / UI primitives
- **`components/ui/Button.tsx`** — variant, size, className, etc.
- **`components/ui/StatusPill.tsx`** — status display.
- **`components/ui/StyledSelect.tsx`** — select dropdown.
- **`components/PushToggle.tsx`** — (Verify: push notifications?)

### Auth / Profile / Theme
- **`components/AuthProvider.tsx`** — Auth context (user, isHydrated, signInWithGoogle, signOut). Wraps app.
- **`components/AuthButtons.tsx`** — (Verify: may be redundant with Navbar buttons.)
- **`components/ProfileAvatar.tsx`** — User avatar in nav (likely from user_profile or auth).
- **`components/useTheme.ts`** — Theme (dark/light) toggle; used in Navbar.

### Other
- **`components/ToastProvider.tsx`** — Toast context (push). Used in layout.
- **`components/IntroGuide.tsx`** — Onboarding/intro guide (optional). Used in Navbar and MobileNav.
- **`components/CreateLobbyInfo.tsx`** — Info content for create-lobby flow. Used in CreateLobby / OwnerSettingsModal.
- **`components/QuipBubble.tsx`** — Quip text bubble. Used in PlayerCard.
- **`components/StatusBadge.tsx`** — Online/offline/connected badge. Used in PreStageView, PlayerCard.
- **`components/DebugFooter.tsx`** — Debug info (likely env or build). Used in layout.
- **`components/PWARegister.tsx`**, **`components/PWAMeta.tsx`** — PWA registration and meta. Used in layout.

---

## 4. Domain Models & Types

- **Lobby** — `types/game.ts`: id, name, players[], seasonNumber, seasonStart, seasonEnd, cashPool, initialPot?, weeklyAnte?, scalingEnabled?, perPlayerBoost?, weeklyTarget?, initialLives?, ownerId?, ownerUserId?, status?, stage?, scheduledStart?, mode?, suddenDeathEnabled?, challengeSettings?, seasonSummary?.
- **Player** — `types/game.ts`: id, name, avatarUrl, location?, userId?, currentStreak, longestStreak, livesRemaining, totalWorkouts, averageWorkoutsPerWeek, quip, isStravaConnected?, weeklyTarget?, heartsTimeline?, taunt?, inSuddenDeath?, ready?.
- **SeasonSummary** — `types/game.ts`: seasonNumber, winners[], losers[], finalPot, highlights (longestStreak, mostWorkouts, mostConsistent), debts?.
- **ChallengeSettings** — `types/game.ts`: selection, spinFrequency, visibility, stackPunishments, allowSuggestions, requireLockBeforeSpin, autoSpinAtWeekStart, showLeaderboard, profanityFilter, suggestionCharLimit.
- **GameMode** — `types/game.ts`: MONEY_SURVIVAL | MONEY_LAST_MAN | CHALLENGE_ROULETTE | CHALLENGE_CUMULATIVE.
- **Activity (manual)** — DB: manual_activities (id, lobby_id, player_id, date, duration_minutes, distance_km, type, notes, photo_url, caption, status, vote_deadline, decided_at, etc.). Types: ActivityRow in game.ts; history page uses local ActivityRow with player_snapshot, photo_url, vote_deadline, decided_at, status.
- **Comment** — API returns: id, lobbyId, activityId, parentId, threadRootId, body, createdAt, authorPlayerId, authorName, authorAvatarUrl. History page: PostComment type.
- **Vote** — activity_votes: activity_id, voter_player_id, choice (legit | sus). Resolved by API (see vote route).
- **Pot / Hearts** — lobby.cash_pool, initial_pot, weekly_ante; player.lives_remaining (hearts). heart_adjustments table for owner adjustments.
- **EventLog** — history_events: id, lobby_id, actor_player_id, target_player_id, type, payload, created_at. Types: ACTIVITY_LOGGED, VOTE_RESULT, WEEKLY_TARGET_MET, WEEKLY_TARGET_MISSED, OWNER_OVERRIDE_ACTIVITY, OWNER_ADJUST_HEARTS, COMMENT, SEASON_KO, etc.
- **WeeklyTarget / Punishments** — lobby_punishments, user_punishments, week_ready_states, user_ready_states (see schema). Weekly contributions: weekly_pot_contributions.

**Type locations:** `types/game.ts`, `types/api.ts` (LiveLobbyResponse, etc.). DB schema: `supabase/schema.sql` (lobby, player, strava_token, user_profile, user_strava_token, manual_activities, activity_votes, history_events, comments, heart_adjustments, lobby_punishments, user_punishments, week_ready_states, user_ready_states, weekly_pot_contributions, etc.).

---

## 5. Data Flow Map (APIs / Hooks / Services)

### API routes (path → method → returns / purpose → used by)

| Path | Method | Returns / purpose | Called from |
|------|--------|-------------------|-------------|
| `/api/lobbies` | GET | `{ lobbies }` for user (query: userId) | Lobbies page |
| `/api/lobby/create` | POST | Creates lobby, returns lobby id etc. | CreateLobby |
| `/api/lobby/[lobbyId]` | DELETE | Deletes lobby (owner) | OwnerSettingsModal |
| `/api/lobby/[lobbyId]/live` | GET | LiveLobbyResponse (lobby, stage, seasonSummary, koEvent, errors) | useLobbyLive, PreStageView, LobbyLayout (via hook), History (check existing player), Rules, Stats, Summary (indirect), JoinLobby, Onboard |
| `/api/lobby/[lobbyId]/feed` | GET | `{ items }` feed entries | RecentFeed |
| `/api/lobby/[lobbyId]/history` | GET | activities, players, events, votes, comments, ownerPlayerId, myPlayerId, lobby (name, cash_pool) | Lobby History page |
| `/api/lobby/[lobbyId]/invite` | POST | Join lobby (body: name, avatarUrl, location?, quip?, userId) | JoinLobby, Onboard [lobbyId] |
| `/api/lobby/[lobbyId]/leave` | POST | Leave lobby (body: userId) | Lobbies page |
| `/api/lobby/[lobbyId]/stage` | PATCH | Set status/scheduledStart/startNow | PreStageView |
| `/api/lobby/[lobbyId]/settings` | PATCH | Update lobby settings | OwnerSettingsModal |
| `/api/lobby/[lobbyId]/mode` | GET | mode, suddenDeathEnabled, challengeSettings | OwnerSettingsModal, CreateLobby (load) |
| `/api/lobby/[lobbyId]/pot` | POST | Set pot (body: targetPot) | LobbyLayout (Scoreboard onEdit), History (owner pot input) |
| `/api/lobby/[lobbyId]/adjust-hearts` | POST | Owner adjust hearts (body: ownerPlayerId, targetPlayerId, delta) | History (owner tools) |
| `/api/lobby/[lobbyId]/activities/manual` | POST | Create manual activity (body: type, durationMinutes, distanceKm, notes, photoUrl, caption) | ManualActivityModal |
| `/api/lobby/[lobbyId]/summary` | GET | period summary (daily/weekly) for overlay | LobbyLayout |
| `/api/lobby/[lobbyId]/punishments` | GET, POST | GET: active punishment, weekStatus; POST: submit punishment | LobbySwitcher (poll), LobbyLayout (poll), WeekSetup |
| `/api/lobby/[lobbyId]/punishments/lock` | POST | Lock punishments | OwnerSettingsModal / punishment flow |
| `/api/lobby/[lobbyId]/punishments/resolve-all` | POST | Resolve all punishments for user | Summary page |
| `/api/lobby/[lobbyId]/week-ready` | GET, POST | GET: readyByPlayer; POST: set ready (body: playerId, week, ready) | WeekSetup |
| `/api/lobby/[lobbyId]/week-start` | POST | Start week (owner) | WeekSetup |
| `/api/lobby/[lobbyId]/season/next` | POST | Start next season | OwnerSettingsModal (isNextSeason) / SeasonCompleteOverlay |
| `/api/lobby/[lobbyId]/owner` | PATCH | Transfer ownership | OwnerSettingsModal |
| `/api/lobby/[lobbyId]/players/[playerId]` | DELETE | Remove player (owner) | OwnerSettingsModal |
| `/api/lobby/[lobbyId]/players/[playerId]/sudden-death` | POST | Set sudden death (admin) | Admin/owner |
| `/api/activities/[activityId]/vote` | POST | Vote legit/sus/remove (body: voterPlayerId, choice) | History page |
| `/api/activities/[activityId]/override` | POST | Owner override status (body: ownerPlayerId, newStatus) | History page |
| `/api/activity/[activityId]/comments` | GET, POST | GET: comments; POST: add comment (body: body, parentId?) | ActivityComments (History) |
| `/api/comments/[commentId]` | DELETE | Delete comment | ActivityComments |
| `/api/history-events/[eventId]` | DELETE | Delete history event (owner) | History page |
| `/api/user/profile` | GET, PUT | Get/update user profile (query userId; body: displayName, avatarUrl, location, quip) | Onboard, PreStageView, CreateLobby, JoinLobby |
| `/api/user/sync` | POST | Sync player(s) from user profile (body: userId, playerId?, overwriteAll?) | Onboard, LobbyLayout, PreStageView |
| `/api/user/avatar` | POST | Avatar upload | (Verify usage) |
| `/api/profile` | GET, PUT | Profile (alternate?) | (Verify usage) |
| `/api/strava/authorize` | GET | Redirect to Strava OAuth (query: playerId, lobbyId) | Onboard, JoinLobby, PreStageView, PlayerCard |
| `/api/strava/callback` | GET | OAuth callback | Strava redirect |
| `/api/strava/disconnect` | POST | Disconnect Strava (body: playerId, userId?) | PlayerCard |
| `/api/strava/status` | GET | Strava connection status | (Verify) |
| `/api/notifications/subscribe` | POST | Push subscribe | (Verify) |
| `/api/notifications/unsubscribe` | POST | Push unsubscribe | (Verify) |
| `/api/admin/lobby/[lobbyId]` | DELETE | Admin delete lobby | Admin |
| `/api/admin/lobby/[lobbyId]/player/[playerId]` | DELETE | Admin remove player | Admin |
| `/api/punishments/[id]/resolve` | POST | Resolve single punishment | (Verify) |
| `/api/dev/seed` | POST | Seed dev data | Dev only |

### Key client hooks / services
- **`hooks/useLobbyLive.ts`** — `useLobbyLive(lobbyId)`: fetch GET `/api/lobby/[lobbyId]/live`, returns `{ data, loading, error, reload }`. Listens for `gymdm:refresh-live`. Polling 20s via useAutoRefresh.
- **`hooks/useLobbyRealtime.ts`** — `useLobbyRealtime(lobbyId, { onChange })`: Supabase Realtime on lobby, player, manual_activities, history_events, comments, heart_adjustments, lobby_punishments, week_ready_states, user_ready_states; triggers onChange or dispatches `gymdm:refresh-live`.
- **`hooks/useLastLobby.ts`** — `useLastLobbySnapshot()`: reads last lobby id/name from localStorage (LAST_LOBBY_STORAGE_KEY); used by Navbar/MobileNav to resolve Stats/History links and "Log" lobby.
- **`hooks/useAutoRefresh.ts`** — Generic polling (callback, intervalMs, deps). Used by useLobbyLive, Lobby History (30s), Lobbies page (10s).
- **`lib/supabaseBrowser.ts`** — `getBrowserSupabase()`: client Supabase. Used for storage (avatars, manual-activity-photos), Realtime, signed URLs.
- **`lib/supabaseClient.ts`** — Server Supabase (getServerSupabase). Used in server components and API routes.
- **Custom event** — `gymdm:refresh-live`: dispatched after manual post, join, etc.; useLobbyLive and history reload listen. `gymdm:last-lobby`: emitted when last lobby is stored (LobbyLayout).

### Realtime
- **Supabase Realtime** (useLobbyRealtime): tables listed above, filter by lobby_id (or id for lobby). On change → reload live data.
- **History page** additionally subscribes to `activity_votes` and `manual_activities` (UPDATE) for that lobby to refresh history list.
- **Polling:** Lobbies 10s; useLobbyLive 20s; History 30s; WeekSetup/weekStatus 5s; LobbyLayout punishments 10s; LobbySwitcher weekStatus (CHALLENGE_) 5s.

---

## 6. Critical Interactions to Preserve

1. **Creating / joining / leaving lobbies**  
   Create: CreateLobby → POST `/api/lobby/create`. Join: JoinLobby or Onboard [lobbyId] → POST `/api/lobby/[lobbyId]/invite`; then redirect to lobby (or onboard with Strava link). Leave: Lobbies page → confirm → POST `/api/lobby/[lobbyId]/leave` → reload list.

2. **Scheduling / starting season**  
   PreStageView: owner "Start Deathmatch now" or "Schedule start" → PATCH `/api/lobby/[lobbyId]/stage` (startNow or status/scheduledStart). Cancel schedule → PATCH with status pending. After start, status may become active or transition_spin (roulette); LobbySwitcher shows RouletteTransitionPanel or LobbyLayout.

3. **Active season progress**  
   LobbyLayout + useLobbyLive + useLobbyRealtime keep lobby/players/hearts/pot in sync. Scoreboard (pot) editable by owner. PlayerCard shows hearts, streaks, "Log workout manually". ManualActivityModal → upload photo → POST manual activity → refresh (gymdm:refresh-live).

4. **Submitting workout with image upload**  
   ManualActivityModal: type, duration, distance, notes, caption, **file** (required). Upload to Supabase storage "manual-activity-photos" (path: `userId/timestamp_filename`), then POST `/api/lobby/[lobbyId]/activities/manual` with photoUrl. Toast + onSaved → close and refresh.

5. **Viewing workout detail**  
   Full detail is on **History** page: each activity row shows player, date, caption, notes, photo (with lightbox), type/duration/distance, status pill, vote counts, voting buttons, owner override, ActivityComments.

6. **Voting "Feels sus" and majority invalidation**  
   - Vote: POST `/api/activities/[activityId]/vote` with choice "legit" | "sus" | "remove".  
   - Backend (vote route): eligible voters = players.length - 1; 0 votes on approved → revert to approved; 75%+ sus → rejected; majority sus → rejected; majority legit (or timeout) → approved; history_events + commentary.  
   - When invalidated (rejected): activity status becomes "rejected", decided_at set; UI shows "Rejected" and vote counts. Owner can override to approved/rejected anytime.

7. **Commenting + replies**  
   ActivityComments: GET comments, POST new (body, parentId), DELETE by id. Threaded; author/owner can delete. Requires myPlayerId (joined lobby) to comment.

8. **Host / admin actions**  
   - OwnerSettingsModal: edit settings, remove player, transfer owner, delete lobby.  
   - History: owner tools — adjust hearts (+1/-1 per player), pot input (onBlur save).  
   - History: owner override per activity (APPROVE/REJECT).  
   - History: owner can delete history events (✕).  
   - WeekSetup: owner "Start week" (POST week-start).  
   - SeasonCompleteOverlay: owner "Start next season" (opens OwnerSettingsModal with isNextSeason and POST season/next).

9. **Stats + history views**  
   Stats: GET live → display totals and per-player stats (total time, distance, avg duration, most frequent type, etc.). History: GET history → merged chronological list of activities + events; filter by lobby; owner tools and voting only when applicable.

10. **Share lobby**  
    Copy/share URL: `${origin}/onboard/[lobbyId]`. LobbyLayout and PreStageView have share button (navigator.share or clipboard).

11. **Theme toggle**  
    useTheme in Navbar; theme persisted (assumed localStorage).

12. **Last lobby persistence**  
    LobbyLayout writes to localStorage (LAST_LOBBY_STORAGE_KEY); Home and Navbar/MobileNav read it for "Resume" and for Stats/History/Log context.

---

## 7. UI Transplant Parity Checklist

Use this table to ensure the Lovable redesign has a corresponding component/screen for every OG feature. Implement each row in the new UI.

| OG Feature Surface | OG File(s) | Route / Screen | Required UI elements | Required interactions | Notes / Edge cases |
|--------------------|------------|----------------|----------------------|------------------------|---------------------|
| Root redirect | app/page.tsx | / | — | Redirect to /home or /lobbies by auth | No visible UI |
| Home | app/home/page.tsx | /home | Resume last lobby card (name, Open, View history), Welcome card (View lobbies, Read rules) | Links to lobby, lobby/history, /lobbies, /rules | Last lobby from localStorage |
| Lobbies list | app/lobbies/page.tsx | /lobbies | Header, search, sort, filters (mine, active, completed, money, challenge), lobby cards (name, Owner badge, season, cash, target, lives, mode, dates, Open / Edit / Leave) | Open → /lobby/[id], Edit → OwnerSettingsModal, Leave → confirm + POST leave + reload | Poll 10s; auth-gated fetch |
| Join lobby (by id) | app/join/[lobbyId]/page.tsx, JoinLobby.tsx | /join/[lobbyId] | Header, JoinLobby form (name, avatar, quip, Join) | Join → POST invite → redirect to lobby?joined=1 | Prefill from profile |
| Onboard (sign-in) | app/onboard/page.tsx | /onboard | Card, "Continue with Google" | Sign in → redirect /lobbies | Redirect if already signed in |
| Onboard (invite flow) | app/onboard/[lobbyId]/page.tsx | /onboard/[lobbyId] | Profile form (display name, location, quip, avatar URL or file upload), Save profile, Join this lobby / Already joined, Strava connect link | Save profile (PUT profile + POST sync), Join (POST invite → redirect), Strava link with playerId & lobbyId | If already player in lobby, show "Already joined" and still allow Strava link |
| Main arena (lobby) | app/lobby/[lobbyId]/page.tsx, LobbySwitcher.tsx | /lobby/[lobbyId] | Loading overlay; then one of: PreStageView, RouletteTransitionPanel, SeasonCompleteOverlay, LobbyLayout | Stage-driven; realtime + poll refresh | Server fetch lobby + players for initial render; 404 if lobby missing |
| Pre-stage | PreStageView.tsx | (inside /lobby/[lobbyId]) | Header (share, Edit), CountdownHero or "AWAITING HOST", Host controls (Start now, datetime, Schedule start, Cancel schedule, Add me to lobby), Athletes on deck (avatar, name, location, quip, streak, Connect Strava) | PATCH stage (start/schedule/cancel), share, OwnerSettingsModal, invite self, Strava link | Poll live 10s |
| Roulette transition | RouletteTransitionPanel.tsx | (inside /lobby/[lobbyId]) | Spin / punishment reveal for CHALLENGE_ROULETTE | — | Only when status transition_spin and weekStatus !== PENDING_CONFIRMATION |
| Week setup (pending confirmation) | WeekSetup.tsx | (inside LobbyLayout) | Punishment text, per-player ready toggles, owner "Start week" | POST week-ready (toggle), POST week-start (owner) | Poll ready 5s |
| Active arena layout | LobbyLayout.tsx | (inside /lobby/[lobbyId]) | Header (share, name, season, mode, Edit), Scoreboard (pot) or ChallengeHero, RecentFeed, player grid (PlayerCards), KoOverlay, WinnerOverlay, PeriodSummaryOverlay, OwnerSettingsModal | Share, Edit pot (owner), refresh, PeriodSummary dismiss (localStorage), "Celebrate again" (owner when completed) | Challenge mode: show ChallengeHero; Money: Scoreboard |
| Scoreboard | Scoreboard.tsx | (inside LobbyLayout) | Pot amount, end date, Edit (owner) | Owner: prompt → POST pot | — |
| Challenge hero | ChallengeHero.tsx | (inside LobbyLayout) | Season dates, challenge settings display | — | — |
| Recent feed | RecentFeed.tsx | (inside LobbyLayout) | "LIVE ARENA FEED" list, "View full history →" | Poll feed 30s | Link to /lobby/[id]/history |
| Player card | PlayerCard.tsx | (inside LobbyLayout) | Avatar, name, location, streak boxes, HeartDisplay, weekly target, "Log workout manually" (me), Strava Connect/Disconnect, QuipBubble, ManualActivityModal | Open manual modal, Strava link/disconnect, refresh on save | isMe by mePlayerId or userId |
| Season complete overlay | SeasonCompleteOverlay.tsx | (inside /lobby/[lobbyId]) | Summary (winners/losers, pot, highlights), "Start next season" (owner) or "Back to lobbies" | Owner: open OwnerSettingsModal (isNextSeason) → POST season/next; others: navigate to /lobbies | — |
| KO overlay | KoOverlay.tsx | (inside LobbyLayout) | Loser name, avatar, pot, "View Season Summary" link | onClose, link to /lobby/[id]/summary | Shown when koEvent and showKo |
| Winner overlay | WinnerOverlay.tsx | (inside LobbyLayout) | Winner name, avatar, pot | onClose; owner can "Celebrate again" | — |
| Period summary overlay | PeriodSummaryOverlay.tsx | (inside LobbyLayout) | Daily or weekly summary (hearts leaders/low) | Dismiss → store in localStorage by key | First-visit per day/week |
| Lobby history | app/lobby/[lobbyId]/history/page.tsx | /lobby/[lobbyId]/history | Header, Owner tools (athlete select, +1/-1 hearts, pot input), Chronological list (events + activity posts), per-post: avatar, name, date, StatusPill, caption, notes, photo (lightbox), type/duration/distance, vote counts, voting buttons (Count it, Feels sus, Remove vote), owner override (APPROVE/REJECT), ActivityComments | Vote (POST vote), override (POST override), adjust hearts (POST adjust-hearts), pot onBlur (POST pot), delete event (DELETE history-events), load comments, post/delete comments | Realtime on activity_votes + manual_activities; 30s poll; canVote: not own, not decided, 3+ players, within deadline |
| Activity comments | (inline in history page) | (inside History) | Threaded comments, author/avatar, Reply, Delete | GET comments, POST comment (body, parentId), DELETE comment | Author or owner can delete |
| Lobby stats | app/lobby/[lobbyId]/stats/page.tsx | /lobby/[lobbyId]/stats | Header, summary cards (total workouts, combined streaks, most consistent), per-player cards (time, distance, avg, most frequent, longest, earliest/latest, activity sources Strava vs manual) | — | Data from GET live |
| Season summary | app/lobby/[lobbyId]/summary/page.tsx | /lobby/[lobbyId]/summary | Final pot, initial + contributions, weekly contributions list, KO block (loser, pot at KO), Cumulative punishments per user, "Resolve all" per user, Back to Lobby | Resolve all → POST punishments/resolve-all, reload | Data from Supabase (player, weekly_pot_contributions, history_events, lobby, user_punishments) |
| Rules | app/rules/page.tsx | /rules | Rules list, Pot & Lives (from lobby when ?lobbyId=), OwnerSettingsModal trigger (owner) | Load lobby when lobbyId; owner can open Edit | Optional query lobbyId |
| Privacy | app/privacy/page.tsx | /privacy | Static sections, contact mailto | — | — |
| History landing | app/history/page.tsx | /history | "Choose a lobby", link to /lobbies | — | — |
| Stats landing | app/stats/page.tsx | /stats | "Select a lobby", link to /lobbies | — | — |
| Create lobby | CreateLobby.tsx | (Navbar, MobileNav) | Modal: name, season start/end, weekly, lives, mode, sudden death, pot settings, challenge settings, Create | POST create, redirect or refresh list | Prefill owner from profile |
| Join lobby (component) | JoinLobby.tsx | /join/[lobbyId] | Form: name, avatar URL, quip; Join / Sign in | POST invite, redirect with ?joined=1 | — |
| Owner settings modal | OwnerSettingsModal.tsx | Lobbies, LobbyLayout, PreStage, Rules | Weekly, lives, season end, pot, ante, scaling, mode, sudden death, challenge settings, remove player, transfer owner, delete lobby | PATCH settings or POST season/next (isNextSeason) | Load mode GET; danger zone confirm by typing name |
| Manual activity modal | ManualActivityModal.tsx | MobileNav "Log", PlayerCard | Type, duration, distance, notes, caption, **photo upload** (required) | Upload to Supabase bucket then POST activities/manual, onSaved → refresh | Must have photo + caption |
| Navbar | Navbar.tsx | (layout) | Logo, sign in/out, ProfileAvatar, theme toggle, tabs (Home, Lobbies, Stats, History, Rules), CreateLobby, My Lobbies, IntroGuide | Navigate; Stats/History use resolvedLobbyId when in lobby | resolvedLobbyId from path or lastLobby |
| Mobile nav | MobileNav.tsx | (layout) | Bottom: Home, Lobbies, Log (FAB), History, More; More sheet: Create Lobby, Stats, Rules, Guide | Log → ManualActivityModal (requires resolvedLobbyId) | resolvedLobbyId for Log + links |
| Heart display | HeartDisplay.tsx | PlayerCard | Visual hearts/lives | — | — |
| Countdown hero | CountdownHero.tsx | PreStageView | Countdown to scheduled start | — | — |
| Lobby filters bar | LobbyFiltersBar.tsx | /lobbies | Search, sort dropdown, filter toggles (mine, active, completed, money, challenge), counts | Update filter state | — |
| OG image | app/og/lobby/[lobbyId]/route.tsx | GET /og/lobby/[lobbyId] | Dynamic OG image (lobby name, owner invite text) | — | API route, not screen; used in metadata |

---

**End of UI Transplant Overview.** Use this checklist to ensure the Lovable redesign implements every route, component, and interaction listed above.
