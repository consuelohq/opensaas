# fix workspace gateway review comments

branch: `task/security/fix-workspace-gateway-review-comments`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/979/fix-workspace-gateway-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/979
started: 2026-06-11

## acceptance criteria

- [ ] Resolve valid active CodeRabbit and Codex comments on stream PR #969 for the workspace gateway work.
- [ ] Preserve the security model: Cloudflare remains the public edge/router, installed OS remains behind local `127.0.0.1` gateway upstream, Cloudflare Tunnel fails closed without token material, and secrets are not committed or printed.
- [ ] Align the Cloudflare D1 migration and Worker contract with the actual D1 registry implementation.
- [ ] Keep installer workspace bootstrap behavior consistent with connector credentials and restore the full Sites scaffold.
- [ ] Make `smoke:workspace-edge` run a real entrypoint instead of a passive library module.
- [ ] Add XML escaping for generated launchd plist values.
- [ ] Handle the Wrangler D1 `database_id` review item honestly; do not invent a production Cloudflare database id.
- [ ] Run focused OS gateway tests, review against `origin/stream/security`, and verify against `origin/stream/security` before publish.

## plan

1. Read current review comments, related standards, tests, Worker files, registry implementation, installer materialization, and existing Sites behavior.
2. Update tests/contracts first where the current contract conflicts with the intended fail-closed behavior or actual registry schema.
3. Implement the smallest correct cleanup patch across migration, Worker, installer, and smoke script entrypoint.
4. Run focused tests, diff review, workspace review, verify, push, promote to stream, and finish when safe.

## Test-first contract

Behavior under test:
- Opt-in workspace gateway contracts should encode the intended deployment and install behavior: D1 schema consumed by the registry, tunnel token required for configured Cloudflare Tunnel connector flows, launchd only when token material exists, and smoke entrypoint available.
- Installer provisioning should still produce a complete Sites scaffold and generated security material without storing connector bootstrap secrets in config/auth/Caddy.
- D1 registry fail-closed behavior should remain green while preserving diagnostic error context.

Existing local pattern to follow:
- `packages/os/tests/*contract.test.ts` architecture contracts are opt-in under `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.
- Existing `packages/os/scripts/lib/workspace-cloudflare-*` modules model gateway planning and fail-closed routing behavior without committed secrets.

New or changed tests:
- Update existing opt-in contracts for migration schema and tunnel-token bootstrap fixture expectations. Add focused assertions only where they make review findings executable.

Focused red command:
```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/install-workspace-bootstrap-contract.test.ts \
  tests/cloudflare-connector-transport-contract.test.ts \
  tests/workspace-edge-beta-smoke-contract.test.ts \
  tests/cloudflare-d1-route-registry.test.ts
```

Expected red failure:
- Before edits, at least the migration/contract expectations should expose registry schema mismatch or installer scaffold/token expectation mismatch. If the current stream already passes the selected tests, record the run as a baseline and treat changed contract assertions as the executable spec for the cleanup.

## current status

- Task started from `stream/security`.
- Active review comments collected from PR #969. Implementation not started yet.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- The Wrangler `database_id` comment may require a real Cloudflare D1 database id or a repo-supported deployment templating path. Do not fake this value.

## validation evidence

- pending

## issues and recovery

- none yet

- 2026-06-11 23:21:28 write: `.task/security/fix-workspace-gateway-review-comments/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-11 23:21:28 fs.write: `.task/security/fix-workspace-gateway-review-comments/workpad.md`

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-edge-beta-smoke.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: validation evidence

- pending
- 2026-06-11 23:49:45 `review.run`: passed — OK
- 2026-06-11 23:50:27 `review.run`: passed — OK
- 2026-06-11 23:50:51 `verify`: passed — OK
- 2026-06-11 23:55:37 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-workspace-gateway-review-comments/current.json`, `.task/security/fix-workspace-gateway-review-comments/evidence-log.json`, `.task/security/fix-workspace-gateway-review-comments/read-log.json`, `.task/security/fix-workspace-gateway-review-comments/session.json`, `.task/security/fix-workspace-gateway-review-comments/verify.json`, `.task/security/fix-workspace-gateway-review-comments/workpad.md`, `.task/tasks/security/fix-workspace-gateway-review-comments.json`, `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`, `packages/os/cloudflare/workspace-edge/src/index.ts`, `packages/os/package.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/smoke-workspace-edge.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final implementation notes

- Addressed Codex fixture/contract findings by requiring a Cloudflare Tunnel token in bootstrap fixtures before expecting connector and launchd configuration.
- Aligned the Cloudflare D1 migration contract with the D1 registry implementation by using `workspace_route_registry` with `record_json`, connector metadata, CHECK constraints, indexes, and a foreign key to `workspace_connectors`.
- Restored install-time Sites scaffold generation without importing `sites.ts` on the Node/Vitest import path that previously pulled `bun:sqlite`.
- Added XML escaping for generated launchd plist string values.
- Added a runnable `smoke:workspace-edge` entrypoint that emits the smoke plan and keeps live execution disabled until staging edge routing exists.
- Added D1 diagnostic context on fail-closed route-registry errors.
- Reused the registry D1 type in the Worker and added structured fail-closed error reporting via an optional Worker logger binding.
- Intentionally retained the Worker default export because Cloudflare's module Worker runtime documents the fetch handler as a default export object. This resolves the review intent without breaking runtime compatibility.
- `wrangler d1 list --json` returned an empty list in the current environment, so there is no real database id available to commit. The placeholder remains a deployment prerequisite rather than a fabricated production id.

## final validation evidence

- Baseline focused contracts before edits: `trc_457d5546a8f0` — 5 files passed, 18 tests.
- Post-edit focused contracts initially caught an install-state syntax error: `trc_75fc05f3fc1b`; fixed before publish.
- Final focused contracts: `trc_54a1d8d75a2b` — 5 files passed, 18 tests.
- Smoke script command: `trc_742cb92d61d5` — `cd packages/os && bun run smoke:workspace-edge` emitted an 8-step safe plan.
- Changed-file syntax check: `trc_15f75f3718f2` and `trc_4d55e7824e72` — passed.
- `git diff --check`: `trc_e47d37c45649` — passed.
- `review.run --base origin/stream/security`: `trc_e96d5fc9cd8a` — zero issues, zero blockers.
- `verify --base origin/stream/security`: `trc_b80f1b4ea585` — publish-valid true.
