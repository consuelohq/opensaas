# Install Control Plane

branch: `task/os/install-control-plane`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1903/install-control-plane
github pr: https://github.com/consuelohq/opensaas/pull/1903
started: 2026-08-13

## acceptance criteria

- [ ] Consume the landed Branch 1 install telemetry contract; do not invent a competing install/event identity model.
- [ ] Persist canonical install sessions and idempotent canonical install events in a Cloudflare-backed control-plane repository with a migration path and 400-day retention support.
- [ ] Treat installer-originated identity as untrusted: anonymous ingest cannot self-assert canonical user/workspace identity.
- [ ] Track diagnostic-bundle reference/availability metadata without putting secrets or raw diagnostic payloads into the canonical event store.
- [ ] Expose the Branch 1 read-only dashboard API contract for overview, users, installs, devices, errors, and install detail.
- [ ] Keep dashboard data private behind an authenticated, explicitly authorized internal-operator browser boundary; a hidden launcher link is not authorization.
- [ ] Project device state from the existing Device Authority/node registry and preserve its authoritative online/offline semantics.
- [ ] Keep Sentry, Cloudflare observability, PostHog, and raw R2 payloads as evidence/projection systems rather than canonical counts.
- [ ] Add focused tests first, demonstrate RED then GREEN, and run relevant regression/type/syntax validation.
- [ ] Run strict review with no blocking issues, publish the task, merge it into `stream/os`, and clean up the task worktree.

## plan

1. Read the Branch 1 contract plus Device Authority, browser-session, node-registry, D1, and R2 patterns. Define the smallest control-plane boundary that avoids conflicts with parallel Branches 2/4/5.
2. Add focused failing tests for event validation/idempotency, session projection, privacy/auth boundaries, dashboard queries, retention, and diagnostic metadata.
3. Implement the control-plane repository/service, Cloudflare bindings/migrations, ingest/read HTTP adapters, and explicit internal-operator authorization.
4. Run focused and nearby regressions, syntax/type validation, then strict review. Resolve review findings or record proven unrelated failures.
5. Update this workpad with evidence, `task.push`, normal `task.pr` into `stream/os` (not task-only), then `task.finish`.

## current status

- Task started and Branch 1 contract loaded.
- `task.start` initially based the worktree on `main`; before production edits I fetched and merged `origin/stream/os` so this branch now contains Branch 1 exactly as landed.
- Mapping existing Cloudflare D1/R2 patterns and the correct private operator-auth boundary before writing tests.

## test-first contract — resumed hardening

- Behavior under test: event ordering and session projection must follow the Branch 1 distributed ordering contract (`occurredAt`, then deterministic producer/sequence tie-breaks) rather than comparing producer-local `sequence` values globally.
- Behavior under test: activated/active-user metrics must come from trusted node heartbeat evidence; completed installation alone is not activation, and 7-day activity does not require the node to still be online at query time.
- Existing local pattern: extend `packages/os/tests/install-control-plane.test.ts` at the repository/service boundary and keep D1 replay/order SQL covered in `install-control-plane-d1.test.ts`.
- New/changed tests: cross-producer sequence ordering/session projection, chronological timeline ordering, offline-but-heartbeated activation, and 7-day activity semantics.
- Focused RED command: `bunx vitest run packages/os/tests/install-control-plane.test.ts packages/os/tests/install-control-plane-d1.test.ts`.
- Expected RED: current code sorts/reprojects by global sequence and reports completed installs as activated users while requiring current online state for active-7d.
- Test correction after first GREEN attempt: changed the user-summary assertion to be order-insensitive because list ordering was not part of this hardening contract; the activation assertions themselves were unchanged.

## test-first contract — Device Authority correlation and canonical binding

