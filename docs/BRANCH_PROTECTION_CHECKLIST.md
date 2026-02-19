# Branch Protection Checklist

Configure this in GitHub repository settings (`Settings -> Branches` or `Rulesets`):

1. Protect `main`.
2. Require pull request before merging.
3. Require status checks to pass before merging:
   - `verify` (from `.github/workflows/ci.yml`)
   - `migration-smoke-shadow` (optional, if `MIGRATION_SMOKE_DATABASE_URL` is configured)
4. Require branches to be up to date before merging.
5. Require conversation resolution before merging.
6. Restrict force pushes and deletions on protected branches.
7. Optionally require signed commits and linear history.

Recommended admin hygiene:

1. Keep `MIGRATION_SMOKE_DATABASE_URL` in repository secrets.
2. Keep `main` as the only production deployment branch.
3. Require CODEOWNERS review for sensitive areas (API routes, schema, workflows).
