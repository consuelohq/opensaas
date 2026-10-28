# persist confirm selector ownership in source rules

branch: `task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2599/persist-confirm-selector-ownership-in-source-rules
github pr: https://github.com/consuelohq/opensaas/pull/2599
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

- 2026-09-26 18:26:20 fs.write: `.task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules/workpad.md`
- 2026-09-26 18:28:22 fs.write: `.task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules/workpad.md`
- 2026-09-26 18:28:37 fs.write: `.task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules/workpad.md`

## workspace-owned: validation evidence

- 2026-09-26 18:28:05 `review.run`: passed — OK

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
- `test-selection:generate` must preserve focused `workspace-publish-gate` ownership for both Workspace and OS `confirm.js` callers.
- Regenerating `test-selection.registry.json` must not reintroduce the broad OS package suite for confirm-only changes.

existing local pattern:
- The stream currently contains the confirm paths only in generated `test-selection.registry.json`.
- `packages/workspace/test-selection.rules.json` remains the source of truth and generation drops those paths.

new or changed tests:
- Add/extend a selector regeneration contract that generates a fresh registry from source rules and then checks confirm-only selection still chooses the focused verification suite and not the broad OS package suite.

focused red command:
`bun x vitest run packages/workspace/tests/test-selection.test.js -t "preserves confirm ownership after registry regeneration"`

expected red failure:
- Fresh generation drops `packages/{workspace,os}/scripts/confirm.js` from the publish-gate sources, so the focused suite is absent or the broad OS package suite is selected.

no-test waiver: not applicable.

- 2026-09-26 18:26:20 append: `.task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules/workpad.md`

## Implementation / validation

- RED proved the committed generated registry had four explicit-rule drifts from `test-selection.rules.json`: publish-gate verify/confirm coverage, OS stream-sync parity, MCP NOT_FOUND recovery coverage, and the task-merge agent-boundary rule.
- Reconciled those intended explicit rules into the source-of-truth rules file rather than preserving a one-off generated-registry edit.
- Added a regeneration regression that compares regenerated explicit rules with the committed explicit registry and then proves regenerated confirm-only selection still uses the focused verification suite without the broad OS package suite.
- Focused regeneration test is GREEN; all 84 test-selection tests and `git diff --check` pass.
- Strict review against the stream base reports 0 blockers/findings.

- 2026-09-26 18:28:22 append: `.task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules/workpad.md`
- Full foreground verify completed in 8.24s, selected only the focused `workspace-test-selection` suite, passed review/DB gates, and wrote a publish-valid stamp.

- 2026-09-26 18:28:37 append: `.task/tooling-reliability/persist-confirm-selector-ownership-in-source-rules/workpad.md`