- Behavior under test: a valid `x-consuelo-install-id` on device-code creation is validated and carried only in trusted server-side grant state; it is never added to the human verification URL. Missing/malformed correlation does not block the existing device-auth flow.
- Behavior under test: the signed application approval assertion carries both canonical `UserEntity.id` and canonical `WorkspaceEntity.id`; Device Authority uses those trusted IDs for the grant, emits one best-effort `install.identity.bound` event for the correlated install after approval commits, and exposes `user_id` only for that canonical app-mediated path.
- Behavior under test: direct provider identity such as `google:<sub>` never becomes a canonical install/dashboard user ID.
- Existing local pattern: extend `install-control-plane-cloudflare.test.ts` for the cross-boundary control-plane behavior and update the existing Device Authority approval assertion helper/tests for the new optional workspace claim.
- Focused RED command: `bunx vitest run packages/os/tests/install-control-plane-cloudflare.test.ts packages/os/tests/os-device-authority-worker.test.ts`.
- Expected RED: Device Authority currently ignores the correlation header, the approval assertion has no workspace ID, and no trusted identity-bound event/user ID is projected after approval.
- Test correction after the first implementation pass: the identity assertion now allows the expected canonical `nodeId` enrichment; canonical user/workspace assertions remain exact.
- Additional replay invariant found during integration: D1 replay must recover trust from producer semantics, not identity state alone, so an anonymous trusted `control_plane` event is not incorrectly re-validated through the public installer boundary.

## strict review remediation

- Strict review was run against `origin/stream/os` (the local `stream/os` ref is stale). The native `review.run` wrapper is currently returning transport errors, so the repository's own `packages/workspace/scripts/review.js` was executed through the task-scoped OS `code.call` facade instead.
- Review scope is exactly 19 changed TypeScript files. Functional tests are green separately; the remaining task-owned findings are 27 instances of the repository `ERROR_HANDLING` static rule requiring an explicit error boundary around async functions that await.
- Remediation keeps behavior unchanged: add typed `catch (error: unknown)` boundaries with operation-specific context around D1/R2/edge I/O, and remove unnecessary `async` keywords from pass-through promise helpers where no local await/error translation is required.
- After remediation: rerun changed-file syntax checks, the 43-test telemetry/control-plane packet, the 75-test Device Authority/edge hardening packet, both Wrangler dry-runs, then strict review against `origin/stream/os` again. Promotion is blocked until task-owned strict findings are zero.

## files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/security/device-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- `packages/os/cloudflare/os-device-authority/install-diagnostics-r2-lifecycle.json`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`
- `packages/os/docs/install-control-plane.md`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- `packages/os/scripts/lib/install-control-plane-http.ts`
- `packages/os/scripts/lib/install-control-plane-r2.ts`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/tests/install-control-plane-cloudflare.test.ts`
- `packages/os/tests/install-control-plane-d1.test.ts`
- `packages/os/tests/install-control-plane-http.test.ts`
- `packages/os/tests/install-control-plane-r2.test.ts`
- `packages/os/tests/install-control-plane.test.ts`


## workspace-owned: files changed

- `.task/os/install-control-plane/workpad.md`
- `packages/os/cloudflare/os-device-authority/install-diagnostics-r2-lifecycle.json`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`
- `packages/os/docs/install-control-plane.md`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- `packages/os/scripts/lib/install-control-plane-http.ts`
- `packages/os/scripts/lib/install-control-plane-r2.ts`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/tests/install-control-plane-cloudflare.test.ts`
- `packages/os/tests/install-control-plane-d1.test.ts`
- `packages/os/tests/install-control-plane-http.test.ts`
- `packages/os/tests/install-control-plane-r2.test.ts`
- `packages/os/tests/install-control-plane.test.ts`

## workspace-owned: activity log

- 2026-08-13 16:45:36 fs.write: `.task/os/install-control-plane/workpad.md`
- 2026-08-13 16:51:42 fs.write: `packages/os/tests/install-control-plane.test.ts`
- 2026-08-13 16:53:07 fs.write: `packages/os/scripts/lib/install-control-plane.ts`
- 2026-08-13 16:54:34 fs.write: `packages/os/tests/install-control-plane-http.test.ts`
- 2026-08-13 16:55:16 fs.write: `packages/os/scripts/lib/install-control-plane-http.ts`
- 2026-08-13 16:55:46 fs.write: `packages/os/tests/install-control-plane-d1.test.ts`
- 2026-08-13 16:57:06 fs.write: `packages/os/cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`
- 2026-08-13 16:58:20 fs.write: `packages/os/scripts/lib/install-control-plane-d1.ts`
- 2026-08-13 16:59:14 fs.write: `packages/os/tests/install-control-plane-r2.test.ts`
- 2026-08-13 16:59:30 fs.write: `packages/os/scripts/lib/install-control-plane-r2.ts`
- 2026-08-13 17:00:13 fs.write: `packages/os/tests/install-control-plane-cloudflare.test.ts`
- 2026-08-13 17:00:53 fs.write: `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- 2026-08-13 17:07:57 fs.write: `packages/os/cloudflare/os-device-authority/install-diagnostics-r2-lifecycle.json`
- 2026-08-13 17:09:07 fs.write: `packages/os/docs/install-control-plane.md`
- Merged current `origin/stream/os` into the task worktree before implementation.
- Read Branch 1 contract and executable types.
- Read Device Authority app/worker/store, browser auth, workspace nodes, wrangler config, and workspace control-plane contract.

