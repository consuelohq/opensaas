# Fix current-bundle updater reconciliation

branch: `task/os/fix-current-bundle-updater-reconciliation`
stream: `stream/os`
github pr: https://github.com/consuelohq/opensaas/pull/2063
graphite pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2063/fix-current-bundle-updater-reconciliation
started: 2026-08-15

## acceptance criteria

- [x] Same-bundle `consuelo update` repairs release-managed local user content after service health and connector readiness are accepted.
- [x] Existing changed-bundle activation still reconciles the accepted release and remains green.
- [x] Tracing header/row contracts remain `Input, Output, Node, Trace`.
- [x] Device-authority release contract continues to route workspace snapshot refresh through authenticated Hono/D1 and fail before remote mutation without its route-refresh credential.
- [x] Repair a stream test fixture that accidentally invoked the live Google pricing loader before its permanent-401 Hono route-refresh assertion.
- [ ] Pass workspace review and full verify.
- [ ] Push task, merge to `stream/os`, land/release the OS stream to main, promote the resulting runtime to canary, and run the normal updater on Ko's node.
- [ ] Verify the live tracing snapshot contains `Input, Output, Node, Trace` and that the workspace D1 route points at the released snapshot.

## plan

1. Prove the same-bundle updater defect with a focused red lifecycle regression.
2. Reuse one accepted-release user-state reconciliation helper for changed-bundle activation and current-bundle updates.
3. Run focused lifecycle, tracing, device-authority release, and production-workflow contracts.
4. Review/verify, publish this task to `stream/os`, then move the stream through the normal release path.
5. Verify production route/snapshot/runtime state and run the ordinary canary updater locally.

## Test-first contract

behavior under test: a valid same-bundle `update` must reconcile release-managed user content from the accepted current release after service health and connector readiness succeed.

existing local pattern: `packages/os/tests/lifecycle-engine.test.ts` installs signed fixture bundles through `createEngine`; changed-bundle activation already reconciles `visibleUserRoot` through `reconcileManagedUserContentForRelease` after acceptance.

new or changed tests: `reconciles release-managed user content when update is already current` installs bundle 1.0.0 with a visible user root, corrupts `Steering/example-system.md`, runs a current-bundle update, and requires the managed example to be restored while the result stays `changed: false`.

focused red command: `bun test packages/os/tests/lifecycle-engine.test.ts --test-name-pattern "reconciles release-managed user content when update is already current"`

expected red failure: the stale managed example remains unchanged because the current-bundle branch restarts and health-checks services but skips accepted-release user-content reconciliation.

red evidence: 0 pass, 1 fail; expected the accepted release's `example-system.md`, received `stale managed content\n` at `lifecycle-engine.test.ts:541`.

no-test waiver: not applicable.

## implementation

- `packages/os/scripts/lib/lifecycle/engine.ts`
  - added `reconcileAcceptedReleaseUserState(releasePath)` as the shared best-effort accepted-release reconciliation helper;
  - changed-bundle activation now calls that helper after health/readiness acceptance;
  - current-bundle install/update now calls the same helper after service health/readiness acceptance, before completion.
- `packages/os/tests/lifecycle-engine.test.ts`
  - fixture helper now accepts `visibleUserRoot`;
  - added the same-bundle managed-content regression.
- `packages/os/tests/os-device-authority-release-contract.test.ts`
  - the permanent-401 route-refresh test now supplies the deterministic managed-cloud pricing fixture, so it reaches the route-refresh behavior it claims to test instead of invoking the live pricing fetch first.

## validation evidence

- GREEN, focused new regression: 1 pass, 0 fail.
- Lifecycle compatibility selection: `updates an existing valid install`, `reconciles connector-backed hosted state`, and new same-bundle reconciliation: 3 pass, 0 fail.
- Tracing contract: `bun test packages/os/tests/observability-traces-site.test.ts`: 11 pass, 0 fail; current source asserts `Input, Output, Node, Trace` and row rendering Output → Node → Trace.
- Device-authority release contract first exposed a pre-existing fixture defect: 17 pass, 1 fail because the permanent-401 test reached the default live pricing loader before route refresh (`routeRefreshAttempts` remained 0). After supplying the existing deterministic pricing fixture, `cd packages/os && bun test tests/os-device-authority-release-contract.test.ts`: 18 pass, 0 fail.
- Production workflow contract: `bun test packages/workspace/tests/website-deploy.test.js`: 3 pass, 0 fail; includes dedicated OS Cloudflare credential wiring.

