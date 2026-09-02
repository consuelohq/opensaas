# raise subagent test timeouts and seed isolated trace store

branch: `task/os/raise-subagent-test-timeouts-and-seed-isolated-trace-store`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2314
started: 2026-08-30

## acceptance criteria

- [x] Grok durable runner test has a vitest timeout above the 5s default so wait recovery can finish on CI.
- [x] Inherited-secrets and wait-unknown recovery tests have the same 25s vitest budget.
- [x] Gateway e2e seeds an isolated trace sqlite so a missing ambient store is not `TRACE_STORE_UNAVAILABLE` 503.
- [x] Focused suite green locally (37 pass).

## Test-first contract

CI red: vitest 5s timeout on Grok and wait-unknown; gateway 503 `TRACE_STORE_UNAVAILABLE` because the temp node had no sqlite file.

## workspace-owned: validation evidence

```text
bun test tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts tests/workspace-gateway-node-end-to-end.test.ts tests/trace-gateway-home-cache.test.ts
37 pass, 0 fail
```

- 2026-08-30 19:56:19 write: `.task/os/raise-subagent-test-timeouts-and-seed-isolated-trace-store/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 19:56:19 fs.write: `.task/os/raise-subagent-test-timeouts-and-seed-isolated-trace-store/workpad.md`
