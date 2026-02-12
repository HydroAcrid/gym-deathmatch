# Architecture

## Goals
1. Reliability-first modular monolith.
2. Add new features/modes without touching unrelated layers.
3. Keep external API contracts stable while improving internals.

## Layers
1. `app/api`
   - Thin HTTP controllers only.
   - Parse request, authorize, call domain services, map domain errors to HTTP.
2. `domains/*`
   - Business rules and workflows.
   - Can depend on `platform/*` and shared pure utilities.
   - Must not depend on app/UI layers.
3. `platform/*`
   - Technical infrastructure adapters (DB, cache, auth, observability).
   - Must not depend on domain or app/UI layers.
4. `src/ui2/*` and `components/*`
   - Presentation only.
   - Consume typed view models/adapters.

## Dependency Rules
1. `app/api` must not import `components/*` or `src/ui2/*`.
2. `domains/*` must not import `app/*`, `components/*`, or `src/*`.
3. `platform/*` must not import `app/*`, `domains/*`, `components/*`, or `src/*`.
4. Cross-domain interactions should happen via explicit contracts/events.

## Current Domain Modules
1. `domains/lobby`
   - Live snapshot service boundary.
2. `domains/commentary`
   - Commentary jobs and queue processor service boundary.
3. `domains/activity` (scaffold)
   - Activity and vote service interfaces.

## Platform Modules
1. `platform/db`
   - Repository layer scaffolding:
     - `LobbyRepo`
     - `PlayerRepo`
   - `requireDbClient()` for centralized DB client acquisition.

## Route Contract Guidelines
1. Routes stay backward-compatible in path and payload shape.
2. New internal metadata fields should be additive only.
3. Authorization must run before domain calls.
4. Side effects should be explicit and idempotent where possible.

## Quality Gates
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:unit`
4. `npm run test:migration-smoke`
5. `npm run test:integration`
6. `npm run build`

## Security and Invariants
1. DB-level invariants and RLS/service-role assumptions are documented in `docs/DB_SECURITY.md`.
2. Critical queue/spin/owner integrity rules must be enforced in schema, not only app code.

## UI Composition
1. UI layering and ownership/deprecation map are documented in `docs/UI_OWNERSHIP.md`.
2. Target pattern is `page -> adapter -> ui2 components`.

## Near-Term Refactor Priorities
1. Decompose `lib/liveSnapshot.ts` into smaller domain services.
2. Move vote resolution logic out of route handlers into domain services.
3. Expand repository usage to remove direct DB calls from routes over time.
