# Add Trace Sites OS observability TDD contracts

branch: `task/os/add-trace-sites-os-observability-tdd-contracts`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1093/add-trace-sites-os-observability-tdd-contracts
github pr: https://github.com/consuelohq/opensaas/pull/1093
started: 2026-06-16

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-16 21:05:56 apply-patch: `packages/os/tests/trace-sites-gateway-live-stream.test.ts`
- 2026-06-16 21:05:56 apply-patch: `packages/os/tests/trace-sites-browser-client.test.ts`
- 2026-06-16 21:07:03 apply-patch: `packages/os/tests/trace-sites-reporting.test.ts`
- 2026-06-16 21:07:03 apply-patch: `packages/os/tests/trace-sites-runtime-boundary.test.ts`
- 2026-06-16 21:07:03 apply-patch: `packages/os/tests/trace-sites-live-smoke-script.test.ts`