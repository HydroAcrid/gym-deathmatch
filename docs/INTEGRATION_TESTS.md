# Integration Smoke Tests

Run:

```bash
npm run test:integration
```

These tests are network/API smoke checks for critical flows:

- Access state/auth on shared lobby links
- Share/join flow behavior
- Roulette start-now transition + spin phase gate

## Required env vars

- `TEST_BASE_URL` (example: `http://localhost:3000`)
- `TEST_AUTH_TOKEN` (Bearer JWT for a test member user)
- `TEST_LOBBY_ID`

## Optional env vars

- `TEST_OWNER_AUTH_TOKEN` (defaults to `TEST_AUTH_TOKEN`)
- `TEST_ROULETTE_LOBBY_ID` (defaults to `TEST_LOBBY_ID`)
- `TEST_INVITE_TOKEN` (for token-required invite tests)

If required env vars are missing, each test is auto-skipped.
