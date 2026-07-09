# fix code call batch rows and steering examples

branch: `task/workspace-agents/fix-code-call-batch-rows-and-steering-examples`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1135/fix-code-call-batch-rows-and-steering-examples
github pr: https://github.com/consuelohq/opensaas/pull/1135
started: 2026-06-18

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

- none yet

## workspace-owned: validation evidence

- 2026-06-18 06:30:28 `review.run`: passed — OK
- 2026-06-18 06:30:43 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-code-call-batch-rows-and-steering-examples.json`, `.task/workspace-agents/fix-code-call-batch-rows-and-steering-examples/current.json`, `.task/workspace-agents/fix-code-call-batch-rows-and-steering-examples/session.json`, `.task/workspace-agents/fix-code-call-batch-rows-and-steering-examples/workpad.md`, `packages/workspace/server.py`, `packages/workspace/tests/server_call_test.py`, `packages/workspace/tests/trace-watch.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `trace-watch`
- selected suites: `trace watch build`
- run results: `trace watch build` passed
- failed suites: none
