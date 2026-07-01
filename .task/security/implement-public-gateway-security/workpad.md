# implement public gateway security

## Goal
Implement the Consuelo OS public gateway security contract described by the StreamOS v1 spec and the existing TDD suite. Keep the Bun OS server private/local, generate security config under the final OS root, use Consuelo-specific auth/config names, fail closed, preserve audit evidence, and avoid generic `MCP_BEARER_TOKEN` fallback behavior.

## Acceptance criteria
- Read and record the public gateway spec, the prior TDD prompt, existing OS code, and `packages/os/tests/security-gateway.test.ts` before implementation.
- Do not delete, skip, weaken, or rewrite the existing security gateway tests without human approval.
- Make `bun --cwd packages/os test tests/security-gateway.test.ts` pass through implementation changes.
- Preserve audit evidence and fail closed for security-sensitive paths.
- Keep task work on `task/security/implement-public-gateway-security` from `main` and promote through `stream/security`.

## Files read
- Spec URL: `http://100.112.173.49:53935/specs/streamos-v1-spec` attempted through workspace `http`; returned 404 `not found` for exact URL, trailing slash, and `/specs` index. Used the previous TDD prompt's embedded spec-derived contract as fallback evidence.
- `/tmp/consuelo-os-public-gateway-security-tdd-prompt.md`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts` after creation for self-review.

## Test-first contract
- Behavior under test: public gateway auth/config/installation/security contract for Consuelo OS.
- Existing local pattern followed: Bun/Vitest contract tests under `packages/os/tests`, installation provisioning through `scripts/lib/install-state.ts`, server request handler exported from `scripts/server.ts`, package scripts validated by `scripts/check-syntax.js`.
- New or changed tests: none. Existing TDD suite remained unchanged.
- Focused red command: `bun --cwd packages/os test tests/security-gateway.test.ts`
- Expected red failure: missing security module, fail-open server auth, missing generated security install artifacts.
- No-test waiver: not applicable; tests already exist.

## Implementation plan
1. Add a focused `scripts/lib/security-gateway.ts` module implementing generated auth config, scoped app tokens, HMAC request signing, nonce/timestamp replay resistance, token rotation/revocation, Caddy rendering, route registry, outbound connector config, policy decisions, and audit JSONL writes.
2. Make the OS server fail closed for non-health routes when generated Consuelo auth is absent, and remove generic `MCP_BEARER_TOKEN` fallback behavior.
3. Wire `provisionLocalOs` to create `security/generated/auth.json`, `security/generated/Caddyfile`, `security/overrides`, and record Consuelo-generated auth state in final-root `config.json`.
4. Validate with the focused security suite, syntax check, and diff review.

## Key decisions
- Server auth now ignores `MCP_BEARER_TOKEN` entirely. Only Consuelo-specific auth material can open protected routes.
- `/health` remains public and intentionally avoids secret terms in the response.
- The gateway helper persists generated security state under the OS home supplied by install/provision, not a dev repo path.
- Machine request verification checks workspace mismatch before token/signature details so cross-tenant requests fail closed without leaking token material.
- Nonce replay is persisted in generated auth state and recorded only after successful signature/scope verification.
- Caddy config rendering rejects non-local upstream hosts and renders only private localhost reverse proxy targets.

## Running notes
- Task started from `main` into `stream/security` with task session `tsk_47b776f7f1c4`.
- First implementation constraint: only implementation changes unless Ko approves test changes.
- Spec URL issue: exact Tailnet URL returned 404; trailing slash and `/specs` also returned 404. This is recorded as an access/path issue, not a test change reason.
- A package syntax command was first attempted as `node ./scripts/check-syntax.js` with a `cwd` field; task.call ignored/does not support that cwd shape and looked from repo root. Retried with `node packages/os/scripts/check-syntax.js`, which passed.

## Files changed
- `packages/os/scripts/lib/security-gateway.ts` added.
- `packages/os/scripts/server.ts` updated for fail-closed Consuelo auth and legacy token fallback removal.
- `packages/os/scripts/lib/install-state.ts` updated to generate final-root security config and record security status.
- Scoped task metadata/workpad files under `.task/security/implement-public-gateway-security/`.

## Validation
- RED: `bun --cwd packages/os test tests/security-gateway.test.ts` failed as expected: 1 passed, 9 failed. Main failure signals were fail-open `/get_steering`, accepted legacy generic `MCP_BEARER_TOKEN`, missing install security artifacts, and missing `scripts/lib/security-gateway.ts`.
- GREEN: `bun --cwd packages/os test tests/security-gateway.test.ts` passed: 10 tests passed.
- Syntax: `node packages/os/scripts/check-syntax.js` passed with `workspace script syntax checks passed`.
- Diff review: `git.diff` showed intended implementation files plus scoped task metadata; no test file changes.
- Review: `review.run --base origin/main --no-tests` passed with 0 blocking issues.
- Verify: `verify --base origin/main --noDb` passed and wrote `.task/security/implement-public-gateway-security/verify.json`; note verify selected 0 suites automatically, so the explicit focused security suite above is the behavior proof.

## Issues / follow-ups
- The requested spec route was unavailable through workspace HTTP during this run. The prior TDD prompt includes the relevant spec-derived contract and the tests are treated as executable truth.
- The gateway implementation is intentionally small and boring. Future hardening can replace persisted token secrets with encrypted/OS-keychain material and add a full server-side signed-request auth path, but that is outside the current test slice.

## workspace-owned: files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`

## workspace-owned: activity log

- 2026-06-09 22:37:47 fs.write: `.task/security/implement-public-gateway-security/workpad.md`
- 2026-06-09 22:43:50 fs.write: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-09 22:43:59 fs.write: `packages/os/scripts/server.ts`
- 2026-06-09 22:44:14 fs.write: `packages/os/scripts/lib/install-state.ts`
- 2026-06-09 22:45:39 fs.write: `.task/security/implement-public-gateway-security/workpad.md`
- 2026-06-09 22:46:33 fs.write: `.task/security/implement-public-gateway-security/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-09 22:42:04 `bun --cwd packages/os test tests/security-gateway.test.ts`: failed exit 1.

## workspace-owned: TDD green evidence

- 2026-06-09 22:44:24 `bun --cwd packages/os test tests/security-gateway.test.ts`: passed exit 0 trace: `trc_2d2199442611`

- 2026-06-09 22:45:39 write: `.task/security/implement-public-gateway-security/workpad.md`

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`

## workspace-owned: validation evidence

- 2026-06-09 22:46:01 `review.run`: passed — OK
- 2026-06-09 22:46:18 `verify`: passed — OK
- 2026-06-09 22:48:22 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/implement-public-gateway-security/current.json`, `.task/security/implement-public-gateway-security/evidence-log.json`, `.task/security/implement-public-gateway-security/read-log.json`, `.task/security/implement-public-gateway-security/session.json`, `.task/security/implement-public-gateway-security/verify.json`, `.task/security/implement-public-gateway-security/workpad.md`, `.task/tasks/security/implement-public-gateway-security.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/server.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Publish notes
- task.push succeeded for commit 207742fc85ca891e07b61187c1407f5abafecee4 on task/security/implement-public-gateway-security.
- Initial task.pr attempt failed because the publish guard required a fresh meaningful agent-authored workpad update after push.
- Local worktree was behind the pushed remote commit after task.push; recovered by resetting to origin/task/security/implement-public-gateway-security, then reapplying this workpad note.
- Ready to rerun task.push/task.pr.
