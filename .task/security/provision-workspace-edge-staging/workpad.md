# provision workspace edge staging

branch: `task/security/provision-workspace-edge-staging`
stream: `stream/security`
task pr: https://app.graphite.com/github/pr/consuelohq/opensaas/980/provision-workspace-edge-staging
github pr: https://github.com/consuelohq/opensaas/pull/980
started: 2026-06-12

## acceptance criteria

- [ ] Create or locate a real Cloudflare D1 database for `consuelo-workspace-route-registry`.
- [ ] Replace the placeholder workspace-edge Wrangler `database_id` only with a real Cloudflare database id.
- [ ] Configure Worker secret `CONSUELO_EDGE_SIGNING_SECRET` without printing or committing secret material.
- [ ] Apply workspace-edge D1 migrations.
- [ ] Deploy the Cloudflare Worker when prerequisites are available.
- [ ] Seed one internal workspace route/connector record only after the target workspace host and origin/connector values are verified.
- [ ] Run the safe smoke plan and any available live smoke checks without exposing secrets.
- [ ] Preserve the architecture: Cloudflare public edge/router, installed OS behind local `127.0.0.1`, Cloudflare Tunnel first, relay separable.
- [ ] Publish any repo config change through the task workflow, or record a no-code operations blocker with exact evidence.

## plan

1. Read current workspace-edge files, package scripts, D1 registry implementation, smoke script, and prior workpad/context.
2. Check Cloudflare/Wrangler account state and D1 database inventory without printing credentials.
3. If the D1 database exists or can be created, update `wrangler.toml` with the real id and validate contracts.
4. Configure the Worker secret through Wrangler stdin or another non-printing path.
5. Apply migrations and deploy the Worker.
6. Seed a staging/internal route only with verified non-secret route values.
7. Run smoke evidence and publish the task if repo changes were required.

## Test-first contract

Behavior under test:
- The existing workspace gateway deployment contract should remain green with a real D1 `database_id` replacing the placeholder.
- D1 registry contract should remain green after any configuration/migration adjustment.
- Runtime operations should be proven by safe Wrangler commands: D1 list/create, migration apply, Worker dry-run/deploy, and smoke plan/live check where available.

Existing local pattern to follow:
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts` validates the Worker/Wrangler deployment surface.
- `packages/os/tests/cloudflare-d1-route-registry.test.ts` validates registry behavior.
- `packages/os/scripts/smoke-workspace-edge.ts` emits the safe smoke plan.

New or changed tests:
- No new test planned initially. This task is primarily provisioning/configuration. Existing contract tests should fail only if the config remains invalid or is changed incorrectly.

Focused command:
```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/cloudflare-d1-route-registry.test.ts
```

Expected failure before implementation:
- If the real D1 id is still missing, the contract should expose the placeholder database id gap once tightened or the deploy command should fail on Wrangler validation.

## current status

- Stream synced with main after Ko merged the previous work.
- Task started from `stream/security`.
- Implementation/provisioning not started.

## files changed

- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/smoke-workspace-edge.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`

## key decisions

- Do not fabricate the D1 `database_id`.
- Do not print or commit Worker secret material.

## validation evidence

- pending

## blockers

- pending Cloudflare/Wrangler state inspection.

- 2026-06-12 16:01:44 write: `.task/security/provision-workspace-edge-staging/workpad.md`

## workspace-owned: files changed

- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/smoke-workspace-edge.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`

## workspace-owned: activity log

- 2026-06-12 16:01:44 fs.write: `.task/security/provision-workspace-edge-staging/workpad.md`
- 2026-06-12 16:06:55 fs.patch: `packages/os/cloudflare/workspace-edge/wrangler.toml`
- 2026-06-12 16:11:13 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 16:13:47 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 17:05:29 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 17:05:59 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 17:06:39 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 17:07:10 fs.write: `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- 2026-06-12 17:07:59 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 17:09:06 fs.patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-06-12 17:10:41 fs.write: `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- 2026-06-12 17:11:10 fs.write: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-12 17:11:43 fs.patch: `packages/os/package.json`
- 2026-06-12 17:12:50 fs.patch: `packages/os/package.json`
- 2026-06-12 17:13:13 fs.patch: `packages/os/cloudflare/workspace-edge/wrangler.toml`
- 2026-06-12 17:13:20 fs.patch: `packages/os/scripts/smoke-workspace-edge.ts`
- 2026-06-12 17:14:34 fs.patch: `packages/os/scripts/smoke-workspace-edge.ts`
- 2026-06-12 17:15:51 fs.patch: `packages/os/package.json`
- 2026-06-12 17:18:09 fs.patch: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-06-12 17:19:32 fs.patch: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-06-12 17:21:53 fs.patch: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-06-12 17:23:31 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- 2026-06-12 17:24:23 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- 2026-06-12 17:27:35 fs.patch: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-12 17:29:14 fs.patch: `packages/os/scripts/seed-workspace-edge-route.ts`

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/smoke-workspace-edge.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`

