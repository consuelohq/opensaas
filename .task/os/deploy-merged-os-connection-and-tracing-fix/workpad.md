# Deploy merged OS connection and tracing fix

branch: `task/os/deploy-merged-os-connection-and-tracing-fix`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2378
started: 2026-09-04

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

## Deployment contract

behavior under test: merged PR 2375 authority route reconciliation and historical trace hydration recover in the live internal workspace
existing local pattern: version 0.1.103 is signed, promoted to canary, installed, and all focused/unit/type/dry-run gates already passed before merge
new or changed tests: none; this session makes no code changes
focused red command: authenticated gateway probes currently return 503 WORKSPACE_NODE_OFFLINE and Home shows Configuration unavailable with zero traces
expected red failure: both configuration and persisted trace endpoints return 503 before authority reconciliation is deployed
no-test waiver: deployment-only session for already-reviewed and already-tested merged code; live red/green acceptance is the required gate

- 2026-09-04 16:16:08 append: `.task/os/deploy-merged-os-connection-and-tracing-fix/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-04 16:16:08 fs.write: `.task/os/deploy-merged-os-connection-and-tracing-fix/workpad.md`
- 2026-09-04 16:25:54 fs.write: `.task/os/deploy-merged-os-connection-and-tracing-fix/workpad.md`

## Quota-outage hardening contract

behavior under test: connected stale-node MCP and signed gateway routes perform a direct upstream probe when D1 heartbeat writes are temporarily unavailable
existing local pattern: OAuth discovery bypasses the TTL gate, but normal MCP and gateway requests are rejected before the connected tunnel can prove liveness
new or changed tests: change the stale-default routing contract to require a successful direct MCP probe; live authenticated configuration and trace probes cover gateway behavior
focused red command: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun vitest run tests/workspace-node-registry-routing.test.ts -t "keeps OAuth discovery"
expected red failure: stale MCP request returns 503 WORKSPACE_NODE_OFFLINE instead of reaching the connected connector
no-test waiver: not applicable

- 2026-09-04 16:25:54 append: `.task/os/deploy-merged-os-connection-and-tracing-fix/workpad.md`

- 2026-09-04 16:26:24 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-09-04 16:27:52 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

## workspace-owned: validation evidence

- 2026-09-04 16:33:03 `review.run`: passed — OK
- 2026-09-04 16:33:35 `verify`: passed — OK
