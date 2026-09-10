# make managed cloud nodes execution ready

branch: `task/os/make-managed-cloud-nodes-execution-ready`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2251
started: 2026-08-28

## acceptance criteria

- [x] Node presence is distinct from execution readiness; registered nodes report runtime release/protocol identity and public-MCP readiness.
- [x] Steering and the Nodes control-plane surface expose node OS version/channel/protocol/readiness without exposing secrets.
- [x] Explicit node routing consumes routing-only metadata before forwarding to the selected node, and incompatible/not-ready nodes fail with structured errors instead of an opaque downstream 400.
- [x] `os.call` transport timeout stays transport metadata and never becomes typed `session.start` input.
- [x] Existing task/work session node affinity is preserved and remains the authority for subsequent task-scoped routing; no duplicate affinity system was added.
- [ ] Follow-up: define an environment-to-credential binding contract and task environment selector before connecting the credential broker to task startup.
- [x] Managed cloud provisioning now requires public-MCP readiness. Power-management policy remains a separate lifecycle feature because the current provider abstraction does not own it.
- [x] Focused changed-surface tests are green after refreshing from `stream/os`: 7 files / 121 tests.

## plan

1. Re-read current main implementations for heartbeat/node registry, MCP proxy/facade envelope, session/task execution, credential broker/environment control plane, and managed-cloud lifecycle.
2. Identify the narrowest existing tests for each boundary and freeze exact test-first contracts before production edits.
3. Implement routing/readiness/version correctness first, then task ownership and credential resolution, then lifecycle start/idle-stop only if the existing managed-cloud service already has the necessary ownership boundary.
4. Run focused green tests, inspect the diff, run strict review/verify, then promote through `stream/os` if publish gates are credible.

## files changed

- none yet

## key decisions

- Branch from current `main` because `stream/os` was 31 commits behind. A clean sync merge was produced, but the sync gate refused to push due unrelated broad package-test CWD failures; critical lifecycle suites passed.
- Keep presence, readiness, lifecycle state, and release compatibility as separate node concepts.
- Do not copy `.env` or credentials between nodes. Credential resolution must remain node-local and fail closed.
- Reuse the heartbeat's existing signed public MCP probe as the readiness source of truth and report that result back to Device Authority.
- Reuse the existing task/work affinity system in Device Authority; the repair is routing-envelope compatibility, not a second affinity implementation.
- Consume outer `nodeId` as routing metadata before proxying while preserving nested domain `input.nodeId`.
- Carry outer `timeout` as executor metadata instead of adding it to the selected tool's typed input.
- Explicit targets require known-compatible protocol identity and `ready` execution state. Non-explicit legacy routes tolerate unknown telemetry during rollout but block known incompatible/not-ready nodes.
- Credential execution is deferred until OS defines a first-class environment selector plus environment-to-binding policy; the existing node-sealed broker remains the correct custody primitive.
- Managed-cloud power policy is deferred because the provider client currently has no power-down operation, activity model, or scheduler boundary.
- PR #2251 was updated with the latest `stream/os` before publish validation. Five timeout/facade conflicts were resolved by keeping the newer stream implementation because it already carries timeout as typed execution metadata; this task no longer duplicates those files.

## notes for ko

- `cloud-1` is currently present but not execution-ready; this task is intended to make that distinction first-class and remove the stale-node ambiguity.
- No live cloud node has been updated by this branch yet; runtime behavior changes only after the relevant OS and edge release is deployed.

## improvements noticed

- The broad `@consuelo/os` package test has worktree/CWD assumptions that can block `stream.sync` even when critical lifecycle suites pass. This is pre-existing and out of scope unless it blocks final promotion.

## errors i ran into

- `stream.sync` produced a clean merge but did not push because the broad OS package suite failed in unrelated subagent/task-cleanup tests from package-relative CWD assumptions. Critical lifecycle suites passed 219/219 plus syntax and facade contracts.

## Test-first contract — cloud execution readiness

behavior under test:
- routing-only `nodeId` and transport-only timeout never leak into the selected typed tool input;
- node registration/heartbeat carries runtime compatibility identity and readiness independently from presence;
- an incompatible or not-ready explicit node fails closed with a structured error before task execution;
- a task session records and preserves its owning node;
- credential execution remains a follow-up until a first-class environment selector and environment-to-binding policy exist.

existing local pattern:
- Device Authority selects workspace nodes before proxying MCP;
- facade schemas own typed tool input validation;
- heartbeat/node registry already records node capabilities/presence;
- credential broker and sealed node credential store already enforce node-local secret custody;
- session/task lifecycle already persists task metadata and routes task-scoped tools.

