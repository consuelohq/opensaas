# Remove legacy OS steering file from stream

branch: `task/sites/remove-legacy-os-steering-file-from-stream`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1087/remove-legacy-os-steering-file-from-stream
github pr: https://github.com/consuelohq/opensaas/pull/1087
started: 2026-06-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tests/os-get-steering-trace.test.ts`

## workspace-owned: files changed

- `packages/os/tests/os-get-steering-trace.test.ts`

## workspace-owned: activity log

- 2026-06-16 17:45:49 fs.patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-06-16 17:46:18 fs.patch: `packages/os/tests/os-get-steering-trace.test.ts`

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-16 17:45:49 patch lines 1-133: `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-06-16 17:46:18 patch lines 154-154: `packages/os/tests/os-get-steering-trace.test.ts`
