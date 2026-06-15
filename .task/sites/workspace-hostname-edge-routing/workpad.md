# workspace hostname edge routing

branch: `task/sites/workspace-hostname-edge-routing`
pr: https://github.com/consuelohq/opensaas/pull/1028
started: 2026-06-14

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Treat workspace hostnames as the primary routing boundary: `kokayi.consuelohq.com`, `openai.consuelohq.com`, and future custom domains.
- [x] Protect reserved Consuelo platform hosts from wildcard workspace routing and pre-D1 cache reads.
- [x] Serve public root workspace sites through `site-snapshot` + Cache API/R2.
- [x] Keep private workspace/site routes out of public Cache API until session auth is implemented.
- [x] Keep `os-connector` and `service-upstream` proxy behavior intact.
- [x] Replace the narrow `sites.consuelohq.com/*` Worker route contract with controlled wildcard workspace routing.
- [x] Document the local-first authoring / edge-first publishing split.

## Test-first contract

Behavior under test:
- `*.consuelohq.com/*` is the Worker entry route for workspace hostnames.
- Reserved platform hosts such as `app.consuelohq.com`, `docs.consuelohq.com`, `diffs.consuelohq.com`, and `install.consuelohq.com` fail closed before cache and D1 work when they reach this Worker.
- Public workspace snapshot routes can be edge-cache hits before D1 for Consuelo workspace subdomains.
- Public workspace snapshot routes can miss cache, resolve D1, read R2, and populate Cache API for different workspace hostnames.
- Private snapshot routes fail closed and do not read/write public Cache API.
- Connector and upstream routes still require edge signing and preserve previous behavior.

Existing pattern to follow:
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts` owns Worker request routing.
- `packages/os/tests/cloudflare-edge-router.test.ts` owns router contracts.
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts` owns Wrangler route/deploy contracts.
- `packages/os/scripts/lib/workspace-cloudflare-gateway.ts` owns workspace-hostname planning concepts.

Focused red command:
`CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts`

Expected red failure:
- The current router has no reserved-host policy, treats cache pre-D1 too broadly, only models `auth: required`, and Wrangler still uses `sites.consuelohq.com/*`.

## current status

- Implementation complete locally. Red tests failed first for missing wildcard config, reserved-host handling, and private site-snapshot auth isolation.
- Green focused tests now cover workspace hostname snapshots, reserved host safety, existing edge router behavior, D1 route registry, and workspace gateway contracts.
- Wrangler dry-run confirms D1 and R2 bindings.

## validation evidence

- RED: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-hostname-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts` failed 3 tests before implementation.
- GREEN: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-hostname-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts tests/cloudflare-edge-router.test.ts tests/cloudflare-d1-route-registry.test.ts tests/workspace-cloudflare-gateway-contract.test.ts` passed 32/32.
- `cd packages/os && bun run typecheck` passed.
- `cd packages/os && bun run cloudflare:workspace-edge:deploy:dry-run` passed with D1 + R2 bindings.

- 2026-06-14 00:44:51 write: `.task/sites/workspace-hostname-edge-routing/workpad.md`

## files changed

- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`

## workspace-owned: activity log

- 2026-06-14 00:44:51 fs.write: `.task/sites/workspace-hostname-edge-routing/workpad.md`
- 2026-06-14 00:45:31 fs.write: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 00:47:19 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 00:48:10 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 00:48:41 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 00:48:56 fs.write: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 00:49:31 fs.write: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 00:51:24 fs.write: `packages/os/tests/workspace-hostname-edge-router.test.ts`
- 2026-06-14 00:51:45 fs.write: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-14 00:54:06 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:54:37 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:55:16 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:56:38 fs.write: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:56:50 fs.write: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:57:05 fs.write: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:57:18 fs.write: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:57:39 fs.write: `packages/os/cloudflare/workspace-edge/wrangler.toml`
- 2026-06-14 00:58:06 fs.write: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 00:59:37 fs.write: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-14 01:02:36 fs.write: `packages/os/cloudflare/workspace-edge/README.md`
- 2026-06-14 01:03:23 fs.write: `.task/sites/workspace-hostname-edge-routing/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`

- 2026-06-14 00:59:37 write: `packages/os/tests/cloudflare-edge-router.test.ts`

- 2026-06-14 01:02:36 write: `packages/os/cloudflare/workspace-edge/README.md`


- 2026-06-14 01:03:23 write: `.task/sites/workspace-hostname-edge-routing/workpad.md`

## workspace-owned: validation evidence

- RED: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-hostname-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts` failed 3 tests before implementation.
- GREEN: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-hostname-edge-router.test.ts tests/cloudflare-worker-deployment-contract.test.ts tests/cloudflare-edge-router.test.ts tests/cloudflare-d1-route-registry.test.ts tests/workspace-cloudflare-gateway-contract.test.ts` passed 32/32.
- `cd packages/os && bun run typecheck` passed.
- `cd packages/os && bun run cloudflare:workspace-edge:deploy:dry-run` passed with D1 + R2 bindings.
- 2026-06-14 00:44:51 write: `.task/sites/workspace-hostname-edge-routing/workpad.md`
- 2026-06-14 01:04:20 `review.run`: passed — OK
- 2026-06-14 01:04:54 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/sites/workspace-hostname-edge-routing/current.json`, `.task/sites/workspace-hostname-edge-routing/evidence-log.json`, `.task/sites/workspace-hostname-edge-routing/read-log.json`, `.task/sites/workspace-hostname-edge-routing/session.json`, `.task/sites/workspace-hostname-edge-routing/workpad.md`, `.task/tasks/sites/workspace-hostname-edge-routing.json`, `packages/os/cloudflare/workspace-edge/README.md`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`, `packages/os/tests/workspace-hostname-edge-router.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
