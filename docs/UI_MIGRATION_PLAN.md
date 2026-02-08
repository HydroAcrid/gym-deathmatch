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
