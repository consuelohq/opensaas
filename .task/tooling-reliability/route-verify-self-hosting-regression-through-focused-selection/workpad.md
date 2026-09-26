# route verify self-hosting regression through focused selection

branch: `task/tooling-reliability/route-verify-self-hosting-regression-through-focused-selection`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2601/route-verify-self-hosting-regression-through-focused-selection
github pr: https://github.com/consuelohq/opensaas/pull/2601
started: 2026-09-26

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

- 2026-09-26 18:38:46 fs.write: `.task/tooling-reliability/route-verify-self-hosting-regression-through-focused-selection/workpad.md`
- 2026-09-26 18:39:56 fs.write: `.task/tooling-reliability/route-verify-self-hosting-regression-through-focused-selection/workpad.md`

## workspace-owned: validation evidence

- 2026-09-26 18:39:40 `review.run`: passed — OK

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
bun run task:push -- --message "type(tooling-reliability): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- Changes to facade executor task-worktree routing and the verify-routing regression must select a focused command that actually executes `runs task-scoped verify from the resolved task worktree instead of controller cwd`.
- Exclusive facade/MCP selector ownership must not suppress this regression.

existing local pattern:
- `executor.ts` and `facade.test.ts` are owned by exclusive focused rules, but current selected facade commands filter to unrelated test names such as `call execution timeout` or fs operations.

new or changed tests:
- Add a test-selection regression for `executor.ts` + `facade.test.ts` that requires a selected command containing the exact verify-routing test filter and no broad OS package suite.

focused red command:
`bun x vitest run packages/workspace/tests/test-selection.test.js -t "routes verify self-hosting regression"`

expected red failure:
- Current selected commands do not include the verify-routing regression filter.

no-test waiver: not applicable.

- 2026-09-26 18:38:46 append: `.task/tooling-reliability/route-verify-self-hosting-regression-through-focused-selection/workpad.md`

## Implementation / validation

- Focused RED reproduced the review gap: executor/facade changes selected only unrelated filtered facade suites.
- Added a durable `os-verify-task-worktree-routing` explicit critical/exclusive selector in source rules and regenerated the committed registry.
- The rule runs the exact facade regression `runs task-scoped verify from the resolved task worktree instead of controller cwd`.
- Focused selector test and exact facade regression are GREEN.
- All 86 test-selection tests pass; `git diff --check` passes.
- Strict review reports 0 blockers/findings.
- Full foreground verify completed in 8.07s, selected the focused test-selection suite, passed review/DB gates, and wrote a publish-valid stamp.

- 2026-09-26 18:39:56 append: `.task/tooling-reliability/route-verify-self-hosting-regression-through-focused-selection/workpad.md`
