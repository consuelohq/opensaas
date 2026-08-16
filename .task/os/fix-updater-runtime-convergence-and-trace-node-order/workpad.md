# Fix updater runtime convergence and trace node order

branch: `task/os/fix-updater-runtime-convergence-and-trace-node-order`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2046/fix-updater-runtime-convergence-and-trace-node-order
github pr: https://github.com/consuelohq/opensaas/pull/2046
started: 2026-08-15

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Reproduce why Ko's saved-channel update still served the old tracing page and separate local updater behavior from release-route behavior.
- [x] Bring Ko's currently installed runtime forward immediately, including local Sites materialization.
- [x] Repair the currently stale Cloudflare workspace route so the latest already-published tracing snapshot is reachable through the production route registry.
- [x] Make production release route refresh use the deployed Hono worker's D1 binding instead of requiring the release API token to have direct D1 authority.
- [x] Fail the production release before R2/Worker mutation when the Hono route-refresh credential is unavailable, preventing a new split-brain release.
- [x] Render Node immediately after Output and before Trace in tracing headers and row data without redesigning the page.
- [x] Prove the tracing table order and right edge on phone, iPad, and desktop.
- [x] Strict review and formal verify pass.
- [ ] Promote the task into `stream/os`, merge the stream review PR to `main`, and verify the merged state.
- [ ] Publish the merged runtime and Cloudflare/Hono release, promote the exact new dev runtime to canary, then run a normal saved-channel update on Ko's Mac and verify local + remote convergence.

## plan

1. Inspect local lifecycle/channel state, the immutable runtime release pipeline, production Cloudflare release, and current D1 workspace route.
2. Update Ko's machine to the newest available runtime immediately and manually repair the current route if production routing is stale.
3. Add RED contracts for release-time Hono/D1 convergence and exact tracing column order, then implement the smallest release/integration fix.
4. Validate Worker bundling, release dry-run, focused/related tests, and phone/iPad/desktop browser geometry.
5. Run strict review/formal verify, publish through the task/stream workflow, merge to main, then validate real runtime + Cloudflare releases and canary promotion before the final local update.

## current status

