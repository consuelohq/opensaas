# restrict hosted dry run daemon bypass

branch: `task/os/restrict-hosted-dry-run-daemon-bypass`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1739
started: 2026-07-29

## acceptance criteria

- [x] Hosted external-cwd dry-runs may plan daemon installation when source is intentionally absent.
- [x] Local or otherwise available source fails closed when `install-system-daemons.sh` is missing.
- [x] The hosted clean-machine regression remains green and a new incomplete-local-source regression proves the review finding.
- [x] Focused tests, shell syntax, OS typecheck, strict review, and full verification pass.
- [ ] The task reaches `stream/os`, PR #1738 reaches `main`, and the live hosted external-cwd dry-run passes.

## plan

1. Reproduce the review finding with an incomplete local source fixture.
2. Restrict the bypass to hosted `would_download` and `would_refresh` states.
3. Run focused and broader installer validation plus publish gates.
4. Promote through the task and stream PRs, then validate the live hosted installer.

## current status

- Implementation is complete and publish-valid on task commit `ce3e2f558bbf`; promotion is the remaining work.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

## key decisions

- Key the bypass to source lifecycle state rather than file existence alone. A missing script is expected only while a hosted download or refresh is deliberately not executed during dry-run.

## notes for ko

- No installed runtime or machine service has been changed.

## improvements noticed

- The workspace registry's generated package-test command uses a Bun argument order that exits successfully after printing help; manual focused tests remain the behavioral evidence for this task.

## issues and recovery

- The first `task.pr` call correctly blocked because the workpad lacked the conventional task sections. The workpad was expanded before retrying publication.
- After the first API-backed push, the task worktree branch ref remained one commit behind its remote. No task-worktree sync mutation exists, and the advertised `task.call` wrapper is currently broken because its `task:exec` script is missing. I advanced the exact branch ref from `b033ff4b` to verified remote commit `ce3e2f55` with `git update-ref`, then refreshed only the index with `git read-tree HEAD`; working files were preserved and only the intended workpad/verify updates remained.

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
- 2026-07-29 16:02:21 `verify`: passed — OK
- 2026-07-29 16:03:53 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/restrict-hosted-dry-run-daemon-bypass/current.json`, `.task/os/restrict-hosted-dry-run-daemon-bypass/session.json`, `.task/os/restrict-hosted-dry-run-daemon-bypass/verify.json`, `.task/os/restrict-hosted-dry-run-daemon-bypass/workpad.md`, `.task/tasks/os/restrict-hosted-dry-run-daemon-bypass.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
