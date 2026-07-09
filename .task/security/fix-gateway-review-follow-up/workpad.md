# fix gateway review follow up

## Goal
Fix the latest review comment on stream PR #896 for the public gateway security work.

## Acceptance criteria
- Extract and record the new review comment.
- Verify the finding against current stream code before editing.
- Read relevant implementation and tests.
- Add or update focused tests for behavior changes.
- Publish back into stream/security.

## Test-first contract
- Behavior under test: pending review extraction.
- Existing local pattern to follow: security gateway tests and current server/gateway implementation.
- New or changed tests: pending.
- Focused red command: pending.
- Expected red failure: pending.
- No-test waiver: pending.

## Running notes
- Task started from stream/security.
- Task session: tsk_8266a20db7ac.

- 2026-06-10 00:36:03 write: `.task/security/fix-gateway-review-follow-up/workpad.md`

## files changed

- `packages/os/scripts/server.ts`

## workspace-owned: files changed

- `packages/os/scripts/server.ts`

## workspace-owned: activity log

- 2026-06-10 00:36:03 fs.write: `.task/security/fix-gateway-review-follow-up/workpad.md`
- 2026-06-10 00:42:48 fs.write: `packages/os/scripts/server.ts`

## workspace-owned: files read

- `packages/os/scripts/server.js`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/security-gateway.test.ts`

## Review comment extracted
- High/runtime wiring: generated auth is not discoverable through normal OS server startup. `server.ts` only reads explicit `CONSUELO_OS_AUTH_CONFIG`, while daemon/server wrappers set home and port but do not export the generated auth path. After provisioning writes `security/generated/auth.json`, a normal server start with only `CONSUELO_HOME` still fails protected routes with `CONSUELO_AUTH_REQUIRED`.
- Related validation issue: `tests/os-raw-steering.test.ts` still expects a hidden legacy route to be `404`; the new fail-closed posture returns `401` before route lookup when auth is absent.

## Test-first contract
- Behavior under test: server resolves generated auth from `CONSUELO_OS_AUTH_CONFIG` first, then from the installed OS home at `security/generated/auth.json` when present; normal installed-home startup with only `CONSUELO_HOME` can authorize a signed `/call`; unknown protected routes fail closed with `401` when generated auth is missing.
- Existing local pattern to follow: security gateway tests use disposable homes and `bun -e` subprocesses; raw steering test spawns `scripts/server.ts` and probes health plus route status.
- New or changed tests: add a security-gateway regression for default installed-home auth discovery and update raw-steering legacy route expectation to intentional `401` before route lookup.
- Focused red command: `bun --cwd packages/os test tests/security-gateway.test.ts tests/os-raw-steering.test.ts`
- Expected red failure: signed `/call` with only `CONSUELO_HOME` fails until default auth path discovery is implemented; raw-steering currently fails because it expects 404 instead of 401.
- No-test waiver: not applicable.

- 2026-06-10 00:42:48 write: `packages/os/scripts/server.ts`

## workspace-owned: validation evidence

- 2026-06-10 00:44:39 `review.run`: passed — OK
- 2026-06-10 00:45:25 `verify`: passed — OK
- 2026-06-10 00:45:43 `review.run`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-gateway-review-follow-up/current.json`, `.task/security/fix-gateway-review-follow-up/evidence-log.json`, `.task/security/fix-gateway-review-follow-up/read-log.json`, `.task/security/fix-gateway-review-follow-up/session.json`, `.task/security/fix-gateway-review-follow-up/workpad.md`, `.task/tasks/security/fix-gateway-review-follow-up.json`, `packages/os/scripts/server.ts`, `packages/os/tests/os-raw-steering.test.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## current status

The latest PR #896 runtime-wiring review blocker is fixed. `server.ts` now resolves generated auth from `CONSUELO_OS_AUTH_CONFIG` first and then from the installed OS home at `CONSUELO_OS_HOME/security/generated/auth.json` or `CONSUELO_HOME/security/generated/auth.json` when present. This keeps auth discovery in the server as a single source of truth for direct, daemon, and wrapper starts.

Tests updated:
- `security-gateway.test.ts` now provisions an OS home, unsets explicit auth config, signs a scoped `/call`, imports the server with only the installed home set, and expects protected `/call` to succeed without leaking token secret or nonce.
- `os-raw-steering.test.ts` now uses an isolated empty OS home and expects unknown protected routes to fail closed with `401` before route lookup.

Validation completed:
- RED: `cd packages/os && bun test tests/security-gateway.test.ts` failed on the new installed-home auth discovery test with `CONSUELO_AUTH_REQUIRED` before implementation.
- GREEN: `cd packages/os && bun test tests/security-gateway.test.ts` passed with 15/15 tests.
- GREEN: `cd packages/os && bun test tests/os-raw-steering.test.ts` passed with 2/2 tests.
- Syntax: `node packages/os/scripts/check-syntax.js` passed.
- Review: `review.run --base origin/stream/security --no-tests` passed with 0 blocking issues.
- Verify: `verify --base origin/stream/security --noDb` passed.
- Review: `review.run --base origin/main --no-tests` passed with 0 blocking issues.

Notes:
- The combined two-suite command was blocked by the wrapper once; the same suites were run separately and both passed.
