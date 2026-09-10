# fix task-cleanup durable safety package-root paths

branch: `task/os/fix-task-cleanup-durable-safety-package-root-paths`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2312
started: 2026-08-30

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/tests/task-cleanup-durable-safety.test.ts`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `tests/task-cleanup-durable-safety.test.ts` must read both workspace and OS task-cleanup.js files when the package test runs with cwd `packages/os`.

existing local pattern: resolve fixtures from `import.meta.dirname` instead of `process.cwd()` + repo-relative paths.

new or changed tests: existing test only, path resolution change.

focused red command: `bun test tests/task-cleanup-durable-safety.test.ts` with cwd packages/os

expected red failure: ENOENT packages/os/packages/workspace/scripts/task-cleanup.js

no-test waiver: not applicable

- 2026-08-30 18:12:45 append: `.task/os/fix-task-cleanup-durable-safety-package-root-paths/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/task-cleanup-durable-safety.test.ts`

## workspace-owned: activity log

- 2026-08-30 18:12:45 fs.write: `.task/os/fix-task-cleanup-durable-safety-package-root-paths/workpad.md`
- 2026-08-30 18:12:46 write: `packages/os/tests/task-cleanup-durable-safety.test.ts`
- 2026-08-30 18:12:46 fs.write: `packages/os/tests/task-cleanup-durable-safety.test.ts`
