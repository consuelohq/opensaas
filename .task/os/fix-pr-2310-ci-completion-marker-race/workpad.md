# Fix PR 2310 CI completion marker race

branch: `task/os/fix-pr-2310-ci-completion-marker-race`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2330/fix-pr-2310-ci-completion-marker-race
github pr: https://github.com/consuelohq/opensaas/pull/2330
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

- 2026-08-31 19:41:44 fs.write: `.task/os/fix-pr-2310-ci-completion-marker-race/workpad.md`
- 2026-08-31 19:48:01 fs.write: `.task/os/fix-pr-2310-ci-completion-marker-race/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 19:47:36 `review.run`: passed — OK

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

behavior under test: completion_unknown must not fail during the short process-exit-to-durable-marker handoff, but a dead runner with no marker must still settle promptly rather than consume the caller's full wait budget
existing local pattern: packages/os/tests/subagent-lifecycle-regressions.test.ts completion_unknown and detached-runner contract cases
new or changed tests: add a deterministic dead-pid then delayed-owned-exit-marker race; retain the dead-pid-without-marker prompt-failure assertion
focused red command: bun run test -- tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts
expected red failure: current immediate dead-pid settlement returns failed before the delayed owned exit marker is observed
no-test waiver: not applicable

## CI evidence

- PR #2310 head 38e2520f3c64cdde21d0a26df52c460bb8535c63
- Consuelo / workspace contracts and Consuelo / verify failed on Linux with fast detached runners reported failed before writing a durable exit marker
- local current-head focused suite passed on macOS, so the regression must be made deterministic across process timing/platforms

- 2026-08-31 19:41:44 append: `.task/os/fix-pr-2310-ci-completion-marker-race/workpad.md`

- 2026-08-31 19:45:03 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-31 19:45:50 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-31 19:45:50 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

## Implementation and validation

- added a deterministic red regression for a dead runner whose owned exit marker appears 25ms later; red trace trc_ac9d755e77d2 returned completion_unknown before observing the marker
- added a 250ms EXIT_MARKER_HANDOFF_GRACE_MS only for completion_unknown runs with a dead PID; alive runners and PID-less startup retain their existing recovery behavior
- kept dead-runner/no-marker settlement bounded and asserted under 400ms rather than consuming the caller's full wait budget
- focused lifecycle + orchestration suite: 41/41 passed, trace trc_57a0a2ea7c2e
- focused suite stress: 3/3 full repetitions passed, trace trc_56f6cbe4f85e
- OS syntax/typecheck passed, trace trc_2e6b22af3f47
- strict review against stream head 38e2520f3c64cdde21d0a26df52c460bb8535c63: zero blocking issues, trace trc_907752860f1c
- note: an initial typecheck command used unsupported bun --cwd placement and printed help; the corrected packages/os cwd command is the passing evidence above

- 2026-08-31 19:48:01 append: `.task/os/fix-pr-2310-ci-completion-marker-race/workpad.md`
