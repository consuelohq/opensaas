# guard stream publish pruning

branch: `task/os/guard-stream-publish-pruning`
stream: `stream/os`
taskSession: `tsk_be464196077b`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1043/guard-stream-publish-pruning
github pr: https://github.com/consuelohq/opensaas/pull/1043
started: 2026-06-14

## objective

Fix the workspace and OS task/stream publish loop so stale stream branches and messy local worktrees do not leak unrelated files into GitHub PRs. The OS copy must be install-safe for external users, not hard-coded to Ko's local machine.

## acceptance criteria

- [x] Shared publish-scope logic classifies allowed task/stream paths, task metadata, shared paths, and out-of-area paths.
- [x] `packages/workspace` task push soft-prunes out-of-area files from the GitHub tree update and reports what was pruned.
- [x] `packages/os` task push has the same behavior with no local-machine assumptions.
- [x] `packages/workspace` stream sync can resolve out-of-area conflicts to `origin/main`, keep in-area stream changes, and report pruning.
- [x] `packages/os` stream sync has the same behavior with no local-machine assumptions.
- [x] `task.start --start-from=stream` attempts a safe stream sync before branching from the stream and stops only for in-scope/ambiguous conflicts.
- [x] `task.pr` checks/syncs the stream before final stream PR publication so stale-main files do not reappear.
- [x] Focused tests cover classifier, task-push pruning plan, and stream-sync conflict classification for both workspace and OS copies.

## test-first contract

Behavior under test:

- A diff-cockpit publish plan keeps `packages/diff-cockpit/**` and scoped `.task/diff-cockpit/**` metadata but prunes `packages/os/**` and `.task/os/**`.
- Shared workspace/os scripts can opt in to shared paths through a small explicit allowlist; unlisted top-level buckets are not inferred as shared.
- Stream sync classifies out-of-area conflicts as prunable to main and in-area conflicts as manual.
- Task push `--changed` uses the filtered publish plan, preserving the local worktree while only committing scoped files to GitHub.

Existing local pattern:

- Workspace tests use Vitest under `packages/workspace/tests` and direct module/subprocess assertions.
- OS tests use Vitest under `packages/os/tests` and should not rely on Ko-local paths.

Focused red commands:

- `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`

Expected red failure before implementation:

- Tests fail because no publish-scope helper exists and task-push/stream-sync do not expose filtered publish plans.

## plan

1. Add shared publish-scope helper to both `packages/workspace/scripts/lib` and `packages/os/scripts/lib`.
2. Add focused tests in both package test trees.
3. Wire helper into task-push so `--changed` soft-prunes out-of-area files before GitHub tree creation.
4. Wire helper into stream-sync so out-of-area conflicts resolve to `origin/main` and in-area conflicts remain manual.
5. Wire task-start and task-pr to run safe stream sync before branching/publishing.
6. Run focused tests, static checks, review, verify, push, and PR.

## validation evidence

- Red: `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts` failed because `scripts/lib/publish-scope.js` did not exist.
- Green: `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts` passed: 2 files, 8 tests.
- Static: `node --check` passed for workspace and OS publish-scope helpers, task-push, stream-sync, task-start, task-pr, and the new tests.
- Review: `review.run --base origin/main --noTests` passed with 0 issues in current changes; one pre-existing OS task-start error-handling finding remained.
- Verify: `verify --base origin/main` passed and wrote publish-valid `.task/os/guard-stream-publish-pruning/verify.json`. Registry-selected workspace verification/task-session suites also passed.

## files changed

- `packages/os/tests/publish-scope.test.ts`
- `packages/workspace/tests/publish-scope.test.ts`

## workspace-owned: files changed

- `packages/os/tests/publish-scope.test.ts`
- `packages/workspace/tests/publish-scope.test.ts`

## workspace-owned: activity log

- 2026-06-14 21:52:24 fs.write: `.task/os/guard-stream-publish-pruning/workpad.md`
- 2026-06-14 21:53:29 fs.write: `packages/workspace/tests/publish-scope.test.ts`
- 2026-06-14 21:53:44 fs.write: `packages/os/tests/publish-scope.test.ts`
- 2026-06-14 21:55:49 fs.write: `.task/os/guard-stream-publish-pruning/implement_publish_prune.py`

