# Add workspace configuration routes

branch: `task/os/add-workspace-configuration-routes`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1529/add-workspace-configuration-routes
github pr: https://github.com/consuelohq/opensaas/pull/1529
started: 2026-07-18

## acceptance criteria

- [x] Add first-class public workspace Site routes at `/tools`, `/environments`, and `/secrets`.
- [x] Keep `/configuration` as the existing compatibility/overview surface and keep `/settings` plus `/gateway/settings/*` aliases intact.
- [x] Put the final launcher section at the bottom and order its links Tools, Environments, Secrets.
- [x] Publish route-aware public shells for all three new routes without embedding private workspace data.
- [x] Register the new Site snapshots in workspace edge route seeds and install-edge publication plans.
- [x] Add authorization/service descriptors only where existing private Configuration APIs are reused; do not invent environment or secret APIs in this branch.
- [x] Preserve the hardened Effect-backed Configuration control-plane boundaries.
- [x] Prove local shell routing, hosted edge snapshot routing, launcher navigation, legacy aliases, and public/private data separation.
- [x] Do not implement environment persistence, credential storage, secret resolution, runtime injection, browser-session issuance, or Consuelo Cloud custody.

## plan

1. Audit the merged Configuration implementation, route seed, publisher, launcher, Site materialization, adapters, and focused tests.
2. Add failing contracts for the three public routes, publication plan, launcher order, route-aware shells, and absence of private embedded state.
3. Introduce the smallest route-aware Configuration shell contract and publication wiring needed for `/tools`, `/environments`, and `/secrets`.
4. Preserve `/configuration`, `/settings`, and existing gateway aliases without expanding the private API surface.
5. Run focused tests, signed edge contracts, OS typecheck/package checks, strict review, and full verify before promotion.

## Test-first contract

- Behavior under test: `/tools`, `/environments`, and `/secrets` are first-class workspace Site routes; the launcher lists them under the final Configuration section in that order; install publication includes all three snapshots; each route serves a route-aware public shell with no private snapshot data; `/configuration` and legacy Settings aliases continue to work.
- Existing local pattern: canonical `/configuration` Site route in `workspace-edge-route-seed.ts`, `install-edge-site-publisher.ts`, `settings-materialization.ts`, `settings-site.ts`, and signed Configuration gateway adapters.
- New or changed tests: `launcher-onboarding.test.ts`, `workspace-edge-route-seed-contract.test.ts`, `install-edge-site-publisher.test.ts`, `settings-site.test.ts`, `sites-cli.test.ts`, and the focused workspace-edge Sites integration contract where necessary.
- Focused red command: `bun --cwd packages/os test tests/launcher-onboarding.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/install-edge-site-publisher.test.ts tests/settings-site.test.ts tests/sites-cli.test.ts`.
- Expected red failure: the launcher exposes only `/configuration`; the route seed and publish plan do not include `/tools`, `/environments`, or `/secrets`; the Configuration shell cannot render a route-specific page.
- No-test waiver: none; this changes public routing, published snapshots, launcher navigation, and hosted edge behavior.

## current status

- Implementation complete.
- `/tools`, `/environments`, and `/secrets` are first-class public Site snapshot routes.
- `/configuration` remains the overview; `/settings` and `/gateway/settings/*` remain intact.
- The launcher now places Configuration last with Tools, Environments, Secrets in the approved order.
- Tools reuses the existing authenticated Configuration snapshot/overlay APIs. Environments and Secrets are explicit public shells only and expose no speculative API or private state.
- Focused local, signed edge, publication, control-plane, syntax, and strict review checks pass.

## files changed

- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-site.ts`

## workspace-owned: activity log

- Began with failing contracts for launcher order, first-class routes, route-aware shells, publication, and public/private separation.
- Added route-aware Configuration shell rendering and local materialization for all four Configuration surfaces.
- Registered `/tools`, `/environments`, and `/secrets` in the workspace edge seed and install publisher.
- Extended local Sites status output with all Configuration route paths and availability.
- Refined the D1 seed safety assertion so the legitimate `/secrets` route is allowed while secret material field names remain forbidden.

## workspace-owned: validation evidence

- Red phase: focused contract command failed on the missing launcher links, routes, route-aware renderer, and materialized files.
- Green local/control-plane suite: 49 tests passed across launcher, Configuration shell, Sites CLI, Effect control plane, Hono routes, gateway endpoints, and adapters.
- Signed edge/publication contracts: 20 tests passed with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.
- Syntax/typecheck: `workspace script syntax checks passed`.
- Strict review against `origin/stream/os`: 13 files, 0 issues, 0 blocking findings.
- Full workspace safety gate: publish-valid stamp written; review, registry selection, and database guard passed.
- Full `packages/os` test run was attempted. It exposed unrelated baseline failures in doctor analytics/redaction fixtures, generated manifest expectations, and deleted legacy documentation paths; it also updated a facade snapshot, which was immediately reverted. None of the focused suites for this change failed.
- 2026-07-18 16:28:46 `verify`: passed — OK

## key decisions

- `/tools`, `/environments`, and `/secrets` are public static shells only in this branch.
- `/configuration` remains the existing overview surface; no narrower redirect is justified by current repository evidence.
- The existing private gateway remains `/gateway/configuration/*`; this branch does not create speculative `/gateway/environments/*` or `/gateway/secrets/*` APIs.
- All route shells must hydrate only through already-authorized Configuration APIs when they need private state.

## notes for ko

- This branch intentionally stops at routing, navigation, shells, descriptors, publication, and tests.

## improvements noticed

- The task was initially bootstrapped from `main`; it was merged with the latest `origin/stream/os` before discovery so implementation starts from the approved Configuration foundation.

## issues and recovery

- `task.start` was called without `startFrom: "stream"`, so the bootstrap began at `main`. Recovered immediately by fetching and merging `origin/stream/os` before any production edit.
- A full package test run writes a facade snapshot and failed on unrelated baseline fixtures. The snapshot mutation was reverted; focused and signed edge suites remained green.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add workspace configuration routes" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-18 16:20:21 write: `.task/os/add-workspace-configuration-routes/workpad.md`

- 2026-07-18 16:23:26 write: `packages/os/scripts/lib/settings-site.ts`

- 2026-07-18 16:23:39 write: `packages/os/scripts/lib/settings-materialization.ts`

## workspace-owned: files read

- `packages/os/package.json`

## workspace-owned: test selection

- changed files: `.task/os/add-workspace-configuration-routes/current.json`, `.task/os/add-workspace-configuration-routes/evidence-log.json`, `.task/os/add-workspace-configuration-routes/read-log.json`, `.task/os/add-workspace-configuration-routes/session.json`, `.task/os/add-workspace-configuration-routes/workpad.md`, `.task/tasks/os/add-workspace-configuration-routes.json`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/settings-materialization.ts`, `packages/os/scripts/lib/settings-site.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/os.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/settings-site.test.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

## workspace-owned: TDD post evidence

- 2026-07-18 16:30:31 `git push origin HEAD:refs/heads/task/os/add-workspace-configuration-routes`: failed exit 1 trace: `trc_90fbbad3b433`
  - output: error: Script not found "task:exec"
