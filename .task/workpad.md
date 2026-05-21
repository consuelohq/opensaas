# persist skill artifacts

branch: `task/os/persist-skill-artifacts`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/432/persist-skill-artifacts
github pr: https://github.com/consuelohq/opensaas/pull/432
started: 2026-05-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 08:30:17 patch lines 1-13: `packages/os/scripts/lib/artifacts.ts`
- 2026-05-21 08:30:17 patch lines 1-57: `packages/os/scripts/lib/types.ts`
- 2026-05-21 08:30:18 patch lines 1-47: `packages/os/scripts/revenue/daily-revenue-brief.ts`
- 2026-05-21 08:30:18 write: `packages/os/tests/artifacts.test.ts`
- 2026-05-21 08:30:18 write: `packages/os/tests/os-call-artifacts.test.ts`
- 2026-05-21 08:30:32 patch lines 113-117: `packages/os/scripts/os.ts`
- 2026-05-21 08:30:47 patch lines 112-121: `packages/os/scripts/os.ts`
- 2026-05-21 08:31:31 patch lines 1-68: `packages/os/tests/artifacts.test.ts`
- 2026-05-21 08:31:31 patch lines 1-80: `packages/os/tests/os-call-artifacts.test.ts`
- 2026-05-21 08:32:09 patch lines 169-169: `packages/os/scripts/lib/artifacts.ts`
- 2026-05-21 08:32:09 patch lines 66-66: `packages/os/scripts/lib/types.ts`
- 2026-05-21 08:32:09 patch lines 64-64: `packages/os/scripts/revenue/daily-revenue-brief.ts`
- 2026-05-21 08:33:30 patch lines 100-145: `packages/os/scripts/lib/artifacts.ts`