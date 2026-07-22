# plan sites edge cache architecture

branch: `task/sites/plan-sites-edge-cache-architecture`
stream: `stream/sites`
pr: https://github.com/consuelohq/opensaas/pull/1026
started: 2026-06-13

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Add test-first coverage for public site snapshot cache hits before D1.
- [x] Add test-first coverage for D1 `site-snapshot` routes reading immutable HTML from R2 and populating Cache API.
- [x] Add test-first coverage for missing snapshot failure without leaking storage details.
- [x] Extend current `workspace-edge` instead of adding a parallel Worker.
- [x] Keep existing proxy behavior for service-upstream and os-connector routes.

## Test-first contract

Behavior under test:
- Public `site-snapshot` responses can be returned from Cache API before D1 or origin/storage work.
- D1-resolved `site-snapshot` routes read from R2, set durable cache headers, and populate Cache API.
- Missing snapshots fail closed with a safe 503 response.

Focused red command:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test packages/os/tests/cloudflare-edge-router.test.ts`

Red evidence:
- New site-snapshot tests failed first: expected 200 got 503, and missing snapshot returned `WORKSPACE_EDGE_AUTH_REQUIRED` instead of `WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE`.

## current status

- Implementation complete locally.
- Existing `consuelo-workspace-edge` Worker now has the site snapshot read foundation, R2 binding, and `sites.consuelohq.com/*` route.
- KV is intentionally deferred; current repo has no KV namespace provisioned. R2 + Cache API gives the correct edge-owned read path without adding unnecessary infra.

## files changed

- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`

## validation evidence

- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts tests/cloudflare-d1-route-registry.test.ts` -> 21/21 passed.
- `cd packages/os && bun run typecheck` -> workspace script syntax checks passed.
- `cd packages/os && bun run cloudflare:workspace-edge:deploy:dry-run` -> dry-run passed and shows D1 + R2 bindings.

## key decisions

- Use existing `consuelo-workspace-edge` Worker and existing D1 route registry.
- Add R2 for versioned site snapshots now.
- Use Cloudflare Cache API for instant public reads.
- Defer KV until a real namespace is provisioned and needed as a hot pointer/small HTML accelerator.

- 2026-06-13 21:43:33 write: `.task/sites/plan-sites-edge-cache-architecture/workpad.md`

## workspace-owned: files changed

- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`

## workspace-owned: activity log

- 2026-06-13 21:43:33 fs.write: `.task/sites/plan-sites-edge-cache-architecture/workpad.md`
- 2026-06-13 21:44:56 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-13 21:45:31 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-13 21:46:07 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-13 21:47:18 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

## workspace-owned: validation evidence

- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts tests/cloudflare-d1-route-registry.test.ts` -> 21/21 passed.
- `cd packages/os && bun run typecheck` -> workspace script syntax checks passed.
- `cd packages/os && bun run cloudflare:workspace-edge:deploy:dry-run` -> dry-run passed and shows D1 + R2 bindings.
- 2026-06-13 21:44:17 `review.run`: passed — OK
- 2026-06-13 21:48:20 `review.run`: passed — OK
- 2026-06-13 21:48:42 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-06-13 21:47:18 patch lines 342-342: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

## workspace-owned: test selection

- changed files: `.task/sites/plan-sites-edge-cache-architecture/current.json`, `.task/sites/plan-sites-edge-cache-architecture/evidence-log.json`, `.task/sites/plan-sites-edge-cache-architecture/read-log.json`, `.task/sites/plan-sites-edge-cache-architecture/session.json`, `.task/sites/plan-sites-edge-cache-architecture/workpad.md`, `.task/tasks/sites/plan-sites-edge-cache-architecture.json`, `packages/os/cloudflare/workspace-edge/README.md`, `packages/os/cloudflare/workspace-edge/src/index.ts`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
