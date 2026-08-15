# hotfix production launcher snapshot without stream-only Stripe changes

branch: `task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2009/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes
github pr: https://github.com/consuelohq/opensaas/pull/2009
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`

## workspace-owned: activity log

- 2026-08-15 04:03:04 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
- 2026-08-15 04:03:54 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
- 2026-08-15 04:05:15 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
- 2026-08-15 04:06:26 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
- 2026-08-15 04:08:35 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:05:40 `review.run`: passed — OK
- 2026-08-15 04:05:59 `verify`: passed — OK

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

behavior under test: a production hotfix based on current `main` must stop signed node heartbeats from overwriting published launcher/static-site snapshots and must make the canonical Device Authority release explicitly advance only release-managed private Site routes after the new snapshot/Worker is deployed. The hotfix must not import stream-only Stripe synthetic checkout code or weaken any release/auth/MCP/dashboard security boundary.
existing local pattern: the same behavior was developed test-first and passed publish-valid verification on task PR #2005 / stream/os. This hotfix intentionally ports only the production-critical subset onto current main because the stream currently contains an unrelated incomplete Stripe synthetic configuration contract that blocks Device Authority release readiness.
new or changed tests: port the already-red/green heartbeat preservation, release-managed D1 refresh, and Device Authority release-order contracts only.
focused red command: run the three focused main-based contracts before porting implementation; current main is expected to fail the newer invariants because it still refreshes Site snapshots on heartbeat and does not propagate release snapshots into existing D1 workspace rows.
expected red failure: heartbeat rewrites a newer launcher to the Device Authority default; release refresh helper/order contracts are absent.
no-test waiver: not applicable.

- 2026-08-15 04:03:04 append: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`

## RED/GREEN evidence

- Ported only the three previously verified regression tests onto current main before implementation. Focused RED `trc_2b6540f1178b` reproduced all intended failures: heartbeat rewrote `sha256-newer-launcher` to the stale Device Authority default; the explicit release-managed D1 refresh export was absent; the Device Authority release neither planned nor executed the post-deploy route refresh.
- Ported only the corresponding production-critical implementation hunks from verified task commit `fa4e1bebe1343e7867620fa5bf2eb5463ea3fb79`: heartbeat preservation in `services/connectors.ts`, release-managed D1 refresh SQL in `workspace-edge-route-seed.ts`, and canonical Device Authority release wiring in `os-release-device-auth.ts`.
- Focused GREEN `trc_e6ec20c4108a`: heartbeat preservation 1/1, release-managed D1 refresh 1/1, Device Authority release planning/order 2/2.
- This main-based hotfix intentionally excludes lifecycle-process files and all stream-only Stripe synthetic checkout/observability files. The full lifecycle/process fix remains landed on `stream/os` via task PR #2005.

- 2026-08-15 04:03:54 append: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`

## Main-based hotfix validation before production mutation

- Broader security/release regression packet passed: workspace-node routing + universal login + internal dashboard + Device Authority architecture = 81/81; Workspace Edge route/site integration = 24/24; Device Authority release contracts = 12/12; syntax checks passed. Trace: `trc_6d084a7300cf`.
- Canonical `os:release-device-auth -- --dry-run` passed on current main-based hotfix and produced release snapshot version `sha256-fb7a9504291a0eb3`. It planned all ten R2 site snapshots, bundled the Worker successfully, and planned the explicit existing-row D1 refresh as `plannedRouteRefresh=workspace_route_registry:sha256-fb7a9504291a0eb3` without remote mutation. Trace: `trc_21a3744f87a5`.
- This confirms the production hotfix can use current main's security/config contract and does not depend on the stream-only incomplete Stripe synthetic configuration.
- During this continuation boundary, two consecutive OS connector calls returned upstream 502 before a third trivial `task.current` succeeded (`trc_a4c1f32e6027`). That is direct evidence of the distinct intermittent transport failure Ko reported; it is not explained by dangerous-material policy because the failing calls contained no policy-sensitive content.

- 2026-08-15 04:05:15 append: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`

## Publish status before production deploy

- Strict review against `origin/main` passed with 0 blocking issues: `trc_7eba37404618`.
- Full verify against `origin/main` passed and is publish-valid: `trc_fa8f5b9d8931`.
- Durable hotfix commit pushed as `1dbdd06fb4a3a5430e2635c3c196f7ee2b821c09`: `trc_ae40d5ea917c`.
- Normal task-to-stream promotion was attempted as required but PR #2009 conflicts with the already-landed equivalent stream implementation, so GitHub refused the merge; no stream mutation occurred. Trace: `trc_eb4918093054`. This is expected branch-history overlap, not a product validation failure. Production deployment proceeds from the publish-valid main-based hotfix worktree so it does not import unrelated stream-only changes.

- 2026-08-15 04:06:26 append: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`

## Production deployment and validation

- Pre-deploy runtime snapshot confirmed the live defect immediately before mutation: release-managed private Site routes, including launcher `/`, were still on `sha256-15c3f6f5c611b43c`; Artifacts and Docs remained independently published on `sha256-b76d63518c30f912`. Auth boundaries were healthy: `/` -> canonical Google start 302, invalid handoff -> Device Authority 400, `/users` -> 403. Trace: `trc_6e8d52631009`.
- The approved canonical production release call returned a generic MCP `Connection failed` to the client. It was not retried. Immediate read-only reconciliation proved the remote release had in fact completed: new Device Authority deployment `0953fee0-e7e8-4bf0-ac95-2bedb5937444`, Worker version `5d1fe46e-e0ae-4795-8edc-30e0cf19945a`, created `2026-08-15T04:06:54.30315Z`, 100% traffic; D1 release-managed routes advanced to `sha256-fb7a9504291a0eb3`; health remained 200. Trace: `trc_5a04aca05906`. This is another concrete instance where connector `mcp_network_error` did not mean the server-side operation failed.
- Heartbeat stability proof after 45 seconds: D1 `updated_at` advanced again to `2026-08-15 04:08:06`, proving normal reconciliation continued, but every release-managed private Site route stayed on `sha256-fb7a9504291a0eb3`. Artifacts/Docs stayed on `sha256-b76d63518c30f912`; `/mcp` and `/gtm` connector ownership/default node were preserved. Root/auth/dashboard/MCP boundaries also remained unchanged. Trace: `trc_efb45797b175`.
- Direct R2 read of the live launcher snapshot proves it is the current launcher: contains Cloud agents, Configuration, Artifacts, Observability, and Code review; does not contain legacy Office or `SITES:` markers. Trace: `trc_c9d1848daf0e`.

## Result

- Production launcher rollback loop is fixed live. Routine node heartbeat no longer owns Site publication; the canonical Device Authority release path owns release-managed private Site advancement.
- Full `consuelo restart` / normal `consuelo update` local-gateway reconciliation hardening remains landed on `stream/os` via PR #2005 / stream review PR #1972 and is not falsely described as main-shipped by this hotfix.
- The intermittent MCP transport/error-contract issue is independently reproduced during this work: two harmless OS calls returned upstream 502 at the continuation boundary, and the production release call returned `mcp_network_error` even though the remote deployment completed successfully. This should be the next transport/observability task, separate from launcher correctness.

- 2026-08-15 04:08:35 append: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
