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

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 04:03:04 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
- 2026-08-15 04:03:54 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`
- 2026-08-15 04:05:15 fs.write: `.task/os/hotfix-production-launcher-snapshot-without-stream-only-stripe-changes/workpad.md`

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
