# resolve os stream conflicts and ship to main

branch: `task/os/resolve-os-stream-conflicts-and-ship-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1434/resolve-os-stream-conflicts-and-ship-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1434
started: 2026-07-13

## acceptance criteria

- [x] Merge current `main` into the OS task without restoring the deleted monolithic `packages/os/scripts/server.ts`.
- [x] Preserve the Hono server composition under `packages/os/scripts/server/` and expose Settings snapshot/overlay through a focused Hono route module.
- [x] Preserve signed authorization and authorize before resolving or disclosing local OS-home/configuration state.
- [x] Register Settings routes in the local route-policy contract with the existing read/write scopes.
- [x] Preserve canonical local port `46321`, including legacy `8960` config migration, docs, Docker, reload, daemon, and health probes.
- [x] Keep `start-brain.sh` and `start-brain-daemon.sh` deleted; keep `start-consuelo-daemon.sh` as the only OS daemon launcher and launch `scripts/server/main.ts`.
- [x] Preserve all OS stream features: Settings/manifest overlay, installer dry-run, semantic PR review collection, and verified Effect MCP adapters.
- [x] Add focused regression coverage for Hono Settings routes, auth-first behavior, current server/daemon/port contract, and route policies.
- [x] Run focused and adjacent OS suites, syntax/type checks, real isolated Hono runtime smoke, strict review, and full verify.
- [ ] Push the task, merge it into `stream/os`, refresh and merge PR #1343 into `main`, then verify the merged main contract.

## plan

1. Merge current `origin/main` into this task and reproduce the three known modify/delete conflicts.
2. Retain main's Hono server and canonical daemon/port architecture; keep the legacy files deleted.
3. Add a Settings Hono route adapter and policy entries around the existing stream-owned Settings gateway application functions.
4. Update or add focused tests first so missing Hono Settings routes are red before implementation.
5. Run focused Settings/server/installer/local-agent tests, then static/type/review/verify and an isolated runtime HTTP smoke.
6. Promote through `stream/os`, inspect PR #1343's final diff/checks, merge to `main`, and verify main again.

## Test-first contract

- Behavior under test: the current Hono server serves authenticated Settings snapshot and overlay endpoints while keeping port 46321, canonical daemon entrypoints, and auth-first failure ordering.
- Existing pattern: Hono route modules in `packages/os/scripts/server/routes`, `LOCAL_OS_ROUTE_POLICIES`, server contract tests, and existing Settings gateway endpoint/unit suites.
- New/changed tests: add a focused Hono Settings route suite; update the route-policy and product-server contract if merge output does not already carry main's current assertions.
- Red expectation: after retaining main's Hono server and deleting the old monolith, `/gateway/settings/snapshot` and `/gateway/settings/overlay` are not registered in the Hono app or route-policy list.
- Focused red command: `bun test packages/os/tests/settings-hono-routes.test.ts packages/os/tests/bun-product-server-contract.test.ts`.
- No-test waiver: not applicable; this changes HTTP routing and release-critical runtime integration.

## current status

- Ko approved the exact conflict strategy and merging PR #1343 to `main`.
- Current `origin/main` has been merged into the task. The three modify/delete conflicts were resolved by retaining main's deletions.
- Settings snapshot/overlay now run through a focused Hono route module with auth-first behavior and explicit signed route policies.
- Port 46321, legacy-port migration, the canonical daemon, and verified local-agent MCP behavior are green.
- Merge commit `fe0b5a4cdad6490562bf701977f32848ce5c5024` created.
- Strict review passed with zero issues.
- Full verify is publish-valid.
- Task push, stream promotion, #1343 merge, and merged-main verification remain.

## files changed

- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/tests/settings-hono-routes.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/scripts/server.ts` remains deleted
- `packages/os/scripts/start-brain.sh` remains deleted
- `packages/os/scripts/start-brain-daemon.sh` remains deleted
- task metadata and verification evidence

## workspace-owned: files changed

- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/tests/settings-hono-routes.test.ts`

## workspace-owned: activity log

- 2026-07-13 00:15:53 fs.write: `.task/os/resolve-os-stream-conflicts-and-ship-to-main/workpad.md`
- 2026-07-13 00:17:36 fs.write: `packages/os/tests/settings-hono-routes.test.ts`
- 2026-07-13 00:18:08 fs.write: `packages/os/scripts/server/routes/settings.ts`
- Task started after the read-only merge simulation and shipping-plan approval.

## workspace-owned: validation evidence

- Preflight merge simulation identified three modify/delete conflicts: `scripts/server.ts`, `scripts/start-brain.sh`, and `scripts/start-brain-daemon.sh`.
- Current main was previously confirmed to own Hono composition, `scripts/server/main.ts`, canonical port 46321, and legacy-port migration.
- Red focused test reproduced 404s for Settings snapshot/overlay and a stale launcher assertion.
- Focused Hono/server contract: 23 tests passed, 108 expectations.
- Bun-native Settings/installer/local-agent/port suite: 46 tests passed, 454 expectations.
- Exact OS CI contract suite: 38 tests passed, 5 environment-gated tests skipped.
- `bun run typecheck`: workspace script syntax checks passed.
- Direct MCP diagnostic returned protocol `2024-11-05` with 5 tools; the full local-agent connectivity suite passed after replacing a brittle asymmetric matcher with direct integer/positivity assertions.
- Real isolated `bun scripts/server/main.ts` smoke passed: health 200, signed Settings snapshot 200, signed overlay 200, and the selected tool was persisted disabled.
- `git diff --check`, staged diff check, targeted conflict-marker scan, and unmerged-path scan are clean.
- Strict `review.run` against `origin/main`: 0 blocking issues, 0 pre-existing issues, 0 failed suites.
- Full `verify` against `origin/main`: publish-valid; static rules, ESLint, typecheck, spec compliance, and database guard passed.
- 2026-07-13 00:25:11 `review.run`: passed — OK
- 2026-07-13 00:25:25 `verify`: passed — OK

## key decisions

- Never restore the monolithic server or the two legacy launchers.
- Port Settings into Hono rather than choosing the stream's old server implementation.
- Keep HTTP transport in Hono and reuse the existing Settings application/domain functions.
- Treat current main's purposeful deletions and port migration as source-of-truth changes.

## notes for ko

- Broader automated review debt remains deferred to the already-saved single shared cleanup-PR handoffs.

## improvements noticed

- none yet

## issues and recovery

- The OS stream documentation described port 8960 before synchronization; merging main restored the current 46321 contract.
- Initial broad test attempts used the wrong runner/cwd and produced false module-resolution and mocking failures. Re-ran Bun-native suites with `bun test` from `packages/os` and exact CI Vitest suites with their native commands.
- A repository-wide conflict-marker scan matched ordinary separator lines. Replaced it with a targeted `^(<<<<<<<|=======|>>>>>>>)` scan over integration files.
- The local-agent handshake product path was healthy (`toolCount: 5`); only the mixed Bun/Vitest number matcher was brittle, so the assertion now checks integer-ness and positivity directly.

---

## publish checklist

```bash
bun run task:push -- --message "chore(os): integrate stream with hono server" --changed
bun run task:pr
bun run task:merge -- --pr 1343
bun run task:finish
```

- 2026-07-13 00:15:53 write: `.task/os/resolve-os-stream-conflicts-and-ship-to-main/workpad.md`

- 2026-07-13 00:17:36 write: `packages/os/tests/settings-hono-routes.test.ts`

- 2026-07-13 00:18:08 write: `packages/os/scripts/server/routes/settings.ts`

## workspace-owned: files read

- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/add-os-settings-gateway-edge-proxy-routes/current.json`, `.task/os/add-os-settings-gateway-edge-proxy-routes/session.json`, `.task/os/add-os-settings-gateway-edge-proxy-routes/workpad.md`, `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/current.json`, `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/session.json`, `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/verify.json`, `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/workpad.md`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/current.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/evidence-log.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/read-log.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/session.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/workpad.md`, `.task/os/installer-dry-run/current.json`, `.task/os/installer-dry-run/evidence-log.json`, `.task/os/installer-dry-run/read-log.json`, `.task/os/installer-dry-run/session.json`, `.task/os/installer-dry-run/verify.json`, `.task/os/installer-dry-run/workpad.md`, `.task/os/promote-os-pr-review-collector-to-github-reviews/current.json`, `.task/os/promote-os-pr-review-collector-to-github-reviews/session.json`, `.task/os/promote-os-pr-review-collector-to-github-reviews/verify.json`, `.task/os/promote-os-pr-review-collector-to-github-reviews/workpad.md`, `.task/os/remove-legacy-os-brain-launchers/current.json`, `.task/os/remove-legacy-os-brain-launchers/evidence-log.json`, `.task/os/remove-legacy-os-brain-launchers/read-log.json`, `.task/os/remove-legacy-os-brain-launchers/session.json`, `.task/os/remove-legacy-os-brain-launchers/verify.json`, `.task/os/remove-legacy-os-brain-launchers/workpad.md`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/current.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/evidence-log.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/read-log.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/session.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/verify.json`, `.task/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters/workpad.md`, `.task/os/resolve-os-stream-conflicts-and-ship-to-main/current.json`, `.task/os/resolve-os-stream-conflicts-and-ship-to-main/evidence-log.json`, `.task/os/resolve-os-stream-conflicts-and-ship-to-main/read-log.json`, `.task/os/resolve-os-stream-conflicts-and-ship-to-main/session.json`, `.task/os/resolve-os-stream-conflicts-and-ship-to-main/workpad.md`, `.task/tasks/os/add-os-settings-gateway-edge-proxy-routes.json`, `.task/tasks/os/add-os-settings-page-read-only-shell-and-dual-preview.json`, `.task/tasks/os/add-workspace-mcp-bootstrap-to-agents-md.json`, `.task/tasks/os/installer-dry-run.json`, `.task/tasks/os/promote-os-pr-review-collector-to-github-reviews.json`, `.task/tasks/os/remove-legacy-os-brain-launchers.json`, `.task/tasks/os/replace-false-local-agent-connections-with-verified-effect-mcp-adapters.json`, `.task/tasks/os/resolve-os-stream-conflicts-and-ship-to-main.json`, `AGENTS.md`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/consuelo-reload.js`, `packages/os/scripts/github.js`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/capabilities.ts`, `packages/os/scripts/lib/consuelo-sites-settings-adapter.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/manifest-overlay.ts`, `packages/os/scripts/lib/manifest.ts`, `packages/os/scripts/lib/mcp-gateway.ts`, `packages/os/scripts/lib/pr-review-collector.js`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/settings-gateway.ts`, `packages/os/scripts/lib/settings-overlay-command.ts`, `packages/os/scripts/lib/settings-site.ts`, `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`, `packages/os/scripts/lib/settings-snapshot.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/os.ts`, `packages/os/scripts/pr-review.js`, `packages/os/scripts/server/app.ts`, `packages/os/scripts/server/route-policies.ts`, `packages/os/scripts/server/routes/settings.ts`, `packages/os/scripts/start-brain-daemon.sh`, `packages/os/scripts/start-brain.sh`, `packages/os/scripts/tools-search.ts`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tests/consuelo-sites-gateway.test.ts`, `packages/os/tests/consuelo-sites-settings-adapter.test.ts`, `packages/os/tests/github-pr-reviews.test.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/installer-local-agent-connectivity.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/local-os-server-hono-architecture.test.ts`, `packages/os/tests/manifest-overlay.test.ts`, `packages/os/tests/pr-review-collector.test.js`, `packages/os/tests/pr-review.test.js`, `packages/os/tests/settings-gateway.test.ts`, `packages/os/tests/settings-hono-routes.test.ts`, `packages/os/tests/settings-site.test.ts`, `packages/os/tests/settings-sites-gateway-endpoints.test.ts`, `packages/os/tests/tools-search-v2.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