## workspace-owned: files read

- `packages/os/scripts/stream-sync.js`
- `packages/os/scripts/task-pr.js`
- `packages/os/scripts/task-push.js`
- `packages/os/scripts/task-start.js`
- `packages/workspace/scripts/lib/publish-scope.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-session.test.js`

## workspace-owned: TDD red evidence

- 2026-06-14 21:54:04 `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`: failed exit 1 trace: `trc_e53f86d914d7`
  - output: 2m[39m [90m 1| [39m[35mimport[39m { expect[33m,[39m test } [35mfrom[39m [32m'vitest'[39m[33m;[39m [90m 2| [39m [90m 3| [39m[35mimport[39m publishScope [35mfrom[39m [32m'../scripts/lib/publish-scope.js'[39m[33m;[39m [90m | [39m[31m^[39m [90m 4| [39m[35mimport[39m taskPush [35mfrom[39m [32m'../scripts/task-push.js'[39m[33m;[39m [90m 5| [39m[35mimport[39m streamSync [35mfrom[39m [32m'../scripts/stream-sync.js'[39m[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "task:exec" exited with code 1

- 2026-06-14 21:55:49 write: `.task/os/guard-stream-publish-pruning/implement_publish_prune.py`

## workspace-owned: TDD green evidence

- 2026-06-14 21:56:04 `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`: passed exit 0 trace: `trc_aa224a4b2902`
  - output: → tmux: opensaas-os-guard-stream-publish-pruning-be464196
- 2026-06-14 21:56:38 `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`: passed exit 0 trace: `trc_c3b0b2fbd96e`
  - output: → tmux: opensaas-os-guard-stream-publish-pruning-be464196
- 2026-06-14 21:57:54 `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`: passed exit 0 trace: `trc_b36f8e2e6f6c`
  - output: → tmux: opensaas-os-guard-stream-publish-pruning-be464196
- 2026-06-14 21:58:46 `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`: passed exit 0 trace: `trc_5d50ac1b55c6`
  - output: → tmux: opensaas-os-guard-stream-publish-pruning-be464196
- 2026-06-14 22:00:42 `bun x vitest run packages/workspace/tests/publish-scope.test.ts packages/os/tests/publish-scope.test.ts`: passed exit 0 trace: `trc_6dd4f4dd9b8b`
  - output: → tmux: opensaas-os-guard-stream-publish-pruning-be464196

## workspace-owned: validation evidence

- pending
- 2026-06-14 21:57:01 `checkFiles`: passed — OK
- 2026-06-14 21:58:11 `checkFiles`: passed — OK
- 2026-06-14 22:01:19 `review.run`: passed — OK
- 2026-06-14 22:01:37 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/guard-stream-publish-pruning/current.json`, `.task/os/guard-stream-publish-pruning/evidence-log.json`, `.task/os/guard-stream-publish-pruning/read-log.json`, `.task/os/guard-stream-publish-pruning/session.json`, `.task/os/guard-stream-publish-pruning/workpad.md`, `.task/tasks/os/guard-stream-publish-pruning.json`, `packages/os/scripts/lib/publish-scope.js`, `packages/os/scripts/stream-sync.js`, `packages/os/scripts/task-pr.js`, `packages/os/scripts/task-push.js`, `packages/os/scripts/task-start.js`, `packages/os/tests/publish-scope.test.ts`, `packages/workspace/scripts/lib/publish-scope.js`, `packages/workspace/scripts/stream-sync.js`, `packages/workspace/scripts/task-pr.js`, `packages/workspace/scripts/task-push.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/tests/publish-scope.test.ts`
- matched rules: `workspace-publish-gate`, `workspace-task-session`
- selected suites: `workspace verification stamp tests`, `workspace task session tests`
- run results: `workspace verification stamp tests` passed, `workspace task session tests` passed
- failed suites: none
