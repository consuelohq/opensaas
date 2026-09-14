# fix remaining consuelo verify snapshot and path failures

branch: `task/os/fix-remaining-consuelo-verify-snapshot-and-path-failures`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2325
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/workspace/STEERING.md`
- `packages/os/steering/system_prompt.md`
- `packages/os/tests/session-integration-guidance.test.ts`
- `packages/os/tests/memory-adjacent.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`


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

behavior under test: Consuelo / verify on stream/os PR 2310 stays green after the skill-migration snapshot sync. remaining red suites are session-integration-guidance (steering still teaches task.start; package-test cwd double-prefixes packages/os), memory-adjacent toEndWith under vitest, session-start-foundation cwd, and subagent orchestration tmp cleanup ENOTEMPTY.
existing local pattern: session-integration-guidance.test.ts, steering-canonical-source.test.ts, subagent-orchestration-contract.test.ts, memory-adjacent.test.ts, session-start-foundation.test.ts.
new or changed tests: keep the session.start product assertions; fix path resolution and vitest matcher; harden tmp cleanup. do not weaken session.start contract.
focused red command: bun test tests/session-integration-guidance.test.ts tests/memory-adjacent.test.ts tests/session-start-foundation.test.ts tests/subagent-orchestration-contract.test.ts tests/steering-canonical-source.test.ts tests/skill-migration.test.ts
expected red failure: steering missing `call session.start({ kind: "task" }) directly`; package-test ENOENT packages/os/packages/os; toEndWith; ENOTEMPTY on /tmp/os-subagent-metadata-*.
no-test waiver: not applicable

- 2026-08-31 03:49:24 append: `.task/os/fix-remaining-consuelo-verify-snapshot-and-path-failures/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/session-integration-guidance.test.ts`

## workspace-owned: activity log

- 2026-08-31 03:49:24 fs.write: `.task/os/fix-remaining-consuelo-verify-snapshot-and-path-failures/workpad.md`
- 2026-08-31 03:50:23 write: `packages/os/tests/session-integration-guidance.test.ts`
- 2026-08-31 03:50:23 fs.write: `packages/os/tests/session-integration-guidance.test.ts`

## workspace-owned: files read

- `packages/os/tests/session-integration-guidance.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-31 03:51:06 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

## workspace-owned: validation evidence

- 2026-08-31 03:52:12 `review.run`: passed — OK
