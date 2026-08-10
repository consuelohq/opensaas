# Add workspace environment registry

branch: `task/os/add-workspace-environment-registry`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1530/add-workspace-environment-registry
github pr: https://github.com/consuelohq/opensaas/pull/1530
started: 2026-07-18

## acceptance criteria

- [x] Make `/environments` a functional workspace-scoped control-plane surface.
- [x] Add an explicit environment domain model containing names, labels, scope, status, and non-sensitive configuration metadata only.
- [x] Add Effect-backed repository and service boundaries with typed failures.
- [x] Persist environments locally with workspace binding, validation, atomic writes, restrictive file permissions, and serialized mutations.
- [x] Add signed local Hono routes and hosted Sites gateway routes with fail-closed authorization descriptors.
- [x] Hydrate the public `/environments` shell through the authenticated environment gateway without embedding private environment data.
- [x] Register environment read/write gateway services and workspace-edge routes while preserving `/configuration`, `/tools`, `/secrets`, `/settings`, and `/gateway/settings/*`.
- [x] Record metadata-only environment audit events and prove request bodies, secrets, credentials, and private implementation paths do not leak.
- [x] Prove local routing, hosted routing, authorization, persistence, redaction, and public/private data separation with focused test-first coverage.
- [x] Do not implement secret storage, secret resolution, runtime environment injection, browser-session issuance, or Consuelo Cloud custody.

## plan

1. Inspect the approved control-plane contract, existing Configuration Effect services, route policies, gateway descriptors, edge seeds, public shells, and focused tests.
2. Add failing contracts for environment model validation, workspace-scoped persistence, signed local routes, hosted gateway authorization, route registration, UI hydration, audit redaction, and public/private separation.
3. Implement the environment repository and service behind Effect boundaries with typed failures and serialized atomic writes.
4. Add gateway adapters, Hono routes, authorization/service descriptors, edge route registrations, and environment-shell hydration.
5. Run focused local and signed-edge suites, syntax checks, strict review, and publish verification before promotion.

## Test-first contract

- Behavior under test: authenticated callers can list, create/update, archive, and delete workspace-scoped non-sensitive environment records through signed local and hosted gateway routes; persisted data is workspace-bound and redacted; the public shell contains no records and hydrates only from `/gateway/environments/*`.
- Existing local pattern: `settings-control-plane.ts`, `settings-gateway.ts`, `settings-sites-gateway-endpoints.ts`, `control-plane-audit.ts`, `workspace-edge-route-seed.ts`, and `settings-site.ts`.
- New or changed tests: environment model/repository/service tests, environment gateway tests, Hono route tests, Sites gateway tests, route-seed/adapter tests, public-shell tests, and signed edge integration contracts.
- Focused red command: `bun test tests/environment-control-plane.test.ts tests/environment-gateway.test.ts tests/environment-sites-gateway-endpoints.test.ts tests/environment-hono-routes.test.ts tests/consuelo-sites-environment-adapter.test.ts tests/settings-site.test.ts tests/workspace-edge-route-seed-contract.test.ts`.
- Observed red failure: environment modules and routes were missing, `/environments` was still a placeholder, and no environment descriptors or persistence/audit behavior existed.
- No-test waiver: none; this changes persistence, authorization, hosted routing, and private control-plane data.

## discovery

- `stream/os` already contains the approved control-plane contract, hardened Effect-backed Configuration services, and first-class public `/environments` shell.
- The original `/environments` page was deliberately a public placeholder and did not call a private API.
- Existing signed local and Sites gateway boundaries use exact route scopes, workspace headers, fail-closed capability checks, and `consuelo-gateway-service` descriptors.
- Environment gateway routes must be separate from Configuration and legacy Settings routes so those contracts remain intact.
- Public workspace Site snapshots can contain the route-aware shell, but private environment records must only appear in authenticated gateway responses.

## implementation

- Added a typed environment domain with workspace or node scope, active/inactive/archived status, labels, and scalar non-sensitive metadata.
- Added Effect-backed list, upsert, and delete services with typed failures.
- Added atomic `config/environments.json` persistence with `0700` directory, `0600` file, per-registry serialized mutations, workspace binding, full read-time validation, and tamper rejection.
- Added sensitive-key and known credential-pattern rejection for all user-controlled record text and metadata.
- Added metadata-only created/updated/deleted audit events with no metadata values or request payloads.
- Added signed local Hono routes and distinct read/write scopes under `/gateway/environments/*`.
- Added hosted Sites gateway scope resolution, read/write capability separation, service descriptors, and edge registrations in longest-prefix order.
- Replaced the public `/environments` placeholder with a route-aware list/create/edit/delete UI that hydrates exclusively through authenticated environment gateway calls.
- Kept `/configuration`, `/tools`, `/secrets`, `/settings`, and `/gateway/settings/*` unchanged.

## current status

- Implementation and focused validation are complete.
- Strict review and lifecycle publish/merge remain.

## files changed

- `packages/os/scripts/lib/control-plane-audit.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/os/scripts/lib/consuelo-sites-environment-adapter.ts`
- `packages/os/scripts/lib/environment-control-plane.ts`
- `packages/os/scripts/lib/environment-gateway.ts`
- `packages/os/scripts/lib/environment-sites-gateway-endpoints.ts`
- `packages/os/scripts/server/routes/environments.ts`
- `packages/os/tests/consuelo-sites-environment-adapter.test.ts`
- `packages/os/tests/environment-control-plane.test.ts`
- `packages/os/tests/environment-gateway.test.ts`
- `packages/os/tests/environment-hono-routes.test.ts`
- `packages/os/tests/environment-sites-gateway-endpoints.test.ts`


