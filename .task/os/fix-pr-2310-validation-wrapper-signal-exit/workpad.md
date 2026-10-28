# fix PR 2310 validation wrapper signal exit

branch: `task/os/fix-pr-2310-validation-wrapper-signal-exit`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2336/fix-pr-2310-validation-wrapper-signal-exit
github pr: https://github.com/consuelohq/opensaas/pull/2336
started: 2026-08-31

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

- 2026-08-31 21:10:47 fs.write: `.task/os/fix-pr-2310-validation-wrapper-signal-exit/workpad.md`
- 2026-08-31 21:14:46 fs.write: `.task/os/fix-pr-2310-validation-wrapper-signal-exit/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 21:13:59 `review.run`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: validation wrappers must exit nonzero when a spawned test process terminates by signal and exposes `exitCode === null`
existing local pattern: task skill examples are contract-tested from `packages/os/tests`
new or changed tests: add a task skill contract assertion that every spawned-process wrapper uses a nonzero null fallback
focused red command: `bun test packages/os/tests/task-skill-contract.test.ts`
expected red failure: examples still contain `process.exit(proc.exitCode)` without `?? 1`
no-test waiver: not applicable

Review evidence: current-head Codex P2 on PR #2310 at `packages/os/skills/task/SKILL.md`; completed review commit `a1404ad`.

- 2026-08-31 21:10:47 append: `.task/os/fix-pr-2310-validation-wrapper-signal-exit/workpad.md`

## workspace-owned: files read

- `packages/os/tests/session-integration-guidance.test.ts`

- 2026-08-31 21:12:15 apply-patch: `packages/os/tests/session-integration-guidance.test.ts`

## Final implementation summary

- Replaced all 8 unsafe `process.exit(proc.exitCode)` validation wrapper exits in each canonical task guidance copy with `process.exit(proc.exitCode ?? 1)`.
- Kept `packages/os/skills/task/SKILL.md`, `packages/workspace/task.md`, and the packaged test fixture in sync.
- Added a contract test that rejects regressions in any of the three copies.

## Validation

- Red: focused contract failed on the unsafe wrapper text (`trc_09665428a6e0`).
- Green: all 4 session integration guidance tests passed, 20 assertions (`trc_f14d67645819`).
- Green: OS syntax/typecheck passed (`trc_7cc65a51ba7a`).
- Green: strict review found zero blockers; the public-doc mapping suggestion is nonblocking because this is execution-safety correction in code examples, not a user-visible task workflow change (`trc_8efec566d74a`).
- Diff inspected in working-tree mode: 3 synchronized guidance copies plus 1 focused contract test (`trc_d7ccb9ea9d4d`).

- 2026-08-31 21:14:46 append: `.task/os/fix-pr-2310-validation-wrapper-signal-exit/workpad.md`
