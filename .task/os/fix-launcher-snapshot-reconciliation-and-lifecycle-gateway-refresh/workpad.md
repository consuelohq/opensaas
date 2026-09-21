# fix launcher snapshot reconciliation and lifecycle gateway refresh

branch: `task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2005/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh
github pr: https://github.com/consuelohq/opensaas/pull/2005
started: 2026-08-15

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

- 2026-08-15 03:36:11 fs.write: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`
- 2026-08-15 03:37:31 fs.write: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`
- 2026-08-15 03:38:41 fs.write: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`
- 2026-08-15 03:41:39 fs.write: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`
- 2026-08-15 03:48:02 fs.write: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`
- 2026-08-15 04:00:39 fs.write: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 03:54:36 `review.run`: passed — OK
- 2026-08-15 03:55:02 `review.run`: passed — OK
- 2026-08-15 03:55:34 `review.run`: passed — OK
- 2026-08-15 03:56:48 `verify`: failed — COMMAND_FAILED
- 2026-08-15 04:00:21 `verify`: passed — OK

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

## Test-first contract

behavior under test:
1. Routine signed workspace-node heartbeat/reconciliation may update node/control-plane routing but must preserve the currently published `site-snapshot` routes and version IDs. Only an explicit release/publish refresh may replace launcher/static-site snapshots.
2. `consuelo restart` and `consuelo update` must have an explicit, testable lifecycle contract covering every runtime/gateway surface they own; a successful lifecycle operation must not leave Workspace Edge, Device Authority/auth, local OS gateway, or materialized launcher/static-site state incoherent or stale.
3. Existing security boundaries remain unchanged: Google/web auth handoff, operator-dashboard Access denial, MCP OAuth/bearer requirements, workspace-session protection, and node routing/isolation.

existing local pattern: `cloudflare-d1-route-registry.test.ts`, `workspace-nodes`/Device Authority tests, lifecycle engine/facade/native lifecycle tests, release-surface tests, and Workspace Edge integration contracts.
new or changed tests: first add a focused heartbeat/site-snapshot preservation RED; after lifecycle audit, add the narrowest restart/update coverage contract that demonstrates the missing gateway refresh/restart behavior.
focused red command: to be selected after bounded source/test inspection; run before implementation.
expected red failure: heartbeat reconciliation currently refreshes site snapshots from Device Authority defaults and replaces a newer published launcher route; lifecycle RED should expose whichever gateway/materialization step is omitted by restart/update.
no-test waiver: not applicable.

- 2026-08-15 03:36:11 append: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`

## Runtime evidence before edits

- Live remote D1 row for `internal.consuelohq.com` at 2026-08-15 03:36:54 shows the regression is active now. `/` launcher and most workspace-session site routes are pinned to stale `sha256-15c3f6f5c611b43c`; `/artifacts` and `/docs` still retain newer `sha256-b76d63518c30f912`. The mixed versions prove a routine reconciliation is selectively rewriting release-managed snapshot routes rather than a browser cache issue. Evidence trace: `trc_390f8f684985`.
- The D1 row `updated_at` advanced during the investigation without any release/deploy mutation, matching the 30s node heartbeat cadence.
- Source cause is direct: `reconcileWorkspaceRouteState()` calls `upsertWorkspaceNodeTargetInD1(... refreshSiteSnapshots: true)` on every signed heartbeat. The registry already supports the correct safe default (`refreshSiteSnapshots` false/omitted), so the fault is the heartbeat caller, not the preservation primitive.
- Cloudflare deployment adapter `deployment.list` is still unavailable with `MALFORMED_OUTPUT` (`trc_2d818721d88a`); direct provider reads remain available through bounded Wrangler diagnostics.

## Focused RED

new test: add a signed-heartbeat integration contract in `packages/os/tests/workspace-node-registry-routing.test.ts` that starts with a newer published launcher snapshot, gives Device Authority an older default snapshot, sends a valid heartbeat, then asserts `/mcp` is reconciled while `/` still resolves to the newer published snapshot.
focused red command: `bun --cwd packages/os x vitest run tests/workspace-node-registry-routing.test.ts -t "preserves a newer published launcher snapshot during signed heartbeat reconciliation"`
expected red: current heartbeat reconciliation replaces the newer launcher snapshot with the Device Authority default because it passes `refreshSiteSnapshots: true`.

- 2026-08-15 03:37:31 append: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`

