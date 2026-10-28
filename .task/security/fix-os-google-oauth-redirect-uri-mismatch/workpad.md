# fix OS Google OAuth redirect URI mismatch

branch: `task/security/fix-os-google-oauth-redirect-uri-mismatch`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1303/fix-os-google-oauth-redirect-uri-mismatch
github pr: https://github.com/consuelohq/opensaas/pull/1303
started: 2026-06-30

## acceptance criteria

- [x] The ChatGPT MCP OAuth approval path sends Google the existing OS device-authority callback URI (`/login/google/callback`) instead of the unallowlisted MCP-specific callback URI (`/oauth/google/callback`).
- [x] Existing device-code Google login still uses its current callback route and remains covered by tests.
- [x] OAuth metadata, callback routes, and redirect handling do not expose secrets or loosen ChatGPT redirect URI validation.
- [x] Focused tests fail before the production fix and pass after it.
- [x] Prepare the task for promotion to `stream/security`; stream-to-main merge, local main sync, and Cloudflare release are follow-on lifecycle steps after `task.pr`.

## plan

1. Reproduce the redirect URI contract in the existing OS device-authority OAuth tests.
2. Read the Google approval URL construction and callback handling in `packages/os/cloudflare/os-device-authority/src/index.ts`.
3. Write the focused red test for the ChatGPT MCP OAuth Google redirect URI.
4. Implement the smallest origin/callback fix without weakening client or redirect URI validation.
5. Rerun focused OAuth tests, typecheck/review/verify against `origin/stream/security`, then push and promote.
6. Merge the security stream PR to `main`, sync local main, verify Cloudflare auth, and run `bun run os:release`.

## current status

- Task started from synced `stream/security` with task session `tsk_8f70494b6afe`.
- Required `CODING-STANDARDS.md`, `AGENTS.md`, and OS task/senior-engineer skills were read before code edits.
- Investigating Google `Error 400: redirect_uri_mismatch` shown during ChatGPT MCP OAuth approval.
- Focused red test is written and failing on the intended Google callback URI mismatch.
- Implementation complete; focused green tests, full device-authority worker suite, typecheck, review, and verify have passed.

## Test-first contract

- Behavior under test: when `/oauth/authorize` starts the ChatGPT MCP OAuth approval flow, the Google authorization URL must use the existing OS device-authority callback (`https://os.consuelohq.com/login/google/callback` in production/deployed metadata) so the deployed Google OAuth client recognizes the redirect URI.
- Existing local pattern to follow: `packages/os/tests/os-device-authority-worker.test.ts` already asserts Google authorization URL construction and callback/token exchange for device-code and MCP OAuth flows.
- New or changed tests: update the ChatGPT MCP OAuth test to assert the Google `redirect_uri` points to the configured Google callback origin and preserve the existing device-code callback assertion.
- Focused red command: `bun run test -- tests/os-device-authority-worker.test.ts -t 'ChatGPT CIMD clients|redirect authorized device users to Google OAuth'` from `packages/os`.
- Expected red failure: current ChatGPT MCP OAuth flow sends `redirect_uri=https://<handler-origin>/oauth/google/callback` and only completes MCP OAuth on `/oauth/google/callback`, which can trigger Google's `redirect_uri_mismatch` because the device-flow callback is the allowlisted route.
- Red result: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/os-device-authority-worker.test.ts -t 'ChatGPT CIMD clients|issue and introspect OAuth access tokens|approve a pending OS device when Google OAuth callback succeeds'` failed as expected. Both MCP OAuth tests received `https://os.consuelohq.com/oauth/google/callback` instead of `https://os.consuelohq.com/login/google/callback`; the existing device-code Google callback test passed.
- No-test waiver: not applicable; this is an auth/provider callback behavior fix.

## files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `.task/security/fix-os-google-oauth-redirect-uri-mismatch/*`
- `.task/tasks/security/fix-os-google-oauth-redirect-uri-mismatch.json`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-30 focused red: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/os-device-authority-worker.test.ts -t 'ChatGPT CIMD clients|issue and introspect OAuth access tokens|approve a pending OS device when Google OAuth callback succeeds'` — failed as expected, MCP Google redirect URI was `/oauth/google/callback` instead of `/login/google/callback`.
- 2026-06-30 focused green: same command — passed, 3 tests.
- 2026-06-30 full worker suite: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/os-device-authority-worker.test.ts` — passed, 11 tests.
- 2026-06-30 `bun run typecheck` from `packages/os` — passed, workspace script syntax checks passed.
- 2026-06-30 23:41:30 `review.run`: passed — OK
- 2026-06-30 23:41:47 `verify`: passed — OK
- 2026-06-30 23:44:07 `verify`: passed — OK

## key decisions

- Reused the existing device-authority Google callback route for MCP OAuth instead of adding another Google Console redirect URI dependency.
- Left `/oauth/google/callback` in place as a compatibility handler, but new MCP authorization starts send Google `redirect_uri=https://os.consuelohq.com/login/google/callback`.
- The shared `/login/google/callback` route now dispatches known MCP OAuth states to the MCP callback finisher; normal device-code OAuth states still use the existing HTML device approval path.
- ChatGPT client/redirect URI validation was not loosened; only the intermediate Google approval callback route changed.

## notes for ko

- This targets the screenshot's Google `Error 400: redirect_uri_mismatch` by using the callback route already exercised by the working OS device-code approval flow.

## improvements noticed

- none yet

## issues and recovery

- `verify` did not auto-select tests for these files, so the focused/full `os-device-authority-worker` Vitest runs are the behavior proof.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/index.ts`

## workspace-owned: test selection

- changed files: `.task/security/fix-os-google-oauth-redirect-uri-mismatch/current.json`, `.task/security/fix-os-google-oauth-redirect-uri-mismatch/evidence-log.json`, `.task/security/fix-os-google-oauth-redirect-uri-mismatch/read-log.json`, `.task/security/fix-os-google-oauth-redirect-uri-mismatch/session.json`, `.task/security/fix-os-google-oauth-redirect-uri-mismatch/verify.json`, `.task/security/fix-os-google-oauth-redirect-uri-mismatch/workpad.md`, `.task/tasks/security/fix-os-google-oauth-redirect-uri-mismatch.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
