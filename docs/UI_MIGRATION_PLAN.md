## UI Migration Plan (Gym Deathmatch → Arena Redesign)

### Constraints
- Preserve existing business logic, API calls, DB interactions, auth, and state behavior.
- Keep existing routes stable.
- New UI is presentation-only; adapt data via adapters.
- Add TODO(INTEGRATION) where UI lacks backing functionality.
- Keep changes incremental and build-safe.

### Proposed Steps
1. **Phase 0 (Discovery):** Validate framework, styling, data patterns; review arena docs; identify OG arena/season page and live feed surface.
2. **Phase 1 (Base Layer):** Import arena UI primitives, add styling tokens, add smoke test route.
3. **Phase 2 (Screen-by-screen):** Migrate navigation shell → lobbies → pre-stage → active arena → workout submission/detail → voting → comments → stats/history → admin/danger zone.
4. **Phase 3 (Parity & Gaps):** Create parity checklist, fill missing components or add TODO(INTEGRATION) stubs.

### Risks
- CSS token collisions between OG and UI2 styles (mitigated by `.ui2-scope`).
- Missing UI dependencies causing build failures (mitigated by explicit dependency install).
- Data shape mismatches between OG models and arena contracts (mitigated with adapters).

### Success Criteria
- UI2 primitives render in a smoke-test page without breaking existing UI.
- All new UI components compile in the OG repo without changing existing routes.
- Incremental migrations do not break existing functionality.

---

## Phase 1 Milestone (Completed)

**What was added**
- `src/ui2/ui/` base primitives copied from arena: `button`, `card`, `input`, `textarea`, `badge`, `label`, `dialog`, `tabs`, `select`, `separator`, `toast`, `toaster`, `use-toast`.
- `src/ui2/hooks/use-toast.ts` for local toast state.
- `lib/utils.ts` (`cn`) to satisfy UI2 imports.
- Tailwind config extended with arena tokens + animations and `tailwindcss-animate` plugin.
- Scoped UI2 CSS tokens in `app/globals.css` (no global overrides).
- Smoke test route: `app/ui2-smoke/page.tsx`.

**What’s next**
- Expand `src/ui2` with additional arena primitives as needed.
- Add adapters in `src/ui2/adapters/` for OG data → arena UI props.
- Begin Phase 2 with Navigation Shell migration.

---

## Phase 2 Milestone 1 (Completed)

**Navigation shell**
- Added `src/ui2/components/ArenaNav.tsx` (Next.js Link + OG auth/theme behavior).
- Added `src/ui2/components/MobileBottomNav.tsx` (bottom nav + Log modal + More sheet).
- Added `src/ui2/ui/sheet.tsx` to support mobile sheets.
- Swapped `app/layout.tsx` to use `ArenaNav` + `MobileBottomNav`.
- Added scoped helpers in `app/globals.css` for UI2 safe-area + touch targets.

**What’s next**
- Add adapters in `src/ui2/adapters/` for OG data → arena UI props.
- Migrate Lobbies list screen (Phase 2 step 2).

---

## Phase 2 Milestone 2 (Completed)

**Lobbies list**
- Added `src/ui2/components/LobbyCard.tsx` and `src/ui2/components/LobbyFiltersBar.tsx`.
- Added `src/ui2/adapters/lobby.ts` for OG lobby row mapping.
- Migrated `app/lobbies/page.tsx` to UI2 layout.

---

## Phase 2 Milestone 3 (Completed)

**Pre-stage lobby**
- Added `src/ui2/components/CountdownTimer.tsx` and `src/ui2/components/AthleteCard.tsx`.
- Updated `components/PreStageView.tsx` to UI2 layout (no logic changes).
- Added scoped UI2 utility styles (arena-panel, countdown-block, status-dot, etc.).

**What’s next**
- Migrate active arena layout (LobbyLayout + RecentFeed).

---

## Phase 2 Milestone 4 (Completed)

**Active arena layout + live feed**
- Added UI2 components: `ActiveSeasonHeader`, `PotStakesPanel`, `LiveFeed`.
- Reworked `components/LobbyLayout.tsx` to UI2 layout while preserving existing logic, overlays, and actions.
- Replaced `RecentFeed` with UI2 `LiveFeed` (same API endpoint).
- Added scoped UI2 helpers for feed animations and gold badge styling.

**What’s next**
- Migrate workout submission + workout detail + image preview.

---

## Phase 2 Milestone 5 (Completed)

**Workout submission + history feed**
- Updated `components/ManualActivityModal.tsx` to UI2 styling while preserving upload + submit logic.
- Migrated `app/lobby/[lobbyId]/history/page.tsx` to UI2 layout (header, event cards, activity cards, owner tools).
- Replaced legacy lightbox with UI2 `PhotoLightbox` and refreshed comments styling.

**What’s next**
- Migrate voting + comments surfaces across remaining screens.

---

## Phase 2 Milestone 6 (Completed)

**Stats + history landings**
- Updated `app/stats/page.tsx` and `app/history/page.tsx` to UI2 panels.
- Migrated `app/lobby/[lobbyId]/stats/page.tsx` to UI2 layout.
- Added explicit desktop hide rules for `MobileBottomNav` to prevent it showing on large screens.

**What’s next**
- Finish remaining pages: home, rules, privacy, summary, admin/edit, and any legacy UI pieces.

---

## Phase 2 Milestone 7 (Completed)

