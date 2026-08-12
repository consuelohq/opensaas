# Launcher Nodes UI and pricing UX

branch: `task/os/launcher-nodes-ui-and-pricing-ux`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1890/launcher-nodes-ui-and-pricing-ux
github pr: https://github.com/consuelohq/opensaas/pull/1890
started: 2026-08-12

## acceptance criteria

- [x] Replace Environments in the launcher primary navigation with a Nodes page while preserving the separate Environment backend/data model for compatibility.
- [x] Render safe existing workspace nodes from the authoritative central node registry with current/default/presence state and no provider machine-type internals.
- [x] Allow a signed-in workspace user to make an active node the workspace default from the Nodes UI; the control must update the central default routing authority rather than local-only UI state.
- [x] Add an Add node / Create cloud node dialog that uses the managed-cloud public plan and region contracts: Starter, Standard (recommended), Performance, Power, Max; show CPU, RAM, region, and safe monthly quote data when published.
- [x] Do not expose provider machine types, provider cost/margin internals, credentials, or provisioning identifiers in the launcher HTML/API.
- [x] Keep live cloud provisioning disabled in this branch with explicit coming-soon copy; no GCP, cloud node, Mac runtime, or billing resource changes.
- [x] Preserve workspace-session authentication and CSRF protections for launcher mutations, and fail closed on unavailable/invalid session or node state.
- [x] Add focused regression coverage for Nodes rendering, central default mutation, session protection, safe pricing DTOs, and retained Environment backend behavior.

## plan

1. Add failing launcher/materialization tests for the Nodes navigation, node cards, default action, cloud-plan dialog, and hidden provider internals.
2. Add a workspace-session-protected central Nodes gateway for safe node snapshot/default actions; reuse the existing node registry/default-route mutation instead of storing duplicate node state.
3. Add a safe managed-cloud catalog/quote endpoint backed by the existing public pricing domain contract; handle unpublished rate data without fabricating prices.
4. Replace the Environments launcher page with the Nodes experience, keeping the old environment model/routes out of primary navigation.
5. Run targeted security/UI/materialization tests, inspect generated HTML, then run strict review/full verification and publish only this task scope.

## current status

- Implementation complete; focused and baseline suites are green.
- Generated Nodes HTML inspected: all five plans, responsive dialog content, monthly pricing placeholders, no provider machine identifiers or margin/cost internals.
- Strict review and full verification are clean; publishing task PR.

## files changed

Production:
- packages/os/scripts/lib/settings-site.ts
- packages/os/scripts/lib/settings-materialization.ts
- packages/os/scripts/lib/sites.ts
- packages/os/scripts/os.ts
- packages/os/scripts/lib/workspace-edge-route-seed.ts
- packages/os/scripts/lib/install-edge-site-publisher.ts
- packages/os/cloudflare/workspace-edge/src/index.ts
- packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts
- packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts
- packages/os/cloudflare/os-device-authority/src/services/managed-cloud-pricing.ts
- packages/os/cloudflare/os-device-authority/src/app.ts
- packages/os/cloudflare/os-device-authority/src/types.ts
- packages/os/cloudflare/os-device-authority/src/worker.ts

Tests:
- packages/os/tests/settings-site.test.ts
- packages/os/tests/launcher-nodes-control-plane.test.ts
- packages/os/tests/launcher-nodes-materialization.test.ts
- packages/os/tests/workspace-edge-route-seed-contract.test.ts
- packages/os/tests/install-edge-site-publisher.test.ts
- packages/os/tests/workspace-edge-sites-gateway-integration.test.ts

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-12: Started dedicated Branch 11 task from stream/os.
- 2026-08-12: Audited launcher renderer/materialization, central workspace-node API, workspace-session auth path, and managed-cloud pricing contract.
- 2026-08-12: Implemented Nodes UI, central session-backed node controls, safe pricing catalog, Nodes snapshot publication, and real default routing mutation.
- 2026-08-12: Fixed two strict-review async fail-closed findings; strict re-review returned 0 issues and full verify is publish-valid.

## workspace-owned: validation evidence

- Baseline/regression: 44 pass, 0 fail across settings-site, Environment Hono routes, workspace node registry/routing, and universal login.
- Branch 11 focused + Sites contracts: 42 pass, 0 fail, 362 assertions across 6 files.
- packages/os typecheck/syntax: passed.
- Generated Nodes HTML inspection: title/dialog/plans present; no machineType/e2/providerCost/targetGrossMargin leakage.
- Strict review: 0 blocking findings.
- Full verify: publishValid=true; 0 DB findings. One expected database-script warning for workspace-edge-route-seed.ts because Branch 11 adds the /nodes Site snapshot route.
- Existing os-device-authority-worker.test.ts cannot run under Bun in this checkout because its pre-existing Vitest helpers vi.stubGlobal/vi.unstubAllGlobals are unavailable; Branch 11-specific authority/session tests pass independently.
- Broad sites-cli trace-shell assertion is owned by concurrent observability work; Branch 11 uses a focused Nodes materialization test instead.
- 2026-08-12 14:43:34 `review.run`: passed — OK
- 2026-08-12 14:44:43 `review.run`: passed — OK
- 2026-08-12 14:44:55 `verify`: passed — OK

## key decisions

- Keep the underlying Environment data model/API intact; replace only its primary launcher navigation/page with Nodes.
- Default-node management must terminate in the central authority under the existing workspace browser session; do not expose operator/OAuth bearer tokens to browser JavaScript.
- Managed cloud provider machine types remain internal.
- This branch presents plan/region/pricing UX but does not provision infrastructure.

## notes for ko

- No Mac or cloud runtime deployment occurs in this branch.

## improvements noticed

- The existing launcher workspace session can be reused as the safe authority for node management instead of inventing a browser token path.

## issues and recovery

- A read-only import initially used a temp-program-relative path; reran with a resolved file URL. No repository state changed.
- A broad Sites CLI test exposed a pre-existing/concurrent Traces shell assertion mismatch; reverted Branch 11 edits to that test and added focused Nodes materialization coverage.
- os-device-authority-worker.test.ts is blocked by pre-existing Bun/Vitest vi.stubGlobal and vi.unstubAllGlobals incompatibility; did not modify the unrelated test harness.
- An attempted root os:check:syntax script did not exist; reran the package-owned typecheck/syntax command successfully.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add launcher nodes ui" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-website/AGENTS.md`
- `packages/consuelo-website/DESIGN.md`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/lib/managed-cloud-pricing.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/workspace/senior-engineer.md`
