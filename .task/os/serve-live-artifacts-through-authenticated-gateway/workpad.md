# Serve live Artifacts through authenticated gateway

branch: `task/os/serve-live-artifacts-through-authenticated-gateway`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2182/serve-live-artifacts-through-authenticated-gateway
github pr: https://github.com/consuelohq/opensaas/pull/2182
started: 2026-08-26

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

- 2026-08-26 02:00:36 fs.write: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`
- 2026-08-26 02:01:43 fs.write: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`
- 2026-08-26 02:05:45 fs.write: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`
- 2026-08-26 02:13:29 fs.write: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`
- 2026-08-26 02:15:20 fs.write: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 02:02:10 `review.run`: passed — OK
- 2026-08-26 02:02:20 `verify`: failed — COMMAND_FAILED
- 2026-08-26 02:05:37 `verify`: passed — OK
- 2026-08-26 02:13:42 `review.run`: passed — OK
- 2026-08-26 02:13:51 `verify`: passed — OK

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

behavior under test: The workspace edge must serve `/artifacts` and nested artifact routes through the authenticated live `artifacts-sites-read-layer`, not a stale public site snapshot. Artifact publication should remain local/catalog-backed so scheduled reports become visible without an R2/D1 republish, and unauthenticated requests must not disclose artifact contents.
existing local pattern: Diffs already use a public-site route backed by a `consuelo-gateway-service`; Artifacts already has a signed `/gateway/artifacts` service and local Hono routes for `/artifacts` + nested content.
new or changed tests: add/adjust workspace edge route-seed and integration coverage proving `/artifacts` resolves to a workspace-session `consuelo-gateway-service`, nested `/artifacts/...` requests proxy to the node, and install snapshot publication no longer uploads an Artifacts snapshot.
focused red command: `bun test packages/os/tests/workspace-edge-sites-gateway-integration.test.ts packages/os/tests/install-edge-site-publisher.test.ts`
expected red failure: current seed resolves `/artifacts` to a public `site-snapshot` and current install publisher includes/uploads the Artifacts snapshot.
no-test waiver: not applicable

- 2026-08-26 02:00:36 append: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/scripts/gh.js`
- `packages/workspace/scripts/lib/db-guards.js`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/os-release-install.ts`
- `packages/workspace/scripts/os-release-workspace-edge.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/scripts/verify.js`

## Red / green evidence

- RED: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/workspace-edge-sites-gateway-integration.test.ts tests/install-edge-site-publisher.test.ts` failed because `/artifacts` resolved to a public `site-snapshot`, nested artifact routing did not reach the node, and the install publisher required/uploaded an Artifacts snapshot.
- Implementation: removed `/artifacts` from snapshot routes/install snapshot publishing; added `/artifacts` as a `workspace-session` `consuelo-gateway-service` route using `artifacts-sites-read-layer`; retained signed `/gateway/artifacts`.
- GREEN: same focused command passes 23/23 tests (364 expectations), trace `trc_8515631bb28e`.
- Security property: unauthenticated nested artifact requests are rejected before node contact; authenticated requests preserve the full nested path and proxy through signed node headers.

- 2026-08-26 02:01:43 append: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`

## Full verification

- The selected rollout suite initially caught three stale route-seed expectations; those contracts were updated so existing Artifacts snapshots are migrated away rather than preserved, while unrelated user-published Docs snapshots remain preserved.
- Focused route preservation suite: 26/26 tests pass, trace `trc_05c04bb4c72e`.
- Full task safety gate: review, registry-selected tests, Workspace Edge dry run, and DB guard all pass; publish-valid stamp written, trace `trc_8180d7b7fac7`.
- Live rollout caveat observed during investigation: a manual D1 `/artifacts` gateway route was reconciled away by the currently installed node heartbeat because installed code still advertises the old route set. Durable publication therefore requires this route-seed change to be installed before claiming the live Artifacts surface is fixed.

- 2026-08-26 02:05:45 append: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`

## Rollout compatibility

The initial route-seed fix requires every node heartbeat producer to run the new runtime before `/artifacts` remains in D1. A manual D1 gateway route proved that an older heartbeat removes the new control-plane route. To make the rollout safe with mixed node versions, the Workspace Edge router now treats `/artifacts` and nested paths as an alias to the already-existing private `/gateway/artifacts` route when that route resolves to `artifacts-sites-read-layer` with `workspace-session` auth. This overrides legacy public Artifacts snapshots at request time while preserving the full inbound artifact path to the node.

- RED: legacy public snapshot fixture returned 200 instead of the required 401/private live route, trace `trc_79d2a1f9ab36`.
- GREEN: both new/live and legacy Artifacts cases pass, trace `trc_8ee21344586a`.
- Broader edge regression: 55/55 tests pass across edge router, Artifact redirects, Sites/Gateway integration, and node proxy, trace `trc_57e8472d8d44`.
- The attempted signed dev-runtime workflow run `32921598861` was blocked by pre-existing distribution regression instability (CI test timeouts; local rerun also exposed an unrelated Caddy worker-port assertion). No runtime bundle was published from that failed run; this task does not bypass that release gate.

- 2026-08-26 02:13:29 append: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`

## Live publication evidence

- Workspace Edge compatibility fix deployed directly from verified task commit `3c120fa24a`; Cloudflare Worker version `7c949c80-cdcb-4972-9688-f43c4c08212b`, trace `trc_f0420ba96cd8`.
- Production unauthenticated verification now treats both `/artifacts` and nested dated artifact URLs as private live routes: JSON requests return 401 `workspace_session_required`; browser HTML requests redirect to the Google web login with the exact artifact `return_to`, trace `trc_614b6d6186b2`. The legacy public snapshot is no longer served.
- D1 currently retains the durable legacy-compatible `/gateway/artifacts` route as `workspace-session` -> `consuelo-gateway-service` -> `artifacts-sites-read-layer`, trace `trc_0adb0b9add74`. The Edge compatibility alias therefore survives old node heartbeats.
- Local canonical artifact catalog is populated: 39 entries; `/daily-schedules` has 49 versions; latest self-healing workpad/report are dated 2026-08-25 and latest security workpad/scan are dated 2026-08-24, trace `trc_fc5bad93d580`.
- Agent browser reached the expected Google auth boundary but its isolated profile requires a password, so authenticated visual verification was intentionally not forced. Existing user browser sessions should render the live archive after refresh/sign-in.

- 2026-08-26 02:15:20 append: `.task/os/serve-live-artifacts-through-authenticated-gateway/workpad.md`