- Root cause and code fix are complete locally. Ko's Mac was manually moved from canary `0.1.45` to available dev `0.1.46`, which correctly activated the new runtime and rematerialized local Sites. The production split-brain was independent: R2 snapshot upload + Device Authority deployment had succeeded, but the release token's direct D1 route update failed with Cloudflare 7403, leaving the workspace route on older immutable content. The current D1 route was repaired with the authenticated operator credential, and the release path now performs route refresh through an authenticated Hono endpoint backed by the Worker's D1 binding. Focused/related tests, Worker/release dry-runs, typecheck, and responsive browser checks are green. Awaiting review/verify and full ship/release.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js` (generated)
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/tests/website-deploy.test.js`

## workspace-owned: files changed

- Same product/release files as `files changed`; task metadata/evidence is workspace-owned.

## workspace-owned: activity log

- 2026-08-15 08:05:49 fs.write: `.task/os/fix-updater-runtime-convergence-and-trace-node-order/workpad.md`

## workspace-owned: validation evidence

- Local diagnosis: saved channel was canary `0.1.45`; canary had no update while dev exposed `0.1.46`. A real `lifecycle.update(channel=dev)` installed `0.1.46`, and the resulting active runtime + `~/.consuelo/sites/traces/index.html` both contained the tracing workspace integration. This proves local activation/Sites refresh works when a newer release exists.
- Production release diagnosis: the latest main release uploaded the new immutable workspace snapshots and deployed `consuelo-os-device-authority`, then direct `wrangler d1 execute` failed with Cloudflare error 7403. The D1 route for `workspace_internal` / `internal.consuelohq.com` was manually repaired to traces version `sha256-b7fdb2fc463df94b` with content hash `sha256:99cd9fb33d324879ed67b15c47370411d92c966b6b90f2df60f0476abee957c6` using the authenticated local Wrangler operator session.
- TDD RED: tracing order, release route transport, and Hono route contracts failed in the expected places before implementation (`trc_8bdec0222d3f`).
- Focused GREEN: tracing site + Device Authority release contracts pass, and production workflow contract passes (`trc_e669baa84886`).
- Related GREEN/typecheck: managed-cloud provisioning, inspector interactions, runtime boundary, managed runtime assets = 33 tests passed; OS typecheck clean (`trc_f0ea8d559d91`).
- Provider/build dry-run: Device Authority Worker bundles successfully with the new Hono/D1 path; `os:release -- --device-auth-only --dry-run` uploads all planned snapshots, plans the route refresh, bundles the Worker, and verifies the OS health endpoint (`trc_dbee5a39c64a`).
- Mobile browser (402x874): document width remains 402px, header is one compact row, semantic/data order is `Branch → Input → Output → Node → Trace`, and Cost is fully reachable (`trc_9658f20f0303`).
- iPad browser (1024x1366): no document horizontal overflow, header/data order matches, Cost is fully reachable (`trc_b9c6629a231b`).
- Desktop browser (1440x900): no document horizontal overflow, header/data order matches, Cost is fully reachable (`trc_24f36a3ad7cb`).
- 2026-08-15 08:27:29 `review.run`: passed — OK
- 2026-08-15 08:27:58 `review.run`: passed — OK
- 2026-08-15 08:28:26 `verify`: passed — OK
- Strict review has 0 issues / 0 blockers after explicit release-route request error handling (`trc_cfa776e85775`).
- Formal verification is publish-valid with a clean DB guard (`trc_182c00aec375`).
- 2026-08-15 08:29:00 `verify`: passed — OK

## key decisions

- The local lifecycle updater is not given Cloudflare mutation authority. It already rematerializes local Sites correctly after activation; the recurring stale view was a release-channel + remote route convergence problem.
- Runtime publish to `main` produces `dev`; canary is a separately promoted channel. Because Ko's saved preference is canary, the final ship must promote the exact newly published dev runtime to canary before testing a normal no-override `consuelo update`.
- Release-time D1 mutation now goes through `POST /internal/release/site-snapshots/refresh` on Device Authority. That route reuses the existing constant-time managed-cloud provisioner bearer check and the Worker's `WORKSPACE_ROUTE_REGISTRY` D1 binding, then constructs SQL with the canonical `createWorkspaceReleaseManagedSiteRefreshSql` helper.
- Production release preflights `OS_MANAGED_CLOUD_PROVISIONER_SECRET` before any R2/Worker mutation so missing route-refresh authority cannot leave snapshots/Worker ahead of the route registry.
- Only release-managed site IDs are sent to the refresh endpoint; `artifacts` and `docs` remain outside this release-managed route mutation.
- Node is moved semantically in both headers and row builders, not only visually with CSS. Grid widths and generated inspector asset were updated to match; no tracing redesign was introduced.

## notes for ko

- Ko's machine is already on the available `0.1.46` dev runtime as an immediate recovery, but the final state must return to a current canary via actual promotion + normal saved-channel update after this fix lands.
- The protected `internal.consuelohq.com/tracing` page requires an authenticated workspace browser session, so provider D1 route state plus production release/Worker deployment are the authoritative remote convergence checks here.

## improvements noticed

- Release automation should eventually make channel promotion intent explicit when a user-facing main release is expected to be immediately available to canary users; currently runtime publish and canary promotion are deliberately separate workflows.

## issues and recovery

- The first focused RED attempt invoked bare `vitest`, which is not available directly in this worktree. Re-ran with the canonical package command `bun run test -- ...`; the expected behavioral RED was then captured.
- The live Device Authority release invocation returned a transient MCP/network error to the facade while the underlying release process continued far enough to deploy and repair provider state. Provider deployment/D1 queries were used to verify actual state rather than trusting the interrupted facade response.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `consuelo update` must converge the active runtime and every served workspace-site layer (local runtime bundle, materialized Sites output, Hono route, and Cloudflare-facing route) onto the newly activated release before reporting success; tracing table columns must render Node immediately after Output and before Trace at desktop/tablet/mobile widths.
existing local pattern: lifecycle update activates a verified release, reconciles services from the active runtime, and Sites materialization owns generated workspace HTML; tracing shell contracts assert generated table/chrome markup and responsive behavior.
new or changed tests: add/extend lifecycle update/release tests to prove post-activation Sites/runtime convergence and extend tracing site contract assertions for exact column order.
focused red command: run the focused lifecycle updater contract and tracing site contract after adding the assertions.
expected red failure: current updater leaves at least one served-site/runtime layer stale after activation, and current tracing header/data order places Node before Input rather than between Output and Trace.
no-test waiver: not applicable.

- 2026-08-15 08:05:49 append: `.task/os/fix-updater-runtime-convergence-and-trace-node-order/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0002_site_snapshot_route_targets.sql`
- `packages/os/package.json`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/managed-cloud-one-click-provisioning.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/tests/website-deploy.test.js`

- 2026-08-15 08:28:37 apply-patch: `.task/os/fix-updater-runtime-convergence-and-trace-node-order/workpad.md`
