# fix OS subagent CI package cwd paths

branch: `task/dialer-algorithm/fix-os-subagent-ci-package-cwd-paths`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2089/fix-os-subagent-ci-package-cwd-paths
github pr: https://github.com/consuelohq/opensaas/pull/2089
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 19:51:42 fs.write: `.task/dialer-algorithm/fix-os-subagent-ci-package-cwd-paths/workpad.md`
- 2026-08-15 19:55:40 fs.write: `.task/dialer-algorithm/fix-os-subagent-ci-package-cwd-paths/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 19:55:02 `checkFiles`: passed — OK
- 2026-08-15 19:55:28 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: OS subagent lifecycle/orchestration tests must resolve repo-owned runner modules correctly when the package test process cwd is `packages/os`, matching GitHub CI.
existing local pattern: derive absolute fixture/module paths from the test file or package root, not from `process.cwd()` plus a repo-relative `packages/os/...` path.
new or changed tests: use the existing failing lifecycle/orchestration tests as the contract; add a targeted path-resolution assertion only if the existing tests cannot prove the fix.
focused red command: run the exact failing subagent lifecycle/orchestration test cases from `packages/os` cwd.
expected red failure: module resolution contains `packages/os/packages/os/scripts/lib/subagent/lifecycle.ts`, causing runner startup failure and downstream `completion_unknown`/false assertions.
no-test waiver: not applicable.

## Acceptance criteria

- Reproduce the three exact CI failures from `packages/os` cwd.
- Fix path resolution without changing production subagent lifecycle semantics.
- Both affected test files pass in full from package cwd.
- Static/typecheck/review checks for touched files pass.
- Promote into `stream/dialer-algorithm`, then require PR #2014 zero failed/zero pending before merge.

- 2026-08-15 19:51:42 append: `.task/dialer-algorithm/fix-os-subagent-ci-package-cwd-paths/workpad.md`

## workspace-owned: files read

- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-15 19:52:27 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

## Final implementation and validation

Implementation:
- Changed only `packages/os/tests/subagent-lifecycle-regressions.test.ts`.
- The concurrent-starter fixture now resolves `scripts/lib/subagent/lifecycle.ts` relative to `import.meta.url` via `fileURLToPath(new URL(...))`, matching the same file's existing runner-path pattern.
- No production subagent lifecycle/orchestration behavior changed.

Evidence:
- CI failure on PR #2014 resolved the module as `packages/os/packages/os/scripts/lib/subagent/lifecycle.ts` because the package test cwd is already `packages/os`.
- RED locally from `packages/os` cwd: the two affected files ran 33 tests with 1 failure, exactly `atomically claims a requestId so concurrent starts spawn exactly once`, with the duplicated path.
- GREEN after fix: both affected files = 33/33 passed from `packages/os` cwd.
- `checkFiles` passed for the changed test file.
- Strict review against `origin/stream/dialer-algorithm`: 0 issues, 0 blockers.
- Full `bun run test` for `@consuelo/os` was attempted. It is not a reliable local gate in this task worktree: 300 files passed while 20 files failed from unrelated host/branch/shared-state assumptions (installer/daemon timing, task branch naming, executable-discovery cross-test state, etc.). Those failures are outside this one-line test-path change. GitHub Consuelo CI remains the authoritative broad gate.

Release rule:
- Promote this task into `stream/dialer-algorithm`.
- Do not merge stream PR #2014 until GitHub reports zero failed and zero pending checks on the new stream head.

- 2026-08-15 19:55:40 append: `.task/dialer-algorithm/fix-os-subagent-ci-package-cwd-paths/workpad.md`
