# Task node affinity

## Scope
Bind task sessions to the Consuelo node that created them and make central MCP routing honor that owner independently of workspace-default changes.

## Acceptance criteria
- [x] A successful `task.start` binds the returned `taskSession` to the resolved node that executed it.
- [x] Later `os.call` requests carrying that `taskSession` route to the bound owner even if the workspace default node changes.
- [x] An explicit `nodeId` that conflicts with a task owner fails closed before any upstream execution.
- [x] If the owner node is offline/revoked/unroutable, routing returns the existing node availability error and never falls back to another node.
- [x] A successful `task.finish` retires the central task affinity; failed finishes leave the binding intact.
- [x] Failed/invalid `task.start` results never create an affinity binding.
- [x] Affinity is account/workspace scoped so the same task handle cannot affect another workspace.
- [x] Existing default/explicit node routing, OAuth scopes, edge signing, stateless MCP, and facade input isolation remain unchanged.

## Implementation
- Added `WorkspaceTaskAffinity` to the central device-authority store: account/workspace + `taskSession` -> `ownerNodeId`.
- Durable claims/releases use storage transactions. A second claim by another node returns a conflict instead of silently reassigning ownership.
- Extended MCP node-routing inspection with `taskSession` and facade-tool metadata while leaving both routing selectors outside nested tool input.
- Routing precedence is now: existing task owner -> agreeing explicit selector -> explicit selector -> workspace default.
- Conflicting explicit `nodeId` + task owner returns `TASK_NODE_MISMATCH` before upstream execution.
- Successful `task.start` responses bind the returned task session to the node that executed the start.
- Successful `task.finish` releases the binding; failed finishes retain it.
- Successful calls using a previously unbound task session lazily establish affinity on the node that actually handled them, providing a conservative migration path for older task sessions.
- Task-owned routes propagate `routeSource: task` into the existing routing/trace metadata. No new observability system was introduced.
- Local task/worktree metadata was not changed; `taskSession` remains a resource handle, not authorization.

## Files changed
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/scripts/lib/mcp-node-routing.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- task metadata/workpad files under `.task/os/task-node-affinity` and `.task/tasks/os`

## Test evidence
- TDD red: default-node change originally routed the follow-up task call to `node-member` instead of task creator `node-home`.
- `workspace-node-registry-routing.test.ts`: 34/34 passed after implementation.
- Security/routing regressions: `mcp-gateway.test.ts` + `tool-scope-authorization.test.ts`: 31/31 passed.
- `mcp-gateway-action-scopes.test.ts` under Bun: 11/11 passed.
- `trace-persistence.test.ts`: 11/11 passed.
- `os-get-steering-trace.test.ts`: 17/17 passed.
- Cloudflare device-authority Wrangler deploy dry-run passed; no deployment performed.
- `git diff --check` passed.
- Strict `review.run`: 0 issues from this branch, 0 blocking findings; two unrelated pre-existing `twenty-sdk/cli` type-resolution findings.

## Failure-mode coverage
- Default changes do not move an active task.
- Explicit node/task-owner conflicts fail before proxying.
- Offline task owners do not fall back to another online node.
- Successful finish clears ownership; failed finish preserves ownership.
- Failed starts do not bind returned/partial task sessions.
- Durable claims reject cross-node reassignment and keep workspaces isolated.
- `routeSource: task` reaches the node on affinity-routed calls.

## Issues / recovery
- First `task.start` attempt omitted `area` and failed validation without side effects; retried correctly and created task PR #1888 / `tsk_04ae093beb6c`.
- A read-only scanner referenced a non-existent device-authority `index.ts`; reran targeted reads against actual route/worker files.
- A read-only manifest probe used an obsolete manifest path; scope behavior was read from `tool-scope-authorization.ts` instead.
- Initial workpad overwrite omitted the required `force` flag; retried safely.
- The first inserted test block retained escaped backticks from a raw string; fixed the test source and reran the full suite.
- A later route-source assertion initially placed its local accumulator in the wrong test, causing one expected test failure; moved the declaration into the affinity test and restored 34/34 green.
- A mixed root-level Vitest regression command used the wrong cwd/runtime for several suites (`bun:test`, Bun SQLite, fixture-relative paths). Each affected suite was rerun with its canonical package/runtime and passed.
- Two heavy parallel verification batches hit transient OS MCP network errors and were rerun as smaller canonical checks after the connection recovered.
- `packages/os/scripts/check-syntax.js` exceeded a 120s wrapper timeout without output. Wrangler dry-run, targeted suites, strict review, and the canonical full `verify` gate are used as the authoritative final checks.

## Concurrency / branch state
- Branch 8 is merged to `main`; its old worktree/branch is intentionally untouched.
- GitHub compare reports this task branch is ahead of `main` by only its bootstrap commit and behind by 0 before publishing working-tree changes.
- `task.ensureSynced` reports `stream/os` itself needs synchronization; do not silently mutate the shared stream while parallel agents are active. Task publishing should use the repository lifecycle tooling and reconcile the current stream before integration.

## Status
Implementation complete. Focused tests and strict review are green. Full `verify` and publish/integration remain.

- 2026-08-12 14:38:26 write: `.task/os/task-node-affinity/workpad.md`

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/scripts/lib/mcp-node-routing.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-12 14:38:26 fs.write: `.task/os/task-node-affinity/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 14:39:01 `verify`: passed — OK
- 2026-08-12 14:41:57 `verify`: passed — OK
- 2026-08-12 14:49:36 `verify`: passed — OK

## Publish readiness
- Working-tree changes were published to task PR #1888 as commit `83e874cd16154a7425c0e79f5626cd64f7f0694e`.
- Canonical full verify completed after the focused suites with `publishValid: true`; no branch-owned blocking review findings were reported.
- No Mac, cloud node, Cloudflare Worker, or runtime deployment was performed. This PR changes source/control-plane behavior only.
- Integration must preserve other agents' parallel stream work; use the task/stream lifecycle tooling rather than force-updating shared refs.

## workspace-owned: files read

- none yet

## Implementation checkpoint
Branch 9 is implemented and verified: task ownership is centrally bound on successful start, honored across default-node changes, rejected on explicit-owner conflicts, and released only after successful finish. Focused routing/security tests, strict review, Wrangler dry-run, and full verify are green. No runtime was deployed.
## Stream reconciliation
- Before integration, `stream/os` had advanced with the parallel node-observability branch and conflicted in MCP/trace seams.
- Reconciled `origin/stream/os` into this task semantically: Branch 9 task-affinity routing was preserved while the parallel branch's resolved-node-name and trace-routing propagation were also preserved.
- Post-reconciliation validation: task-affinity routing 34/34, merged MCP/trace/observability regression set 61/61, MCP action-scope tests 11/11, Wrangler device-authority dry-run passed, and full `verify --base stream/os` returned `publishValid: true` with 0 branch/review issues.
- The reconciliation merge commit is `3eb9d036ea26dc2ee1ba8a4447afc8f83ef3f45d`; no runtime or Cloudflare deployment was performed.