## production investigation already completed

- Ko's node had saved channel `canary` at runtime `0.1.45`; dev had runtime `0.1.46`, bundle `sha256:6173bf1a2c37a3215be55707e1e670ae1c4f560cd7d84d4da0850368bee19497`. A direct dev lifecycle update completed and local status reported `0.1.46`.
- The prior production release uploaded workspace snapshots and deployed Device Authority, then its older direct D1 refresh path failed Cloudflare `7403`. An operator-authenticated canonical device-authority release manually converged the route.
- Remote D1 then reported `internal.consuelohq.com` traces at snapshot `sha256-b7fdb2fc463df94b`, content hash `f9184693f4a08af20723a3e60ef94fca632038746e153e1c1e706d472a3b253e`.
- Current `stream/os` already contains the durable public-release convergence path: authenticated POST to `/internal/release/site-snapshots/refresh`, executed through the Hono worker's D1 binding, with route-refresh credential preflight before remote mutation.
- Current `stream/os` already contains the requested tracing ordering; the old order was a deployed immutable snapshot/convergence problem rather than a missing renderer edit.

## branch safety

- The earlier resumed task branch was 81 commits behind `stream/os` and conflicting. It was left untouched.
- The local `stream/os` worktree contains unrelated uncommitted/conflicted work from other agents, so it was not reset, force-updated, or modified.
- This clean task was created from the current remote `stream/os` branch and contains only the updater fix, regression coverage, the release-contract fixture correction, and workspace-owned task metadata.

## current status

- Focused implementation and contracts are green.
- Next: `review.run`, full `verify`, publish PR #2063 to `stream/os`, then release the stream to production and verify the actual Cloudflare/D1/runtime surfaces.

- 2026-08-15 09:39:34 write: `.task/os/fix-current-bundle-updater-reconciliation/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 09:39:34 fs.write: `.task/os/fix-current-bundle-updater-reconciliation/workpad.md`
- 2026-08-15 09:41:11 fs.write: `.task/os/fix-current-bundle-updater-reconciliation/workpad.md`

## workspace-owned: validation evidence

- GREEN, focused new regression: 1 pass, 0 fail.
- Lifecycle compatibility selection: `updates an existing valid install`, `reconciles connector-backed hosted state`, and new same-bundle reconciliation: 3 pass, 0 fail.
- Tracing contract: `bun test packages/os/tests/observability-traces-site.test.ts`: 11 pass, 0 fail; current source asserts `Input, Output, Node, Trace` and row rendering Output → Node → Trace.
- Device-authority release contract first exposed a pre-existing fixture defect: 17 pass, 1 fail because the permanent-401 test reached the default live pricing loader before route refresh (`routeRefreshAttempts` remained 0). After supplying the existing deterministic pricing fixture, `cd packages/os && bun test tests/os-device-authority-release-contract.test.ts`: 18 pass, 0 fail.
- Production workflow contract: `bun test packages/workspace/tests/website-deploy.test.js`: 3 pass, 0 fail; includes dedicated OS Cloudflare credential wiring.
- 2026-08-15 09:40:09 `review.run`: passed — OK
- 2026-08-15 09:40:59 `verify`: passed — OK

## review and verify

- `review.run --strict`: passed; 0 issues, 0 blocking findings, typecheck/eslint/static/spec checks green. One non-blocking docs opportunity was reported because lifecycle behavior changed; no public docs edit is needed for this internal convergence repair.
- Full `verify`: passed with `publishValid: true`; review and database safety gates green; verify stamp written.
- Task is ready to publish to `stream/os`.

- 2026-08-15 09:41:11 append: `.task/os/fix-current-bundle-updater-reconciliation/workpad.md`
