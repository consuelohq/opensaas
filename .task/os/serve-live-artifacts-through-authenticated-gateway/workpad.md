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

## workspace-owned: validation evidence

- 2026-08-26 02:02:10 `review.run`: passed — OK
- 2026-08-26 02:02:20 `verify`: failed — COMMAND_FAILED
- 2026-08-26 02:05:37 `verify`: passed — OK

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

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/scripts/lib/db-guards.js`
- `packages/workspace/scripts/lib/verification.js`
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
