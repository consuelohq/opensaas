# fix PR 2310 current head review

branch: `task/os/fix-pr-2310-current-head-review`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2328/fix-pr-2310-current-head-review
github pr: https://github.com/consuelohq/opensaas/pull/2328
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

- 2026-08-31 19:20:26 fs.write: `.task/os/fix-pr-2310-current-head-review/workpad.md`
- 2026-08-31 19:25:21 fs.write: `.task/os/fix-pr-2310-current-head-review/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 19:24:54 `review.run`: passed — OK

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

behavior under test:
- A copied package-test command example is executable by code.call using a shell language.
- A reconciled completion_unknown run with a dead persisted runner PID and no exit marker returns immediately as COMMAND_FAILED instead of consuming the wait budget.

existing local pattern:
- Task skill examples use language: "shell" for literal commands and Bun only for valid Bun programs.
- Subagent wait already distinguishes alive runner, missing startup PID, and persisted terminal state.

new or changed tests:
- Extend skill guidance assertions for the package-test code.call language.
- Extend subagent lifecycle regressions with a dead-runner, missing-marker wait-budget assertion.

focused red command:
- bun run --cwd packages/os test -- tests/session-integration-guidance.test.ts tests/subagent-lifecycle-regressions.test.ts

expected red failure:
- Guidance exposes the literal command as Bun source.
- Dead completion_unknown remains classified as unsettled and waits until budget expiration.

no-test waiver: not applicable.

- 2026-08-31 19:20:26 append: `.task/os/fix-pr-2310-current-head-review/workpad.md`

- 2026-08-31 19:22:39 apply-patch: `packages/os/tests/session-integration-guidance.test.ts`
- 2026-08-31 19:22:39 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-31 19:23:26 apply-patch: `packages/workspace/task.md`
- 2026-08-31 19:23:26 apply-patch: `packages/os/skills/task/SKILL.md`
- 2026-08-31 19:23:26 apply-patch: `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`
- 2026-08-31 19:23:26 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

## Review-fix result

- Red: `trc_a099844f1168` reproduced both current-head Codex findings.
- Green: `trc_da21d1d0a327` passed 42/42 across session guidance, subagent lifecycle, and orchestration.
- Typecheck/syntax: `trc_603aa34bf70e`.
- Canonical task guidance matches the workspace fixture: `trc_44bf842d2b32`.
- Strict local review against exact stream head `a19e2ed76fef3056a22f6c9422ccaf0f17282601`: zero blocking issues, `trc_47a6b3c94f40`.
- A broad guidance command used package-root-prefixed test paths after changing cwd and found no files (`trc_0701c401f831`); this was a command-shaping mistake, not a product failure. The same focused guidance test passed in the 42-test green run.

## Files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/session-integration-guidance.test.ts`
- `packages/workspace/task.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`

## Key decisions

- Keep completion_unknown recoverable while a runner is alive or startup is still inside grace; settle it only when a persisted runner is dead or missing after startup grace.
- Literal package commands use Bash. Bun mode remains reserved for valid Bun programs.
- The public skill documentation opportunity is nonblocking because this corrects an executable example without changing the user-facing task workflow.

- 2026-08-31 19:25:21 append: `.task/os/fix-pr-2310-current-head-review/workpad.md`
