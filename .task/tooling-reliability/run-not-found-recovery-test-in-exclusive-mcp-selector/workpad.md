# run not-found recovery test in exclusive MCP selector

branch: `task/tooling-reliability/run-not-found-recovery-test-in-exclusive-mcp-selector`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2600/run-not-found-recovery-test-in-exclusive-mcp-selector
github pr: https://github.com/consuelohq/opensaas/pull/2600
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

- 2026-09-26 18:34:14 fs.write: `.task/tooling-reliability/run-not-found-recovery-test-in-exclusive-mcp-selector/workpad.md`
- 2026-09-26 18:35:24 fs.write: `.task/tooling-reliability/run-not-found-recovery-test-in-exclusive-mcp-selector/workpad.md`

## workspace-owned: validation evidence

- 2026-09-26 18:35:07 `review.run`: passed — OK

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
- The exclusive `os-mcp-call-timeout-envelope` selector must execute every test file it exclusively owns, including `packages/os/tests/facade/not-found-recovery.test.ts`.
- A change to only that recovery test must select a focused suite that actually contains that file and must not silently suppress all execution behind the exclusive rule.

existing local pattern:
- The source rule now owns `not-found-recovery.test.ts` but its Vitest command does not run it.

new or changed tests:
- Extend test-selection coverage to assert the selected command for a `not-found-recovery.test.ts` change includes that exact file and excludes the broad OS package test.

focused red command:
`bun x vitest run packages/workspace/tests/test-selection.test.js -t "runs the owned NOT_FOUND recovery test"`

expected red failure:
- The rule is selected but no command contains `packages/os/tests/facade/not-found-recovery.test.ts`.

no-test waiver: not applicable.

- 2026-09-26 18:34:14 append: `.task/tooling-reliability/run-not-found-recovery-test-in-exclusive-mcp-selector/workpad.md`

## Implementation / validation

- Focused RED reproduced the review gap: the exclusive MCP selector owned `not-found-recovery.test.ts` but selected no command containing that file.
- Added the recovery test to the focused MCP envelope Vitest command in source rules and regenerated the committed registry from source.
- Focused selector test is GREEN; the recovery test itself passes.
- All 85 test-selection tests pass; `git diff --check` passes.
- Strict review against the stream base reports 0 blockers/findings.
- Full foreground verify completed in 8.02s, selected the focused test-selection suite, passed review/DB gates, and wrote a publish-valid stamp.

- 2026-09-26 18:35:24 append: `.task/tooling-reliability/run-not-found-recovery-test-in-exclusive-mcp-selector/workpad.md`
