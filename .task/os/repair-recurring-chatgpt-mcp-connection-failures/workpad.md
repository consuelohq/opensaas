# repair recurring ChatGPT MCP connection failures

branch: `task/os/repair-recurring-chatgpt-mcp-connection-failures`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2401
started: 2026-09-07

## acceptance criteria

- [x] Reproduce excessive heartbeat writes with real SQLite and eliminate unchanged/indexed writes on steady-state presence updates.
- [x] Preserve default routing, published sites, and fail-closed node freshness.
- [x] Report D1 quota exhaustion through safe authority and installed heartbeat diagnostics.
- [ ] Ship reviewed source, hosted authority, signed canary and local installation.
- [ ] Verify the existing ChatGPT connection after D1 quota reset or an independently authorized upgrade.

## plan

1. Reproduce and reduce heartbeat write amplification; validate regression and existing routing contracts.
2. Publish the reviewed source and deploy the authority with rollback metadata retained.
3. Release the exact merged version to canary and update the Mac; verify quota recovery and public connector acceptance.

## files changed

- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tests/workspace-route-heartbeat-write-budget.test.ts`

## key decisions

- Keep authenticated routing and freshness requirements intact. Reduce writes at the D1 persistence boundary and distinguish authority quota failure from local runtime health.

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

## workspace-owned: files read

- `.agents/skills/nx-run-tasks/SKILL.md`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `CODING-STANDARDS.md`
- `packages/os/AGENTS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/security/redaction.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/package.json`
- `packages/os/project.json`
- `packages/os/scripts/deploy-cloudflare-worker.ts`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/scripts/lib/lifecycle/connector-readiness.ts`
- `packages/os/scripts/lib/verify-run-state.js`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/release.ts`
- `packages/os/scripts/verify.js`
- `packages/os/scripts/verify.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/workspace-cloudflare-d1-migration-regression.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tools/deployment-provider/cloudflare.ts`
- `packages/os/vitest.config.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Approved scope and acceptance

Ko approved diagnosis, a tested OS-source repair, controlled local validation, normal release/update, and acceptance through the existing ChatGPT connection. Use stream/os, starting from main. Preserve other tasks and the installed release until the failure is identified.

- [ ] Correlate a failed external connector request with gateway/runtime evidence and explain any healthy watchdog disagreement.
- [ ] Write and run a focused regression RED before production edits.
- [ ] Implement the responsible boundary fix and prove GREEN plus realistic recovery.
- [ ] Publish through task/stream review and install the released build; deploy hosted changes only if implicated.
- [ ] Existing ChatGPT connection recovers after the relevant controlled interruption without manual repair.

## Investigation state

2026-09-07: codex_apps OS steering failed twice with -32603 Internal error. Direct mcp__os steering and managed calls succeed. Native shell loopback probes were sandbox-blocked, which is not an OS failure; the managed HTTP wrapper succeeds. At 17:44:31Z Caddy /health and workers 46321/46322 /ready passed on version 0.1.107. Earlier local logs showed worker timeouts, tunnel reconnection, and routeReady/mcpReady true with authorityReady false. Ko is collecting a fresh ChatGPT error, timestamp, and any available Cloudflare Ray ID. Do not attribute that failure until correlated.

## Test-first contract

Behavior under test: authenticated remote MCP tool calls remain recoverable across the identified connection failure; readiness reflects the relevant public call path and recovery targets the failing component.
Existing local pattern: inspecting heartbeat, lifecycle connector readiness, gateway transport, and their tests.
New tests and commands: see confirmed D1 regression contract and recorded RED/GREEN traces below. RED completed before corresponding production edits.
No-test waiver: none.

## Next steps

Inspect current readiness/authenticated probes and authority failure detail, correlate remote client evidence, inspect active overlap before code changes, then implement the focused failing contract. Validate against origin/main because task starts from main.

- 2026-09-07 17:45:51 append: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tests/workspace-route-heartbeat-write-budget.test.ts`

## workspace-owned: activity log

- 2026-09-07 17:45:51 fs.write: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`
- 2026-09-07 18:04:02 fs.write: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`
- 2026-09-07 18:05:15 fs.write: `packages/os/tests/workspace-route-heartbeat-write-budget.test.ts`
- 2026-09-07 18:07:49 fs.write: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-09-07 18:07:50 fs.write: `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- 2026-09-07 18:10:06 fs.write: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`
- 2026-09-07 18:20:09 fs.write: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`

## Confirmed D1 write exhaustion and focused regression contract

Cloudflare daily analytics: Sep 5 103925 rows written, Sep 6 104795, Sep 7 101774 by 17:57 UTC, versus free 100000/day. Rolling 24h insights identify registry UPDATE (63545 rows) and connector UPSERT (38004 rows) as dominant writes. Heartbeat reconciliation rewrites every active registered node including unchanged/stale peers. Local proxy and workers and signed connector MCP are healthy; authority heartbeat returns 503 and D1 presence is stale since 17:10 UTC. No production D1 mutations used in diagnosis.