## workspace-owned: validation evidence

- 2026-08-13 17:03:47 `checkFiles`: passed — OK
- 2026-08-13 17:09:22 `checkFiles`: passed — OK
- 2026-08-13 17:52:39 `checkFiles`: passed — OK
- 2026-08-13 17:56:55 `review.run`: passed — OK
- 2026-08-13 17:58:20 `review.run`: passed — OK
- 2026-08-13 18:07:08 `checkFiles`: passed — OK
- 2026-08-13 18:14:18 `verify`: failed — COMMAND_FAILED

## key decisions

- Canonical install telemetry remains owned by a Consuelo control-plane repository; vendor telemetry systems are not queried for canonical dashboard counts.
- Reuse existing Device Authority/node/session foundations rather than adding Better Auth or a parallel identity system.
- Avoid editing installer/launcher/dashboard UI paths owned by parallel Branches 2/4/5 unless a shared contract extension is strictly required.

## notes for ko

- Branch 3 is built on the current `origin/stream/os`, including Branches 1 and 2. Branches 4 and 5 can continue in parallel.
- No live Cloudflare provider state was mutated from this task. Production still requires the documented D1 migration, diagnostic R2 bucket/lifecycle application, and Cloudflare Access configuration.

## final validation summary

- `checkFiles` passes all changed TypeScript files, including the Twenty auth assertion extension.
- Telemetry/control-plane integration packet: 10 files, 43/43 tests green from the intended `packages/os` cwd.
- Device Authority/edge hardening packet: 5 files, 75/75 tests green with the auth-hardening contract enabled.
- Device Authority Wrangler dry-run: green with D1 and `INSTALL_DIAGNOSTICS` R2 bindings.
- Workspace Edge Wrangler dry-run: green.
- Strict repository review against `origin/stream/os`: `yourIssues: 0`, `mustFix: []`, no documentation opportunities. The native `review.run` facade wrapper still returns a transport error, so the exact repository review script was run through task-scoped OS `code.call`.
- Strict review still reports 18 mechanically pre-existing findings in `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts` and one pre-existing/transitive Twenty typecheck issue. They predate this task; Branch 3 adds no task-owned review finding.
- The review environment also reports the existing task-worktree ESLint plugin resolution issue (`twenty/inject-workspace-repository` unavailable); focused syntax/tests and the task-owned static review surface are green.

## improvements noticed

- `task.start` currently starts from `main` rather than the accumulating area stream, so sequential feature trains need an explicit stream merge before coding.

## issues and recovery

- Initial task worktree did not contain Branch 1. Recovered by fetching and merging `origin/stream/os` before any production edits.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-13 16:45:36 write: `.task/os/install-control-plane/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/package.json`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/http.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/security/device-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/device-approval.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`
- `packages/os/cloudflare/workspace-edge/package.json`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/docs/install-control-plane.md`
- `packages/os/docs/install-telemetry-contract.md`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/scripts/lib/install-diagnostics.ts`
- `packages/os/scripts/lib/install-telemetry-contract.ts`
- `packages/os/scripts/lib/install-telemetry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/install-control-plane-cloudflare.test.ts`
- `packages/os/tests/install-control-plane-d1.test.ts`
- `packages/os/tests/install-control-plane.test.ts`
- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/senior-engineer.md`