## workspace-owned: validation evidence

- Focused environment surface: 19 tests passed, 106 assertions.
- Configuration regression plus environment surface: 42 tests passed, 166 assertions.
- Signed workspace-edge route and descriptor contracts: 18 tests passed, 130 assertions.
- `bun run typecheck`: workspace script syntax checks passed.
- Strict review against `origin/stream/os`: zero findings across 20 changed OS files.
- Full `bun test` was attempted but timed out at the workspace tool's 30-second process limit and exposed unrelated pre-existing failures in doctor fixtures, generated manifests, stale documentation paths, old installer Settings expectations, removed Office skill expectations, and task-hook dispatcher expectations. All environment and Configuration tests observed during that run passed. The generated facade snapshot touched by that broad run was restored from `origin/stream/os` and is not part of this task.
- 2026-07-18 17:01:22 `review.run`: passed — OK
- 2026-07-18 17:02:37 `review.run`: passed — OK
- 2026-07-18 17:03:36 `review.run`: passed — OK
- 2026-07-18 17:03:37 `review.run`: passed — OK
- 2026-07-18 17:04:21 `review.run`: passed — OK
- 2026-07-18 17:05:20 `verify`: passed — OK
- 2026-07-18 17:06:29 `verify`: passed — OK

## key decisions

- Canonical environment APIs use `/gateway/environments/*`; existing Configuration and Settings APIs remain unchanged.
- Environment records store configuration metadata only and reject credential/secret-shaped keys and values on both writes and reads.
- The public `/environments` HTML remains state-free; private records hydrate only from authenticated gateway responses.
- Environment read and write authorization are distinct at local route scopes, hosted capabilities, service descriptors, and edge routes.
- Consuelo Cloud custody, credential references, browser-session issuance, secret resolution, and runtime injection remain outside this task.

## notes for ko

- The page is functional wherever the existing authenticated gateway session is available. Browser-session issuance was intentionally not added; unauthenticated hosted access remains an explicit unavailable state.
- The previous Settings/Configuration handoff was used only as historical route context; current `stream/os` code was treated as authoritative.

## improvements noticed

- A future secrets branch can reuse the environment ID and node-scope model, but credential references must remain a separate domain and persistence boundary.
- The broad OS test suite has several stream-level stale contracts unrelated to this task and should be repaired separately rather than folded into the environment registry.

## issues and recovery

- The first workpad overwrite required `force: true`; no production files were affected.
- Strict review timed out once before the final focused verification, then completed successfully with zero findings.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add workspace environment registry" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-18 17:01:05 write: `.task/os/add-workspace-environment-registry/workpad.md`

## workspace-owned: files changed

- `.task/os/add-workspace-environment-registry/workpad.md`
- `packages/os/scripts/lib/consuelo-sites-environment-adapter.ts`
- `packages/os/scripts/lib/control-plane-audit.ts`
- `packages/os/scripts/lib/environment-control-plane.ts`
- `packages/os/scripts/lib/environment-gateway.ts`
- `packages/os/scripts/lib/environment-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/environments.ts`
- `packages/os/tests/consuelo-sites-environment-adapter.test.ts`
- `packages/os/tests/environment-control-plane.test.ts`
- `packages/os/tests/environment-gateway.test.ts`
- `packages/os/tests/environment-hono-routes.test.ts`
- `packages/os/tests/environment-sites-gateway-endpoints.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: activity log

- 2026-07-18 17:01:05 fs.write: `.task/os/add-workspace-environment-registry/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/environment-control-plane.ts`

- 2026-07-18 17:02:14 apply-patch: `packages/os/scripts/lib/environment-control-plane.ts`
- 2026-07-18 17:02:14 apply-patch: `packages/os/scripts/lib/settings-site.ts`

- 2026-07-18 17:03:36 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-07-18 17:03:36 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`

- 2026-07-18 17:03:54 apply-patch: `packages/os/scripts/lib/environment-gateway.ts`
- 2026-07-18 17:03:54 apply-patch: `packages/os/tests/environment-gateway.test.ts`

- 2026-07-18 17:04:30 apply-patch: `.task/os/add-workspace-environment-registry/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/add-workspace-environment-registry/current.json`, `.task/os/add-workspace-environment-registry/evidence-log.json`, `.task/os/add-workspace-environment-registry/read-log.json`, `.task/os/add-workspace-environment-registry/session.json`, `.task/os/add-workspace-environment-registry/verify.json`, `.task/os/add-workspace-environment-registry/workpad.md`, `.task/tasks/os/add-workspace-environment-registry.json`, `packages/os/scripts/lib/consuelo-sites-environment-adapter.ts`, `packages/os/scripts/lib/control-plane-audit.ts`, `packages/os/scripts/lib/environment-control-plane.ts`, `packages/os/scripts/lib/environment-gateway.ts`, `packages/os/scripts/lib/environment-sites-gateway-endpoints.ts`, `packages/os/scripts/lib/settings-site.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/server/app.ts`, `packages/os/scripts/server/route-policies.ts`, `packages/os/scripts/server/routes/environments.ts`, `packages/os/tests/consuelo-sites-environment-adapter.test.ts`, `packages/os/tests/environment-control-plane.test.ts`, `packages/os/tests/environment-gateway.test.ts`, `packages/os/tests/environment-hono-routes.test.ts`, `packages/os/tests/environment-sites-gateway-endpoints.test.ts`, `packages/os/tests/settings-site.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
