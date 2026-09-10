# Restrict authority readiness fallback to transient failures

branch: `task/os/restrict-authority-readiness-fallback-to-transient-failures`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2376/restrict-authority-readiness-fallback-to-transient-failures
github pr: https://github.com/consuelohq/opensaas/pull/2376
started: 2026-09-04

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-04 15:39:59 fs.write: `.task/os/restrict-authority-readiness-fallback-to-transient-failures/workpad.md`
- 2026-09-04 15:42:30 fs.write: `.task/os/restrict-authority-readiness-fallback-to-transient-failures/workpad.md`

## workspace-owned: validation evidence

- 2026-09-04 15:42:21 `review.run`: passed — OK
- 2026-09-04 15:43:29 `verify`: passed — OK

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

## Test-first contract — authority fallback classification

behavior under test: cached signed MCP proof may preserve route readiness after transient authority transport or 5xx failures, but 4xx authority rejection must be rethrown so the node fails closed
existing local pattern: packages/os/tests/workspace-node-heartbeat-script.test.ts uses an in-memory fetch fixture to exercise the signed MCP probe and authority heartbeat sequence
new or changed tests: add permanent authority rejection coverage for 401, 403, and 404 while retaining the existing 503 degradation case
focused red command: bun test packages/os/tests/workspace-node-heartbeat-script.test.ts
expected red failure: the 4xx cases currently resolve with authorityReady false instead of rejecting
no-test waiver: not applicable

- 2026-09-04 15:39:59 append: `.task/os/restrict-authority-readiness-fallback-to-transient-failures/workpad.md`

- 2026-09-04 15:40:51 apply-patch: `packages/os/tests/workspace-node-heartbeat-script.test.ts`
- 2026-09-04 15:41:19 apply-patch: `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- 2026-09-04 15:41:19 apply-patch: `packages/os/scripts/workspace-node-heartbeat.ts`
- 2026-09-04 15:41:43 apply-patch: `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`

## Implementation and validation

- Added a typed heartbeat request error that preserves HTTP status only for transport/non-2xx failures.
- Degraded authority readiness now applies only to network failures and HTTP 5xx after signed MCP readiness is proven.
- HTTP 401, 403, and 404 are rethrown and fail closed.
- Focused red: 10 passed, 3 failed because all three 4xx cases incorrectly resolved.
- Focused green: 19 passed across the heartbeat client and script suites.
- OS syntax/type contract: passed.
- Strict workspace review: 0 issues, 0 blockers.

- 2026-09-04 15:42:30 append: `.task/os/restrict-authority-readiness-fallback-to-transient-failures/workpad.md`
