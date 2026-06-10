# polish inbox layout

branch: `task/diff-cockpit/polish-inbox-layout`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/901/polish-inbox-layout
github pr: https://github.com/consuelohq/opensaas/pull/901
started: 2026-06-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-10 00:23:25 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-10 00:24:15 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-10 00:26:52 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-10 00:31:13 fs.patch: `packages/diff-cockpit/src/index.ts`

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
