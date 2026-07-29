
## discovery

- Scope: resolve the exact Codex/Qodo review finding on PR #1738 without broadening the hosted dry-run behavior.
- Expected production change: restrict the missing daemon-installer bypass to the intentionally absent hosted download state.
- Test-first contract: add a local/incomplete-source regression that must fail before implementation, while preserving the external hosted dry-run success case.
- Validation plan: focused installer test, bootstrap-related suite, shell syntax/typecheck, strict review, full verify, exact-head GitHub checks/reviews, then hosted external-cwd dry run.
- RED command: `bun --cwd packages/os test tests/installer-runtime-dependencies.test.ts -t "should reject an incomplete local source when the daemon installer is missing"`.
- RED evidence: the new regression failed because the incomplete local source exited `0`; the bootstrap incorrectly reported the missing daemon installer as planned work.

## implementation

- `run_daemon_dry_run` reports planned work only for `would_download` and `would_refresh`, where hosted source is intentionally unavailable during dry-run.
- Local, reused, refreshed, or downloaded source now fails closed when `install-system-daemons.sh` is absent.
- The first green attempt proved the production failure path but exposed macOS `/var` versus `/private/var` path canonicalization in the assertion; the test was narrowed to the stable error contract and relative missing-script suffix.

## validation

- GREEN focused regression: 1 passed, 19 skipped.
- GREEN full `installer-runtime-dependencies.test.ts`: 20 passed.
- GREEN bootstrap contracts: 15 passed, 10 platform-gated skips.
- GREEN `bash -n packages/os/scripts/bootstrap.sh`.
- GREEN `bun run --cwd packages/os typecheck`: workspace script syntax checks passed.
- GREEN strict review against `origin/stream/os`: 0 owned issues and 0 blockers.
- GREEN workspace verify: publish-valid stamp, package registry gate, and database guard passed.

## final state

- Changed production file: `packages/os/scripts/bootstrap.sh`.
- Changed regression file: `packages/os/tests/installer-runtime-dependencies.test.ts`.
- Remaining work: merge task PR #1739 into `stream/os`, re-gate PR #1738 on its exact new head, merge to `main`, confirm the live installer matches `main`, and rerun the hosted external-cwd dry-run.

- 2026-07-29 15:59:03 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-07-29 15:59:26 apply-patch: `.task/os/restrict-hosted-dry-run-daemon-bypass/workpad.md`
- 2026-07-29 15:59:30 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-07-29 15:59:53 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-07-29 16:00:48 apply-patch: `.task/os/restrict-hosted-dry-run-daemon-bypass/workpad.md`

## workspace-owned: validation evidence

- 2026-07-29 16:01:10 `review.run`: passed — OK
- 2026-07-29 16:01:20 `verify`: passed — OK
- 2026-07-29 16:01:36 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/restrict-hosted-dry-run-daemon-bypass/current.json`, `.task/os/restrict-hosted-dry-run-daemon-bypass/session.json`, `.task/os/restrict-hosted-dry-run-daemon-bypass/verify.json`, `.task/os/restrict-hosted-dry-run-daemon-bypass/workpad.md`, `.task/tasks/os/restrict-hosted-dry-run-daemon-bypass.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
