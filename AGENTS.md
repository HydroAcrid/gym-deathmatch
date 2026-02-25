# Agents

## Cursor Cloud specific instructions

This is a **Next.js 16** single-app project (not a monorepo) using **npm** as its package manager. The `.npmrc` sets `legacy-peer-deps=true`.

### Quick reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000, Turbopack) |
| Lint | `npm run lint` |
| Type check | `npx tsc --noEmit --incremental false` |
| Unit tests | `npm run test:unit` |
| Integration tests | `npm run test:integration` |
| All checks | `npm run test:all` (lint, typecheck, unit, migration-smoke, integration, build) |
| Build | `npm run build` |

### Environment variables

The app uses **Supabase** for auth/database. Without real Supabase credentials the app still starts and renders the unauthenticated landing page. Supabase client modules (`lib/supabaseBrowser.ts`, `lib/supabaseClient.ts`) return `null` when env vars are missing, so no crash occurs.

A minimal `.env.local` for local dev without Supabase needs two variables: `NEXT_PUBLIC_BASE_URL` (set to the dev server origin) and `ADMIN_SECRET` (any random string).

### Caveats

- The `typecheck` script in `package.json` runs `next typegen && tsc`; running `npx tsc --noEmit --incremental false` directly also works.
- Unit tests use Node's built-in test runner (`node --test`), not Jest or Vitest.
- One unit test (`migration-smoke.test.mjs`) is skipped unless `MIGRATION_SMOKE_SUPABASE_URL` and `MIGRATION_SMOKE_SERVICE_ROLE_KEY` env vars are set.
- Integration tests mock Supabase calls internally and do not require a live database.
