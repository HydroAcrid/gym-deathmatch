# UI Ownership and Composition

## Goal
Make new pages/features predictable to build:
1. Route/page fetches data.
2. Adapter shapes data into view-model.
3. UI2 components render view-model.

## Standard implementation path
1. `app/.../page.tsx`
   - Handles auth/session and API calls.
   - Minimal data shaping.
2. `src/ui2/adapters/*`
   - Pure mapping/aggregation/format helpers.
   - No React side effects.
3. `src/ui2/components/*`
   - Presentation primitives.
   - Domain-agnostic where possible.

## Current ownership
1. Canonical shared UI primitives: `src/ui2/components/*` and `src/ui2/ui/*`.
2. Domain orchestrators (still legacy): `components/*` (for example `LobbyLayout`, `LobbySwitcher`, `PreStageView`).
3. Long-term direction: move orchestration into domain-specific containers and keep UI2 as render layer.

## Deprecation map
1. `components/LobbyFiltersBar.tsx` -> deprecated in favor of `src/ui2/components/LobbyFiltersBar.tsx`.
2. New pages should not import deprecated components directly; use UI2 equivalents.

## Applied example
1. Profile page now uses `src/ui2/adapters/profile.ts` for:
   - stats aggregation
   - season merge/group logic
   - formatting helpers
2. This keeps `app/profile/page.tsx` focused on data flow + rendering.
