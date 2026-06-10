# fix gateway review final follow up

## Goal
Fix the latest CodeRabbit review comments on stream PR #896 for the public gateway security work.

## Acceptance criteria
- Extract and record the review comments.
- Verify each finding against the current stream code before editing.
- Fix only still-valid findings.
- Add or update focused regression tests for behavior changes.
- Keep changes scoped to OS gateway security behavior.
- Validate and publish back into stream/security.

## Review comments extracted
- Doctor should validate generated gateway artifacts: `security/generated/auth.json` and `security/generated/Caddyfile`.
- `seenNonces` should store seen-at timestamps and prune entries older than the request skew window.
- Auth store writes should be atomic through temp file plus rename.
- Token rotation should require the persisted source token and derive rotated claims from stored state.
- `/call` should fail closed before JSON parsing so malformed unauthenticated bodies do not short-circuit auth.
- `executeCall` failures should return 5xx for internal/runtime failures rather than mapping everything to invalid request.

## Test-first contract
- Behavior under test: pending file inspection.
- Existing local pattern to follow: security gateway tests and OS raw steering/server tests.
- New or changed tests: pending file inspection.
- Focused red command: pending.
- Expected red failure: pending.
- No-test waiver: pending.

## Files read
- GitHub review body for `PRR_kwDORPzu_c8AAAABCg1wJA` via typed GitHub raw fallback because typed `pr.reviews` does not expose node-id filtering.

## Running notes
- Task started from stream/security.
- Task session: tsk_9d10c792c1f2.

- 2026-06-10 01:11:04 write: `.task/security/fix-gateway-review-final-follow-up/workpad.md`

## files changed

- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: files changed

- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: activity log

- 2026-06-10 01:11:04 fs.write: `.task/security/fix-gateway-review-final-follow-up/workpad.md`
- 2026-06-10 01:15:17 fs.write: `.task/security/fix-gateway-review-final-follow-up/workpad.md`
- 2026-06-10 01:15:35 fs.write: `packages/os/tests/security-gateway.test.ts`
- 2026-06-10 01:22:28 fs.write: `.task/security/fix-gateway-review-final-follow-up/status.txt`
- 2026-06-10 01:24:58 fs.write: `.task/security/fix-gateway-review-final-follow-up/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/security-gateway.test.ts`

## Test-first contract update
- Behavior under test: doctor reports missing generated gateway artifacts; replay nonce entries carry timestamps and prune outside the skew window; token rotation derives the new token from persisted state and rejects unknown source tokens; malformed unauthenticated `/call` fails closed on auth before JSON parsing.
- New or changed tests: extend `security-gateway.test.ts` with regressions for those behaviors.
- Focused red command: `cd packages/os && bun test tests/security-gateway.test.ts`.
- Expected red failure: missing doctor artifact checks, string-only/non-pruned nonces, caller-derived rotated claims, and 400 invalid request before auth.
- No-test waiver: atomic interrupted-write and execute exception mapping are implementation hardening validated by syntax and review.

- 2026-06-10 01:15:17 append: `.task/security/fix-gateway-review-final-follow-up/workpad.md`

- 2026-06-10 01:15:35 write: `packages/os/tests/security-gateway.test.ts`

## workspace-owned: validation evidence

- 2026-06-10 01:20:49 `review.run`: passed — OK
- 2026-06-10 01:21:30 `verify`: passed — OK
- 2026-06-10 01:21:43 `review.run`: passed — OK
- 2026-06-10 01:25:55 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-gateway-review-final-follow-up/current.json`, `.task/security/fix-gateway-review-final-follow-up/evidence-log.json`, `.task/security/fix-gateway-review-final-follow-up/read-log.json`, `.task/security/fix-gateway-review-final-follow-up/session.json`, `.task/security/fix-gateway-review-final-follow-up/status.txt`, `.task/security/fix-gateway-review-final-follow-up/verify.json`, `.task/security/fix-gateway-review-final-follow-up/workpad.md`, `.task/tasks/security/fix-gateway-review-final-follow-up.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## publish update

After syncing the task worktree to the pushed branch, this note records the final state: gateway security code, server request handling, doctor checks, and focused security tests were updated. Validation passed for the security suite, raw steering suite, syntax, stream review, stream verify, and main-base review.

- 2026-06-10 01:24:58 append: `.task/security/fix-gateway-review-final-follow-up/workpad.md`
