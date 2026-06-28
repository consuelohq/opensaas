# add invalid timestamp tests

branch: `task/workspace-agents/add-invalid-timestamp-tests`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1242/add-invalid-timestamp-tests
github pr: https://github.com/consuelohq/opensaas/pull/1242
started: 2026-06-28

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

- 2026-06-28 00:31:50 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/workspace/scripts/trace-home/model.ts`
- `packages/workspace/tests/trace-home.test.ts`
- `packages/workspace/tests/trace-watch.test.ts`
- `scripts/operator/trace-watch.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/add-invalid-timestamp-tests.json`, `.task/workspace-agents/add-invalid-timestamp-tests/current.json`, `.task/workspace-agents/add-invalid-timestamp-tests/evidence-log.json`, `.task/workspace-agents/add-invalid-timestamp-tests/read-log.json`, `.task/workspace-agents/add-invalid-timestamp-tests/session.json`, `.task/workspace-agents/add-invalid-timestamp-tests/workpad.md`, `packages/workspace/tests/trace-home.test.ts`, `packages/workspace/tests/trace-watch.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
