# reconcile hosted sites after Consuelo update

branch: `task/os/reconcile-hosted-sites-after-consuelo-update`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1911/reconcile-hosted-sites-after-consuelo-update
github pr: https://github.com/consuelohq/opensaas/pull/1911
started: 2026-08-13

## acceptance criteria

- [x] `/diffs` is owned by the authenticated `consuelo-gateway-service` route after install/update reconciliation; a reserved/static Diffs snapshot cannot win route resolution.
- [x] The launcher continues to link to the same-origin `/diffs` path only; it contains no node ID, connector, tunnel, or local address routing logic.
- [x] Hosted route state never leaves a legacy logical workspace alias such as `internal` as `defaultNodeId` when real enrolled active node targets exist. A valid explicit enrolled default node is preserved across transient offline periods.
- [x] Successful `consuelo update` reconciles the hosted workspace route record after the new runtime is healthy, without allowing regenerated local Sites placeholders to replace dynamic gateway routes.
- [x] Launcher, Nodes, Diffs, and Observability route state is reconciled as one release-coherent workspace route record rather than independently drifting surfaces.
- [x] Re-running hosted reconciliation is idempotent: a correct gateway route/default-node state remains correct and does not regress to a reserved snapshot.
- [x] Existing connector/node target state and explicit user-selected valid default nodes remain preserved.
- [x] No production Cloudflare or release mutation is performed in this task; central deployment/release happens only after Branch 12 and this task are integrated.

## plan

1. Inspect lifecycle update completion, Sites materialization/publisher, edge route merge/precedence, and node heartbeat/default-node paths from current `main`.
2. Inspect PR #1910 and #1909 file overlap before choosing production edit seams.
3. Add focused red contracts for hosted route reconciliation, stale legacy default-node normalization, and update idempotency/release coherence.
4. Implement the smallest shared reconciliation primitive and call it from the appropriate successful lifecycle/update path without coupling the launcher to node routing.
5. Run focused tests/typechecks, inspect the diff, run strict review + full verify, then push PR #1911 and promote it into `stream/os` if integration is conflict-free.

## Test-first contract

- Route contract: given a stale record where `/diffs` is a `site-snapshot`, reconciliation must produce exactly one active `/diffs` owner and it must be the authenticated Diffs gateway route.
- Preservation contract: connector routes, node targets, and a valid explicit enrolled `defaultNodeId` survive snapshot/release reconciliation.
- Legacy-default contract: if `defaultNodeId` names no enrolled active node target (including legacy workspace-slug aliases), reconciliation selects a real active enrolled target deterministically; it does not switch away from a valid enrolled default merely because that node is temporarily offline.
- Lifecycle contract: successful update activation invokes hosted reconciliation only after local runtime health succeeds; failure remains visible/fail-closed according to lifecycle policy.
- Idempotency contract: applying reconciliation twice to the same installed release and node state yields equivalent route ownership/default-node/revision state.
- Launcher contract: generated launcher href remains `/diffs` and contains no node-specific transport data.

## discovery evidence

- Live `https://internal.consuelohq.com/diffs` currently renders `RESERVED SITES PAGE`.
- Runtime steering reports current node `node_F3Wsfd-vJrKkYlfi` online while `defaultNodeId` is legacy `internal`, which is not the current enrolled node identity and is offline.
- `workspace-edge-route-seed.ts` on current `main` already creates `/diffs` as `consuelo-gateway-service` with `workspace-session` auth and does **not** list `/diffs` in `SITE_SNAPSHOT_ROUTES`.
- `install-edge-site-publisher.ts` publishes launcher/artifacts/traces/docs/configuration/tools/nodes/environments/secrets snapshots and excludes Diffs from `snapshotSites`; therefore the observed reserved Diffs page indicates hosted route state was not reconciled to current code.
- Route resolution uses longest `pathPrefix`, so a stale exact `/diffs` snapshot remains authoritative until the D1 record is rewritten/reconciled.
- Existing route seed SQL preserves connector/node metadata, but it currently preserves `defaultNodeId` verbatim and has no normalization when that ID is a stale legacy alias.

## current status

- Implementation complete in the isolated task worktree; no production Cloudflare/D1/release mutation has been performed.
- Hosted D1 node reconciliation now treats current connector/gateway/redirect routes as authoritative by path while preserving published static snapshots. A stale static `/diffs` route is replaced by the authenticated Diffs gateway instead of surviving indefinitely.
- Signed heartbeat reconciliation normalizes a stale legacy `defaultNodeId` to a real enrolled active node and persists the repair. Valid explicit enrolled defaults remain stable even when temporarily offline.
- An already-current `consuelo update` now still runs connector readiness, forcing signed hosted reconciliation; `update --check` remains side-effect free.
- The activated runtime already refreshes managed Sites before supervisor startup. The publisher keeps launcher, Nodes, and Observability on one aggregate static snapshot version while Diffs remains dynamic, so this task reuses that existing release-coherence model rather than inventing a second revision system.
- Branch 12 PR #1910 is now merged into `stream/os` at stream head `87348ad306d277ef45ce61f876506dab2e7649c7`; its operator-login/runtime test fixes and focused verification ownership are available for integration.
- Focused product contracts, actual OS typecheck, and strict review are green. The previous full-verify blocker has been fixed on `stream/os`; this task is now being reconciled with that stream before rerunning the publish gate.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- task metadata/workpad files under `.task/os/reconcile-hosted-sites-after-consuelo-update/`

