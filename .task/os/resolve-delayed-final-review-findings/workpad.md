
## Test-first contract

- Add or extend a lifecycle test proving first-install onboarding rejects with a typed LifecycleError when state inspection or onboarding dependencies fail.
- Add a documentation contract proving node-plan/node-apply examples use executable single-backslash continuations.
- Rename the local-agent user-home test to the repository's should/when convention and keep clear arrange/act/assert phases.
- Confirm the focused lifecycle/docs/local-agent suite red where behavior is broken, then green before strict review and verify.

## Current status

- Red: focused suite produced the two intended failures for raw post-onboarding errors and doubled documentation continuations (51 passed, 2 failed).
- Green: the same focused suite now passes 53 tests with 189 assertions.
- Strict review against `origin/stream/os` reports zero blocking or pre-existing issues.
- Full workspace verification is publish-valid, including OS package registry selection and database guard.

- 2026-07-29 07:00:20 apply-patch: `packages/os/tests/lifecycle-engine.test.ts`
- 2026-07-29 07:00:20 apply-patch: `packages/os/tests/managed-cloud-review-regressions.test.ts`
- 2026-07-29 07:00:20 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-07-29 07:00:43 apply-patch: `packages/os/scripts/lib/lifecycle/engine.ts`
- 2026-07-29 07:00:43 apply-patch: `packages/os/SCRIPTS.md`

## workspace-owned: validation evidence

- 2026-07-29 07:01:30 `review.run`: passed — OK
- 2026-07-29 07:01:42 `verify`: passed — OK
- 2026-07-29 07:02:02 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/resolve-delayed-final-review-findings/current.json`, `.task/os/resolve-delayed-final-review-findings/session.json`, `.task/os/resolve-delayed-final-review-findings/verify.json`, `.task/os/resolve-delayed-final-review-findings/workpad.md`, `.task/tasks/os/resolve-delayed-final-review-findings.json`, `packages/os/SCRIPTS.md`, `packages/os/scripts/lib/lifecycle/engine.ts`, `packages/os/tests/lifecycle-engine.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/managed-cloud-review-regressions.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