Behavior under test: one changed heartbeat writes one non-indexed route row regardless of registered peer count; replay of unchanged heartbeat writes no rows; connector/topology changes remain durable; expired nodes still fail closed and published routes survive. Existing pattern: prepare-only D1 binding tests and Bun SQLite route seed tests. New regression: workspace-route-heartbeat-write-budget.test.ts backed by in-memory SQLite and actual reconciliation. RED command: bun test packages/os/tests/workspace-route-heartbeat-write-budget.test.ts. Expected RED: existing reconciliation performs O(nodes) indexed route/connector writes instead of one. No test waiver.

Candidate repair: preserve node array order, skip identical route records, condition connector conflict updates on changed metadata, use JSON-only route updates when routing topology is identical. Preserve all authentication, freshness TTL, and explicit default selection. No pricing/plan changes authorized or performed.

- 2026-09-07 18:04:02 append: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`

- 2026-09-07 18:05:15 write: `packages/os/tests/workspace-route-heartbeat-write-budget.test.ts`

- 2026-09-07 18:06:01 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`

- 2026-09-07 18:07:49 append: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-07 18:07:50 apply-patch: `packages/os/tests/workspace-node-heartbeat-script.test.ts`
- 2026-09-07 18:07:50 append: `packages/os/tests/workspace-node-heartbeat-client.test.ts`

- 2026-09-07 18:08:31 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- 2026-09-07 18:08:31 apply-patch: `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- 2026-09-07 18:08:31 apply-patch: `packages/os/scripts/workspace-node-heartbeat.ts`

## workspace-owned: validation evidence

- 2026-09-07 18:09:44 `review.run`: passed — OK
- 2026-09-07 18:11:49 `verify`: failed — COMMAND_FAILED
- 2026-09-07 18:18:08 `verify`: failed — COMMAND_FAILED
- 2026-09-07 18:19:50 `verify`: passed — OK

## Implementation and validation

Reduced steady-state D1 writes via stable target ordering, unchanged-record suppression, conditional connector UPSERT, and non-indexed JSON/timestamp updates for presence-only changes. Added specific safe WORKSPACE_ROUTE_QUOTA_EXCEEDED authority response plus allowlisted local heartbeat authorityError diagnostics; signing and fail-closed TTL behavior preserved.

RED write-budget regression reproduced 2/16/64 indexed writes for 1/8/32 registered nodes (trace trc_a35f9132af8e). GREEN: one non-indexed row update per changed heartbeat and zero writes on unchanged replay (trc_1eeaff0b6fd7). RED diagnostics: six expected missing-code/diagnostic failures (trc_6a494c2540f6). GREEN full focused suite: 93 passed, 609 assertions, six files, gateway contracts enabled (trc_b8d37c813f2b). Review against origin/main passed static rules, eslint, typecheck, spec compliance, and documentation checks with zero issues (trc_ad99515bb14f).

Deployment remains pending. Installed canary remains 0.1.107. Free D1 quota already exhausted: writes cannot recover before the next 00:00 UTC reset unless Ko independently authorizes a paid plan. No payment action performed. Actual existing ChatGPT connector acceptance is still required after recovery.

- 2026-09-07 18:10:06 append: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`

- 2026-09-07 18:11:26 apply-patch: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`

- 2026-09-07 18:14:13 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`

- 2026-09-07 18:17:04 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-07 18:17:22 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-09-07 18:19:21 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-09-07 18:19:21 apply-patch: `packages/workspace/tests/test-selection.test.js`

## Publish gate recovery and final local verification

Full legacy facade verify initially failed because the new regression lacked an explicit test-selection mapping and selected the known historically red package-wide Vitest suite. Added the regression to the existing exclusive hosted-site reconciliation rule, preserving every existing selected suite, and added a selector regression. Selector RED trc_99d4eca29524, GREEN trc_372a8850804f. The SQLite regression requires native Bun test; a dedicated required suite uses bun test from repository root. Regenerated registry with the checked-in generator.

Final verify against origin/main PASSED, publishValid=true, full mode, trace trc_5d12356472d5. Static review and DB guards passed with zero issues. Scope includes heartbeat/authority fixes, four test files, and explicit test-selection rule/generated registry/selector regression. No unrelated failing test implementation changed.

Cloudflare whoami confirms operator auth; authority deployment dry-run passed (trc_e1bb3a6449c1). Live authority has newer default snapshot variables and managed-cloud pricing variables absent from source config; deployment must preserve those remote variables. Prior deployed authority version: 539d132b-db11-4a72-a156-4c2d24b90e04. No schema migration required.

- 2026-09-07 18:20:09 append: `.task/os/repair-recurring-chatgpt-mcp-connection-failures/workpad.md`