## workspace-owned: files changed

- `.task/os/reconcile-hosted-sites-after-consuelo-update/workpad.md`

## workspace-owned: activity log

- 2026-08-13 19:13:49 fs.write: `.task/os/reconcile-hosted-sites-after-consuelo-update/workpad.md`
- Task started from current `main` because `stream/os` was 48 commits behind and Branch 12 is proceeding in parallel.
- Verified current live `/diffs` placeholder and current runtime default-node mismatch before code edits.

## workspace-owned: validation evidence

- Red phase: stale-default heartbeat contract failed because `defaultNodeId` remained `internal`; D1 route contract initially exposed the missing canonical-gateway reconciliation seam.
- `tests/lifecycle-engine.test.ts`: 59 pass / 0 fail, including already-current update reconciliation and read-only `--check` behavior.
- `tests/workspace-node-registry-routing.test.ts`: 40 pass / 0 fail, including stale-default repair and stable valid-default preservation.
- `tests/cloudflare-d1-route-registry.test.ts` + `tests/install-edge-site-publisher.test.ts` with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`: 17 pass / 0 fail.
- `tests/workspace-edge-route-seed-contract.test.ts` with gateway contracts enabled: 9 pass / 0 fail.
- `tests/launcher-onboarding.test.ts` + `tests/launcher-astro-source.test.ts`: 5 pass / 0 fail.
- `tests/daemon-bun-path.test.ts`: 4 pass / 0 fail, proving activated-runtime managed Sites refresh occurs before supervisor startup and is bounded/best-effort.
- `bun run typecheck` from `packages/os`: exit 0, `workspace script syntax checks passed` (trace `trc_aff3f4daa356`).
- Safety preflight found no destructive command literals in the focused test files before execution.
- Strict `review.run --base origin/main --strict`: 8 changed product/test files, 0 blocking findings, 0 pre-existing findings (trace `trc_4bda1d96b3f1`).
- Full `confirm --verify`: task-specific critical workspace-edge publisher/route suites passed (7 publisher tests + 23 route/integration tests), DB guard passed with 0 risks/findings, but the broad `@consuelo/os package test` exited 1 on the pre-existing `tests/operator-login.test.ts` unhandled-rejection issue. Publish-valid stamp was correctly withheld (trace `trc_cc344d998324`).
- 2026-08-13 19:35:14 `review.run`: passed — OK

## key decisions

- Keep launcher routing same-origin and node-agnostic; repair hosted control-plane state instead.
- Treat a valid enrolled default node as user intent even if temporarily offline. Normalize only defaults that do not identify an active enrolled node target.
- Do not publish Diffs as a static snapshot. Its local reserved file may remain a local Sites slot, but hosted `/diffs` must be gateway-owned.
- Keep this task separate from Branch 12 and integrate through `stream/os` after both focused gates pass.
- Reuse the existing aggregate static Sites `versionId` as the static-surface coherence identity. Heartbeat reconciliation preserves those already-published versioned snapshots and refreshes only control-plane route authority; it does not use Device Authority's fallback snapshot to republish static surfaces.
- Keep public updates free of Cloudflare operator credentials. `consuelo update` heals hosted authority through the existing signed heartbeat/connector-readiness path.

## notes for ko

- Current `main` already has the correct Diffs gateway route definition. The missing behavior is update-time hosted reconciliation plus stale default-node repair.
- PR #1910 overlaps only a small heartbeat hunk in `workspace-nodes.ts`; the D1 merge, connector reconciliation service, and lifecycle-engine changes are otherwise isolated for normal stream integration.

## improvements noticed

- Hosted reconciliation should expose revision/default-node/route-authority diagnostics so future `consuelo status` can prove local and hosted state agree.

## issues and recovery

- `explore "default node routing"` was noisy; exact `defaultNodeId` source search is required before implementation.
- Full verify remains blocked by the same unrelated operator-login test defect that blocked Branch 12. PR #1909 does not contain that fix; its changed files are lifecycle/native-platform surfaces only. This task must wait for the parallel cleanup branch to land, then sync and rerun `confirm --verify` rather than bypassing the gate.
- 2026-08-13 integration recovery: GitHub comparison showed #1911 was created from a newer `main` commit and therefore inherited an unrelated earlier Caddy/MCP commit (`c7dfc7fc...`) not yet present on `stream/os`. The remote PR currently shows 16 unrelated files from that ancestry. Do not promote that polluted net diff. Preserve the existing PR, merge current `stream/os` into the task branch, then restore those inherited unrelated files to the stream version so the final PR contains only reconciliation changes. No force push/reset/clean is allowed.
- `stream.sync` was attempted and correctly refused because the shared `stream/os` worktree contains unrelated agents' uncommitted/conflicted changes. That shared worktree must remain untouched; task integration will happen entirely in the isolated #1911 worktree/GitHub task flow.
- A validation-generated `packages/os/tests/facade/__snapshots__/facade.test.ts.snap` change was confirmed outside #1911 scope and restored only in this task worktree before publish.

- 2026-08-13 19:13:49 write: `.task/os/reconcile-hosted-sites-after-consuelo-update/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/lifecycle/connector-readiness.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/managed-user-content-release.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-13 19:57:10 apply-patch: `.task/os/reconcile-hosted-sites-after-consuelo-update/workpad.md`