## workspace-owned: TDD green evidence

  - output: contract.test.ts:[2m84:30[22m[39m [90m 82| [39m [90m 83| [39m it('should add package scripts for dry-run deploy, migration, and ru… [90m 84| [39m const packageJson = JSON.parse(readRequiredFile(packageJsonPath)) … [90m | [39m [31m^[39m [90m 85| [39m scripts[33m?[39m[33m:[39m [33mRecord[39m[33m<[39mstring[33m,[39m string[33m>[39m[33m;[39m [90m 86| [39m }[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-12 17:15:58 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts`: passed exit 0 trace: `trc_a6f438fa1806`
  - output: → tmux: opensaas-security-provision-workspace-edge-staging-1ac6cfe2 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts"
- 2026-06-12 17:24:43 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts`: passed exit 0 trace: `trc_9f5b68918096`
  - output: → tmux: opensaas-security-provision-workspace-edge-staging-1ac6cfe2 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts"
- 2026-06-12 17:25:37 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts tests/workspace-edge-beta-smoke-contract.test.ts`: passed exit 0 trace: `trc_07c0ac046023`
  - output: → tmux: opensaas-security-provision-workspace-edge-staging-1ac6cfe2 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts" tests/workspace-edge-beta-smoke-contract.test.ts
- 2026-06-12 17:27:57 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts tests/workspace-edge-beta-smoke-contract.test.ts`: passed exit 0 trace: `trc_143e3ed902a4`
  - output: → tmux: opensaas-security-provision-workspace-edge-staging-1ac6cfe2 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts" tests/workspace-edge-beta-smoke-contract.test.ts
- 2026-06-12 17:29:42 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts tests/workspace-edge-beta-smoke-contract.test.ts`: passed exit 0 trace: `trc_dbf85a9aeda1`
  - output: → tmux: opensaas-security-provision-workspace-edge-staging-1ac6cfe2 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts" tests/workspace-edge-beta-smoke-contract.test.ts

## workspace-owned: TDD red evidence

- 2026-06-12 17:11:43 patch lines 80-85: `packages/os/package.json`
- 2026-06-12 17:12:50 patch lines 80-86: `packages/os/package.json`
- 2026-06-12 17:13:13 patch lines 7-7: `packages/os/cloudflare/workspace-edge/wrangler.toml`
- 2026-06-12 17:13:20 patch lines 24-24: `packages/os/scripts/smoke-workspace-edge.ts`
- 2026-06-12 17:14:34 patch lines 19-31: `packages/os/scripts/smoke-workspace-edge.ts`
- 2026-06-12 17:15:51 patch lines 87-87: `packages/os/package.json`
- 2026-06-12 17:18:09 patch lines 302-302: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-06-12 17:19:32 patch lines 294-385: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-06-12 17:21:53 patch lines 498-501: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-06-12 17:22:31 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-d1-route-registry.test.ts`: failed exit 1 trace: `trc_7283a16869b0`
  - output: ontract[2m > [22mshould use root routes as host-level fallbacks after more-specific routes [31m[1mAssertionError[22m: expected { allowed: false, status: 404, …(2) } to match object { allowed: true, route: '/', …(1) } (3 matching properties omitted from actual)[39m [32m- Expected[39m [31m+ Received[39m [2m {[22m [32m- "allowed": true,[39m [32m- "route": "/",[39m [32m- "surface": "app",[39m [31m+ "allowed": false,[39m [2m }[22m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-12 17:23:31 patch lines 203-204: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`

- 2026-06-12 17:24:23 patch lines 188-220: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`

## workspace-owned: validation evidence

- pending
- 2026-06-12 17:27:02 `review.run`: passed — OK
- 2026-06-12 17:27:35 patch lines 39-61: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-12 17:29:14 patch lines 66-68: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-12 17:30:32 `review.run`: passed — OK
- 2026-06-12 17:30:45 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/provision-workspace-edge-staging/current.json`, `.task/security/provision-workspace-edge-staging/evidence-log.json`, `.task/security/provision-workspace-edge-staging/read-log.json`, `.task/security/provision-workspace-edge-staging/session.json`, `.task/security/provision-workspace-edge-staging/workpad.md`, `.task/tasks/security/provision-workspace-edge-staging.json`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/package.json`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/seed-workspace-edge-route.ts`, `packages/os/scripts/smoke-workspace-edge.ts`, `packages/os/tests/cloudflare-d1-route-registry.test.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
