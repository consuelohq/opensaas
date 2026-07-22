# wire install edge site snapshot publish

branch: `task/os/wire-install-edge-site-snapshot-publish`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1032/wire-install-edge-site-snapshot-publish
github pr: https://github.com/consuelohq/opensaas/pull/1032
started: 2026-06-14

## acceptance criteria

- [ ] Install fails loudly when the edge snapshot publish step fails after local provisioning.
- [ ] Install publishes the default local Sites index as an immutable R2 snapshot after approved workspace bootstrap.
- [ ] Install upserts a D1 `site-snapshot` route for `workspaceHost/` that points at the uploaded R2 key.
- [ ] Install warms and verifies `https://<workspaceHost>/` before reporting success.
- [ ] Install result JSON records edge publish status, keys, version, URL, and log path without printing secrets.

## test-first contract

Behavior under test:

- `publishWorkspaceEdgeSnapshot()` builds a deterministic immutable snapshot plan from `home/sites/index.html`, uploads it to R2, upserts a D1 `site-snapshot` route, verifies the edge response, and returns metadata for install JSON.
- Any failed stage throws an `INSTALL_EDGE_PUBLISH_FAILED` error that includes stage, workspace host, snapshot key, log path, and safe diagnostics.
- `install.ts` calls the edge publisher only after `provisionLocalOs()` and before final success. A failed edge publish rejects the install.

Existing pattern to follow:

- `install.ts` owns prompt + local provisioning orchestration.
- `workspace-edge-route-seed.ts` owns D1 SQL generation shape for `workspace_route_registry`.
- `workspace-cloudflare-edge-router.ts` exposes verification headers: `x-consuelo-edge-cache-authority`, `x-consuelo-sites-cache`, and `x-consuelo-site-version`.

Intended tests:

- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

Focused red command:

```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-edge-site-publisher.test.ts tests/install-workspace-bootstrap-contract.test.ts
```

Expected red failure before implementation:

- The new edge publisher module/export does not exist and install does not include edge publish metadata.

## plan

1. Add contract tests for edge snapshot planning, failure, and install wiring.
2. Implement `scripts/lib/install-edge-site-publisher.ts` with injectable command/fetch dependencies.
3. Wire `install.ts` to call the publisher after local provisioning and fail closed on any publish/verify error.
4. Run focused tests, typecheck, review, verify.

## current status

- Task started. Exploration done. Writing red tests next.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: activity log

- 2026-06-14 03:56:59 fs.write: `.task/os/wire-install-edge-site-snapshot-publish/workpad.md`
- 2026-06-14 03:57:44 fs.write: `packages/os/tests/install-edge-site-publisher.test.ts`
- 2026-06-14 04:00:58 fs.patch: `packages/os/tests/install-edge-site-publisher.test.ts`
- 2026-06-14 04:03:28 fs.write: `packages/os/scripts/lib/install-edge-site-publisher.ts`
- 2026-06-14 04:05:47 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-14 04:06:45 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-14 04:07:34 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-14 04:08:23 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-14 04:09:44 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-14 04:10:49 fs.patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: validation evidence

- 2026-06-14 04:14:13 `review.run`: passed — OK
- 2026-06-14 04:14:35 `verify`: passed — OK

## key decisions

- Edge publish is awaited before install success. Failures fail the whole install for dogfood.
- `workspace.consuelohq.com` remains temporary bridge. `internal.consuelohq.com` should be provisioned by install.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial `task.start` with `startFrom: stream/os` failed schema validation. Retried with `startFrom: stream`.
- `task.start` timed out once; later status showed no completed task, so retried with longer timeout and created PR #1032.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): wire install edge site snapshot publish" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/workspace-site-snapshot-publishing.test.ts`

- 2026-06-14 04:10:49 patch lines 168-169: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/wire-install-edge-site-snapshot-publish/current.json`, `.task/os/wire-install-edge-site-snapshot-publish/evidence-log.json`, `.task/os/wire-install-edge-site-snapshot-publish/read-log.json`, `.task/os/wire-install-edge-site-snapshot-publish/session.json`, `.task/os/wire-install-edge-site-snapshot-publish/workpad.md`, `.task/tasks/os/wire-install-edge-site-snapshot-publish.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
