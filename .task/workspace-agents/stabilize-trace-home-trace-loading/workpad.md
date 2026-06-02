# stabilize trace home trace loading

branch: `task/workspace-agents/stabilize-trace-home-trace-loading`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/694/stabilize-trace-home-trace-loading
github pr: https://github.com/consuelohq/opensaas/pull/694
started: 2026-06-02

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

- none yet

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

- `packages/workspace/tests/trace-home.test.ts`
- `scripts/operator/trace-home.ts`
- `scripts/operator/trace-watch.ts`
