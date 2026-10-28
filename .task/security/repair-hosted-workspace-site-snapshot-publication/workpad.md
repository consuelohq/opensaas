# repair hosted workspace site snapshot publication

branch: `task/security/repair-hosted-workspace-site-snapshot-publication`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1694/repair-hosted-workspace-site-snapshot-publication
github pr: https://github.com/consuelohq/opensaas/pull/1694
started: 2026-07-28

## acceptance criteria

- [ ] Workspace route provisioning never creates Site snapshot routes for R2 objects that have not been published.
- [ ] The platform-owned publisher uploads every selected Site snapshot before atomically updating the D1 route record.
- [ ] Default device-authority provisioning remains safe when it only has the launcher snapshot: launcher is routed, unpublished child Sites are omitted.
- [ ] A complete local Site publication registers launcher, artifacts, traces, diffs, docs, configuration, tools, environments, and secrets.
- [ ] Existing Cloudflare-first routing, host-scoped launcher auth, signed Gateway routes, and localhost-only OS ingress remain unchanged.
- [ ] A missing snapshot reports a page-publication outage instead of incorrectly telling users to sign in.
- [ ] The internal workspace is repaired and `/configuration`, `/tools`, `/environments`, and `/secrets` return the published snapshots.
- [ ] Focused tests, package typecheck, review, and verify pass before promotion.

## plan

1. Add a route-seed contract that distinguishes explicitly published Site IDs from merely derivable keys.
2. Make device-authority provisioning seed only the snapshot it actually owns.
3. Make the platform publisher pass the complete published Site set after all R2 uploads and before the D1 upsert.
4. Give snapshot-read failures distinct, redacted service-unavailable copy while preserving the platform-safety response for authorization failures.
5. Preserve the existing all-upload-before-route-switch ordering and verification loop.
6. Run focused contracts, typecheck, review, verify, promote to `stream/security`, and repair the live internal workspace through the platform-owned publisher.

## Test-first contract

- Behavior under test: when provisioning knows only the launcher snapshot, generated routes contain only `/` among Site snapshots; when the publisher plans a complete release, its D1 SQL contains every uploaded Site route.
- Existing local pattern: `workspace-edge-route-seed-contract.test.ts`, `install-edge-site-publisher.test.ts`, and device-authority worker contracts exercise route records with deterministic fixtures and injected runners.
- New or changed tests: extend route-seed and publisher contracts with explicit `publishedSiteIds`; add a device-authority assertion that default provisioning does not create dangling child routes.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts tests/install-edge-site-publisher.test.ts tests/os-device-authority-worker.test.ts`.
- Expected red failure: route seed currently fans one launcher key/version out to every Site route and has no `publishedSiteIds` contract.

## current status

- Root cause reproduced. Device authority owned one launcher snapshot descriptor while route seeding derived and activated all child Site routes.
- Route seeding now requires an explicit proven publication set and defaults safely to launcher-only.
- Device authority registers only the launcher object it actually owns. The platform publisher supplies the complete Site set after planning every local snapshot.
- Missing R2 objects now render a redacted service-unavailable page rather than the misleading sign-in/platform-protection instructions.
- Focused contracts are green: 74 tests across route seed, publisher, edge router, device authority, and Sites/Gateway integration.
- Syntax/typecheck and `git diff --check` pass. Review, verify, promotion, and live publication remain.

## files changed

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 03:25:55 `review.run`: passed — OK
- 2026-07-28 03:26:11 `verify`: passed — OK

## key decisions

- Use an explicit published-Site allowlist at the route boundary rather than probing R2 from route generation. Publication owns object existence; route generation consumes that proven set.
- Keep the public installer free of Cloudflare administrative credentials. The explicit platform/operator publisher remains the only R2/D1 mutation path.
- Keep one release version across the Site set. The defect is missing object publication, not shared release-version semantics.
- Keep Gateway service routes available independently of static Site shells; only immutable snapshot routes require publication proof.
- Preserve the generic platform-safety page for auth and unknown-host failures, but classify a missing published object as a service outage.

## validation evidence

- Red proof: the focused suite failed because default route seed and device-authority registration still activated `/configuration`, `/tools`, `/environments`, and `/secrets` from a launcher-only descriptor.
- Green proof: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/install-edge-site-publisher.test.ts tests/os-device-authority-worker.test.ts tests/workspace-edge-sites-gateway-integration.test.ts` — 5 files, 74 tests passed.
- `bun run --cwd packages/os typecheck` — passed.
- `git diff --check` — passed.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/smoke-workspace-edge.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-28 03:24:34 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-07-28 03:24:34 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-07-28 03:25:20 apply-patch: `.task/security/repair-hosted-workspace-site-snapshot-publication/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/repair-hosted-workspace-site-snapshot-publication/current.json`, `.task/security/repair-hosted-workspace-site-snapshot-publication/evidence-log.json`, `.task/security/repair-hosted-workspace-site-snapshot-publication/read-log.json`, `.task/security/repair-hosted-workspace-site-snapshot-publication/session.json`, `.task/security/repair-hosted-workspace-site-snapshot-publication/workpad.md`, `.task/tasks/security/repair-hosted-workspace-site-snapshot-publication.json`, `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`, `packages/os/cloudflare/os-device-authority/src/types.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