**Home + rules + privacy + summary**
- Updated `app/home/page.tsx` to UI2 layout.
- Updated `app/rules/page.tsx` and `app/privacy/page.tsx` to UI2 styling.
- Migrated `app/lobby/[lobbyId]/summary/page.tsx` to UI2 layout.

**What’s next**
- Review remaining legacy UI components (admin/edit modals, on-boarding) and finish parity.

---

## Phase 2 Milestone 8 (Completed)

**Onboarding + join flow**
- Updated `app/onboard/page.tsx`, `app/onboard/[lobbyId]/page.tsx`, `app/join/[lobbyId]/page.tsx` to UI2 styling.
- Updated `components/JoinLobby.tsx` to UI2 modal styles.
- Updated root loading screen in `app/page.tsx` to UI2.

**What’s next**
- Finish admin/edit modals (OwnerSettingsModal, CreateLobby) and remaining legacy UI.

---

## Phase 2 Milestone 9 (Completed)

**Admin + create flows**
- Scoped UI2 overrides for legacy classes in `app/globals.css`.
- Updated `CreateLobby`, `OwnerSettingsModal`, and `CreateLobbyInfo` to render under `ui2-scope`.
- Ensured onboarding/join flows use UI2 styles end-to-end.

**What’s next**
- Final sweep for any remaining legacy components or pages.

---

## Phase 2 Milestone 10 (Completed)

**Loading states**
- Updated global, lobby, and lobbies loading screens to UI2 styling.

**What’s next**
- Final sweep for any remaining legacy UI (IntroGuide, modals, and edge-case pages).

---

## Phase 2 Milestone 11 (Completed)

**Intro guide modal**
- Scoped IntroGuide modal to UI2 to inherit new palette and buttons.

**What’s next**
- Final verification pass and polish for any remaining legacy-styled components.

---

## Phase 2 Milestone 12 (Completed)

**Core active lobby visuals**
- Restyled `PlayerCard`, `HeartDisplay`, `WeekSetup`, `ChallengeHero`, and `Scoreboard` to UI2 tokens.
- Mapped legacy color tokens to UI2 variables in `tailwind.config.ts` and `app/globals.css`.

**What’s next**
- Continue polishing any remaining legacy-styled components and finalize visual parity.

---

## Phase 2 Milestone 13 (Completed)

**Overlay + roulette polish**
- Updated `PeriodSummaryOverlay`, `KoOverlay`, `SeasonCompleteOverlay`, and `RouletteTransitionPanel` to UI2 styling.
- Expanded UI2 token overrides for legacy text/border/background helpers.

**What’s next**
- Continue sweeping remaining legacy components (ProfileAvatar, PushToggle, WeeklyPunishmentCard, ChallengeSettingsCard, etc.).

---

## Phase 2 Milestone 14 (Completed)

**Profile + punishments polish**
- Updated `ProfileAvatar`, `PushToggle`, `WeeklyPunishmentCard`, and `ChallengeSettingsCard` to UI2 styling.

**What’s next**
- Final sweep for any remaining legacy components and visual mismatches.

---

## Phase 2 Milestone 15 (Completed)

**Status + invite polish**
- Updated `StatusPill`, `QuipBubble`, `InvitePlayerCard`, and `CashPool` to UI2 styling.

**What’s next**
- Final sweep for any remaining legacy components and visual mismatches.

---

## Phase 2 Milestone 16 (Completed)

**Countdown + overlays polish**
- Updated `CountdownHero`, `Countdown`, `PunishmentBanner`, and `WinnerOverlay` to UI2 styling.

**What’s next**
- Final sweep for any remaining legacy components and visual mismatches.

---

## Phase 2 Milestone 17 (Completed)

**Legacy nav + buttons polish**
- Updated `Navbar`, `MobileNav`, `ToastProvider`, `AuthButtons`, and `components/ui/Button` to UI2 styling.

**What’s next**
- Final sweep for any remaining legacy components and visual mismatches.

---

## Phase 2 Milestone 18 (Completed)

**Legacy list + feed polish**
- Updated `LobbyFiltersBar` and legacy `RecentFeed` to UI2 styling.

**What’s next**
- Final sweep for any remaining legacy components and visual mismatches.

---

## Phase 2 Milestone 19 (Completed)

**New arena core components + lobby layout overhaul**
- Created 7 new arena components (direct port from arena-deathmatch):
  `HeartsStatusBoard`, `Standings`, `HostControls`, `WeeklyCycleIndicator`,
  `WorkoutFeedPost`, `FeedSystemEvent`, `DangerZone`.
- Updated `LobbyLayout.tsx` with arena 2-column layout.
- Rewrote `PlayerCard.tsx`, `HeartDisplay.tsx`, `CreateLobby.tsx` to full arena styling.
- Updated `PunishmentWheel.tsx` to arena styling.

---

## Phase 2 Milestone 20 (Completed)

**Legacy class purge + CSS cleanup**
- Removed all old UI classes from every `.tsx` file.
- Cleaned dead CSS definitions from `globals.css`.
- Added sidebar CSS variables + `--transition-athletic`.
- Removed legacy font aliases.

---

## Phase 3 — Parity Status

**Completed:** CSS vars, fonts, all components, all backend-connected pages.

**Deferred (mock-data UI shells, no backend):**
`/feed`, `/workouts`, `/records`, `/profile`, `/athletes`, `/settings`, 404.

**Post-Migration Cleanup:** Delete `components/ui/`, refactor API routes, fix `as any` casts, remove debug logs.