new or changed tests:
- existing `packages/os/tests/mcp-gateway.test.ts` coverage from current `stream/os` proves transport timeout is passed as execution metadata and never merged into typed tool input; this task does not duplicate that implementation.
- `packages/os/tests/workspace-node-registry-routing.test.ts`: central proxy consumes routing-only `nodeId`, preserves nested domain `input.nodeId`, persists runtime readiness/release identity, and rejects selecting a known-not-ready default.
- `packages/os/tests/workspace-node-heartbeat-client.test.ts`: signed heartbeat accepts runtime identity/readiness status without leaking local paths or private keys.
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`: one-shot heartbeat reports the public MCP probe result back to authority after probing.
- `packages/os/tests/launcher-nodes-control-plane.test.ts`: safe node snapshot exposes version/readiness while keeping private fields out; default selection requires readiness.
- `packages/os/tests/settings-site.test.ts`: Nodes UI renders release/readiness state and only enables default selection for execution-ready nodes.
- `packages/os/tests/os-get-steering-trace.test.ts`: steering projects version/channel/protocol/readiness for available nodes.

focused red command: `bun x vitest run packages/os/tests/mcp-gateway.test.ts packages/os/tests/workspace-node-registry-routing.test.ts packages/os/tests/workspace-node-heartbeat-client.test.ts packages/os/tests/workspace-node-heartbeat-script.test.ts packages/os/tests/launcher-nodes-control-plane.test.ts packages/os/tests/settings-site.test.ts packages/os/tests/os-get-steering-trace.test.ts`
expected red failure: assertions for executor timeout metadata, sanitized forwarded node routing, second readiness heartbeat, node runtime identity/readiness, readiness-gated default selection, and steering/UI fields fail against current production code.
no-test waiver: not applicable.

green evidence:
- `bun x vitest run tests/mcp-gateway.test.ts tests/workspace-node-registry-routing.test.ts tests/workspace-node-heartbeat-client.test.ts tests/workspace-node-heartbeat-script.test.ts tests/launcher-nodes-control-plane.test.ts tests/settings-site.test.ts tests/os-get-steering-trace.test.ts`
- result after refreshing from `stream/os`: 7 test files passed, 121 tests passed, exit 0.
- adjacent node proxy/materialization: 2 test files passed, 9 tests passed, exit 0.
- `bun run typecheck`: workspace script syntax checks passed.
- `bun run cloudflare:device-authority:deploy:dry-run`: Wrangler bundle/dry-run passed; no deployment performed.
- registry-equivalent native node discovery tests rerun from the correct `packages/os` CWD: 5 files passed, 90 tests passed, exit 0.
- full `verify` review phase passed with 0 blocking findings and DB guard passed with 0 risks/findings.

publish-gate limitation after refreshing from `stream/os`:
- `test-selection` selects five critical native-node suites using root-CWD Vitest commands with `--config packages/os/vitest.config.ts`; each fails before collecting tests because that config resolves `tests/test-environment.ts` from the repository root instead of `packages/os`.
- the same five test files pass 90/90 from the correct package CWD.
- the auto-discovered non-critical `@consuelo/os package test` also remains red on unrelated baseline failures (task-cleanup CWD assumptions, workspace traces 503, and script-parity drift). These are not caused by this task.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-28 23:15:34 write: `.task/os/make-managed-cloud-nodes-execution-ready/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-28 23:15:34 fs.write: `.task/os/make-managed-cloud-nodes-execution-ready/workpad.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/credential-broker.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/environment-control-plane.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lib/managed-cloud-provisioning-runner.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/mcp-node-routing.ts`
- `packages/os/scripts/lib/mcp-protocol.ts`
- `packages/os/scripts/lib/nodes-site.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/verify-run-state.js`
- `packages/os/scripts/lib/workspace-node-config.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/lib/workspace-node-snapshot-cache.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/scripts/session-start.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/nodes-site.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-gateway-node-proxy.test.ts`
- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/lib/review-run-state.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/scripts/verify.js`

## workspace-owned: validation evidence

- 2026-08-28 23:50:42 `verify`: passed — OK
- 2026-08-28 23:50:42 `verify`: passed — OK
- 2026-08-28 23:50:42 `verify`: passed — OK
- 2026-08-29 04:19:15 apply-patch: `.task/os/make-managed-cloud-nodes-execution-ready/workpad.md`
- 2026-08-29 04:21:18 `verify`: failed — COMMAND_FAILED

- 2026-08-29 04:24:43 apply-patch: `.task/os/make-managed-cloud-nodes-execution-ready/workpad.md`