## RED result

- Focused heartbeat regression failed exactly on the intended invariant: after a valid signed heartbeat, launcher `/` changed from `sha256-newer-launcher` to Device Authority's stale default `sha256-stale-default` while the heartbeat itself returned 200. Trace: `trc_f293dc4a83ff`.
- The first test invocation had invalid Bun CLI syntax and did not exercise product code (`trc_dc3f7fafd277`); the corrected `bunx vitest` invocation produced the real RED above.

- 2026-08-15 03:38:41 append: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`

## Heartbeat preservation GREEN

- Removed `refreshSiteSnapshots: true` from routine `reconcileWorkspaceRouteState()` node reconciliation; the D1 primitive still supports explicit snapshot refresh for release/publish operations.
- Focused regression passed, then the complete `workspace-node-registry-routing.test.ts` suite passed 41/41. Trace: `trc_eccbfbc72936`.
- This stops ordinary signed heartbeats from mutating launcher/static-site publication state while preserving `/mcp` node/connector reconciliation.

- 2026-08-15 03:41:39 append: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`

## Lifecycle and release propagation hardening

- Lifecycle RED `trc_cbd4d118202d` proved three omissions: restart skipped service preflight, same-version update skipped local service restart/health, and active-daemon same-version update never handed off to the durable lifecycle worker. Focused GREEN `trc_bcd1284da952` now covers all three.
- Local gateway RED `trc_1e8748c24c4d` proved completed macOS/Linux restart only restarted the main OS service. GREEN `trc_99180dbf1aa5` now reloads/restarts installed local gateway sidecars (Caddy/Portless/watchdog/availability, Cloudflared connector, node heartbeat; Linux also forces an immediate heartbeat after timer restart).
- Explicit release-managed snapshot refresh RED `trc_0e338d99bd48` established the missing publication primitive. GREEN `trc_2b83b23d4d86` proves a D1 refresh can advance only release-managed private Site routes while preserving connector/default-node state and user-published Artifacts/Docs.
- Device Authority release RED `trc_edb209cf6c2a` proved the canonical release uploaded/deployed snapshots but did not propagate them into existing D1 workspace rows. GREEN `trc_3e0737ed7395` now proves release order is: upload snapshots -> deploy Device Authority -> refresh release-managed D1 Site routes -> live verification. Dry-run plans the route refresh without mutating D1.

- 2026-08-15 03:48:02 append: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`

## Final verification

- Test-selection ownership was repaired so lifecycle service/platform gateway changes are covered by the focused critical lifecycle suite rather than the historically red broad OS package suite. RED: `trc_536c51b4a1cc`; generated registry + focused GREEN: `trc_2a3facd1a383`.
- Complete selected-suite run passed with no failed suites: `trc_af23e2ea1253`.
- Formal full verify passed and is publish-valid, including strict review with 0 blocking issues and the database-script guard warning reviewed as nonblocking: `trc_4bc63b880ffd`.
- One nonblocking docs opportunity remains for installation/configuration pages; the public CLI lifecycle contract was updated and documentation validation already passed.

## Production release blocker outside this patch

- Canonical Device Authority release readiness currently refuses deployment because production has synthetic Stripe secret names for secret key, webhook secret, and legacy workspace IDs, while current stream code requires the new account-ID tuple. This is a deliberate fail-closed release gate, not bypassed here. Safe presence evidence: `trc_8c3b5350c2f5`; release dry-run blocker: `trc_99ab90d15197`.
- Do not weaken that guard or guess/copy opaque secret values. Code can land independently; production Device Authority publication requires the Stripe synthetic configuration to be reconciled safely first.

- 2026-08-15 04:00:39 append: `.task/os/fix-launcher-snapshot-reconciliation-and-lifecycle-gateway-refresh/workpad.md`
