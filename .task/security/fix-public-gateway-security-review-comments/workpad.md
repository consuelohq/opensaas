# fix public gateway security review comments

## Goal
Fix the review comments on stream PR #896 for the Consuelo OS public gateway security work, without broadening scope or weakening the security contract.

## Acceptance criteria
- Inspect the specific Graphite review comments for PR #896.
- Read the relevant implementation and tests before editing.
- Preserve the existing security TDD contract; do not weaken tests.
- Add focused regression tests for each behavior gap called out in review.
- Run focused validation and publish the task back into `stream/security`.

## Review comments extracted
- High/Auth: `server.ts` gates on `CONSUELO_OS_AUTH_CONFIG`, but protected routes still only accept a static `CONSUELO_OS_BEARER_TOKEN`; `/get_steering` and `/call` never call `verifyMachineRequest`.
- High/Security: `verifyMachineRequest()` issues `expiresAt` on tokens but never rejects expired tokens.
- High/Data Integrity: repeated `provisionLocalOs()` rewrites `security/generated/auth.json`, losing signing key, tokens, revocation/rotation state, and nonce replay history.
- Follow-up: generated Caddy config hardcodes upstream `127.0.0.1:8850` even when `provisionLocalOs({ port })` uses another port.

## Test-first contract
- Behavior under test: server protected routes authorize through generated Consuelo auth + signed scoped app tokens; token expiry fails safely without consuming nonce; provisioning preserves generated auth state across re-runs; generated Caddy upstream uses resolved OS port.
- Existing local pattern to follow: `packages/os/tests/security-gateway.test.ts` uses disposable `CONSUELO_OS_HOME`, `bun -e` subprocesses for server/install behavior, and direct gateway helper contract assertions.
- New or changed tests: extend `packages/os/tests/security-gateway.test.ts` with regression tests for server signed `/call`, expired token rejection/non-consumed nonce, idempotent generated auth provisioning, and custom Caddy port.
- Focused red command: `bun --cwd packages/os test tests/security-gateway.test.ts`
- Expected red failure: new tests fail on missing signed route integration, missing `TOKEN_EXPIRED`, non-idempotent auth generation, and hardcoded Caddy port.
- No-test waiver: not applicable.

## Files read
- Graphite review URL for PR #896 via browser; Graphite auth page was not logged in, so review text was extracted through GitHub API for PR #896 review `PRR_kwDORPzu_c8AAAABCgi8bw`.
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/os.ts`

## Running notes
- Task started from `stream/security` because this is a direct follow-up to unshipped stream PR #896.
- Task session: `tsk_83197a3492b0`.
- All four review findings are valid against current code.

- 2026-06-10 00:07:33 write: `.task/security/fix-public-gateway-security-review-comments/workpad.md`

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: activity log

- 2026-06-10 00:07:33 fs.write: `.task/security/fix-public-gateway-security-review-comments/workpad.md`
- 2026-06-10 00:08:45 fs.patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-10 00:10:35 fs.write: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-10 00:10:51 fs.write: `packages/os/scripts/lib/install-state.ts`
- 2026-06-10 00:11:19 fs.write: `packages/os/scripts/server.ts`
- 2026-06-10 00:12:14 fs.write: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-10 00:12:15 fs.write: `packages/os/tests/security-gateway.test.ts`

## workspace-owned: files read

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-10 00:09:03 `bun --cwd packages/os test tests/security-gateway.test.ts`: failed exit 1 trace: `trc_404c94b6c1d3`
  - output: 9m [90m901| [39m const caddyfile = readFileSync(join(tempHome, 'security', 'generat… [90m902| [39m [34mexpect[39m(caddyfile)[33m.[39m[34mtoContain[39m([32m'reverse_proxy 127.0.0.1:8999'[39m)[33m;[39m [90m | [39m [31m^[39m [90m903| [39m [34mexpect[39m(caddyfile)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'reverse_proxy 127.0.0.1:8850'[39m)[33m;[39m [90m904| [39m })[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-10 00:10:35 write: `packages/os/scripts/lib/security-gateway.ts`

- 2026-06-10 00:10:51 write: `packages/os/scripts/lib/install-state.ts`

- 2026-06-10 00:11:19 write: `packages/os/scripts/server.ts`

## workspace-owned: TDD green evidence

- 2026-06-10 00:11:57 `bun --cwd packages/os test tests/security-gateway.test.ts`: failed exit 1 trace: `trc_2c3d9f52adb3`
  - output: 39m requiredScope[33m:[39m [32m'route:/api:read'[39m[33m,[39m [90m870| [39m now[33m:[39m [32m'2026-06-09T20:00:04.000Z'[39m[33m,[39m [90m871| [39m })).resolves.toMatchObject({ ok: false, status: 401, error: { code… [90m | [39m [31m^[39m [90m872| [39m [35mawait[39m [34mexpect[39m(gateway[33m.[39m[34mverifyMachineRequest[39m({ [90m873| [39m config[33m:[39m reprovisioned[33m,[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-10 00:12:14 write: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-10 00:12:15 write: `packages/os/tests/security-gateway.test.ts`
- 2026-06-10 00:12:32 `bun --cwd packages/os test tests/security-gateway.test.ts`: passed exit 0 trace: `trc_d135a843aeb2`
  - output: → tmux: opensaas-security-fix-public-gateway-security-review-comments-83197a34 $ vitest run tests/security-gateway.test.ts

## workspace-owned: validation evidence

- 2026-06-10 00:13:46 `review.run`: passed — OK
- 2026-06-10 00:14:01 `verify`: passed — OK
- 2026-06-10 00:14:15 `review.run`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-public-gateway-security-review-comments/current.json`, `.task/security/fix-public-gateway-security-review-comments/evidence-log.json`, `.task/security/fix-public-gateway-security-review-comments/read-log.json`, `.task/security/fix-public-gateway-security-review-comments/session.json`, `.task/security/fix-public-gateway-security-review-comments/workpad.md`, `.task/tasks/security/fix-public-gateway-security-review-comments.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## current status

All review findings from PR #896 have been addressed in this follow-up task. Server auth now uses generated Consuelo auth plus signed scoped app-token verification for protected `/get_steering` and `/call` routes instead of static bearer bypass. `verifyMachineRequest()` rejects expired tokens before nonce consumption. Generated auth provisioning is idempotent for the same workspace and preserves signing key, token statuses, and seen nonces. Caddy config now uses the resolved OS port.

Validation completed:
- `bun --cwd packages/os test tests/security-gateway.test.ts` passed with 14/14 tests.
- `node packages/os/scripts/check-syntax.js` passed.
- `review.run --base origin/stream/security --no-tests` passed with 0 blocking issues.
- `verify --base origin/stream/security --noDb` passed.
- `review.run --base origin/main --no-tests` passed with 0 blocking issues for the stream PR context.
