# make authenticated workspace subroutes survive releases and lifecycle reconciliation

branch: `task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2018/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation
github pr: https://github.com/consuelohq/opensaas/pull/2018
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 04:25:19 fs.write: `.task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation/workpad.md`
- 2026-08-15 04:35:32 fs.write: `.task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation/workpad.md`
- 2026-08-15 04:37:04 fs.write: `.task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:36:31 `review.run`: passed — OK
- 2026-08-15 04:36:57 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/migrations.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/private-workspace-session-recovery.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/migrations/reconcile-caddy-ha-watchdog.ts`
- `packages/os/scripts/migrations/reconcile-caddy-worker-pool.ts`
- `packages/os/scripts/server.js`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/os/tests/workspace-gateway-node-end-to-end.test.ts`
- `packages/os/tests/workspace-gateway-node-proxy.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release-workspace-edge.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Test-first contract

behavior under test:
1. A user with an authenticated workspace web session can load every release-managed private OS subroute (Tools, Nodes, Secrets, Configuration, Environments, Observability/Traces) and its backing data API without being rejected as a missing signed workspace-edge request.
2. Internal edge-to-node APIs remain fail-closed for unsigned machine traffic; the browser/session path must be adapted at the edge rather than weakening signed-edge authorization.
3. Device Authority release/reconciliation and local restart/update must preserve the route auth mode, connector ownership, and browser-session-to-signed-edge translation for every private subroute.
4. Add a loud table-driven regression contract that enumerates the complete private subroute/API matrix so adding or changing a subroute cannot silently bypass authenticated browser routing.

existing local pattern: workspace Device Authority private Site routing, workspace-session auth, edge signing/proxy helpers, Configuration/Tools/Nodes/Secrets/Environment gateway endpoints, release-managed Site route registry, lifecycle reconciliation tests.
new or changed tests: first reproduce the current browser-session request path for at least Tools and one other private subroute and assert it currently reaches a signed-edge-only local endpoint without injected edge headers; then replace the narrow repro with a table-driven all-private-routes contract plus release/restart/update preservation assertions.
focused red command: run the narrowest Device Authority/private Sites gateway test(s) that cover workspace-session browser requests to Configuration APIs after adding the regression assertions.
expected red failure: authenticated browser/session request returns MISSING_EDGE_SIGNATURE or the route registry lacks the session-authenticated proxy/signing hop for one or more private subroutes.
no-test waiver: not applicable.

## Acceptance criteria

- The screenshot failure class is reproduced in test before production edits.
- Authenticated browser sessions work across all private OS subroutes and backing APIs.
- No signed-edge requirement is removed from node-local/internal endpoints.
- The route/API matrix is explicit and fails loudly when a private subroute is added without browser-session routing coverage.
- Release, heartbeat reconciliation, `consuelo restart`, and `consuelo update` keep this contract intact.
- Production is repaired and verified after the code path is proven, without conflating browser auth with MCP transport fixes.

- 2026-08-15 04:25:19 append: `.task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation/workpad.md`

## Root cause and live repair

- Reproduced the screenshot failure class at the exact node boundary. The live Caddy gateway on the home node was still stripping Workspace Edge identity/authentication headers before forwarding to the Bun workers. The downstream verifier therefore returned `MISSING_EDGE_SIGNATURE` even though the browser-side route required a valid workspace session. The D1 route registry itself was healthy and still marked the first-class private Site shells and their `/gateway/*` APIs as `workspace-session`.
- The current `stream/os` renderer is already correct: it preserves every header in `WORKSPACE_EDGE_NODE_HEADERS` and only removes edge cache/route metadata. The stale live Caddyfile was older than that renderer.
- Why this regressed after an update: runtime bundles carried a fixed migration ID for `reconcile-caddy-worker-pool.ts`. The lifecycle migration journal correctly skips migration IDs it has already applied, so changing the reconciliation renderer later did not guarantee that an existing user reran that migration during a newer release. This left older gateway config on disk even though the new runtime code was present.
- Live recovery: scheduled the canonical OS restart (`trc_75cf039df05d`). After the detached reload completed, the live Caddyfile preserved all Workspace Edge auth headers (`trc_1270121b2597`). A signed request through the actual local Caddy ingress to `/gateway/configuration/snapshot` then returned HTTP 200 with the live configuration snapshot (`trc_1aecb53d5474`). Security remains fail-closed for unsigned connector traffic.

## RED / GREEN regression evidence

- Added the loud regressions before the production implementation edit (`trc_8836c654a8fa`).
- RED: `trc_bde9efdae023` failed on the missing release-scoped Caddy reconciliation migration. This proved a later runtime release could reuse an already-journaled static migration ID and leave existing-user gateway config stale.
- The private route matrix separately passed against the current edge implementation (`trc_3ebfb1b1eb4`), confirming the browser session-to-signed-edge path and D1 auth model were correct; the defect was downstream gateway preservation, not missing route auth.
- Implementation (`trc_1f97f585c33f`): every changed runtime release now embeds an additional version-scoped `reconcile-caddy-worker-pool.ts` migration. The migration is idempotent: it rewrites/restarts Caddy only when the persisted gateway config differs from the current renderer. Existing static migration IDs remain for compatibility.
- Focused GREEN: `trc_06330ca3d36f` passed 19 lifecycle/Caddy/release tests, all 15 Workspace Edge Site/Gateway integration contracts with the real gateway-contract flag enabled, and all 34 test-selection contracts.

## Loud regression coverage added

1. `caddy-worker-pool-reconciliation.test.ts` now iterates every value in `WORKSPACE_EDGE_NODE_HEADERS`; Caddy may not strip any current or future signed node-edge header. This replaces the previous hand-picked three-header assertion.
2. `workspace-edge-sites-gateway-integration.test.ts` derives the full private Site and `consuelo-gateway-service` matrix from the canonical route seed. Every private Site must be `workspace-session`, every private Gateway route must authenticate through the session path, and every proxied node request must contain every required Workspace Edge header.
3. Runtime publish workflow contracts require exactly one version-scoped Caddy reconciliation migration on every changed release.
4. Test selection now treats the edge router, node-edge auth protocol, Caddy reconciliation implementation/migration, and their regression tests as focused critical owners, so these contracts run automatically instead of silently falling back to unrelated broad OS tests.

## Acceptance status

- [x] Screenshot failure class reproduced and root-caused before implementation.
- [x] Live home-node gateway repaired without weakening signed-edge authorization.
- [x] Private Site/Gateway route matrix explicitly covered.
- [x] All Workspace Edge auth headers protected by a future-proof Caddy regression.
- [x] Cross-version update migration hole fixed with a fresh release-scoped reconciliation ID.
- [x] Restart/same-version reconciliation remains idempotent and uses the current renderer.
- [x] Focused regression suite green.
- [ ] Strict review and formal verify.
- [ ] Publish task to `stream/os` and clean up after merge.

- 2026-08-15 04:35:32 append: `.task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation/workpad.md`

## Final verification

- Full selected-suite execution passed with no failed suites: `trc_3963482ac23c`. This includes the release workflow contracts, Workspace Edge dry run, full private route preservation integration with gateway contracts enabled, lifecycle/update handoff suite (151 tests), Caddy header preservation, syntax, facade snapshots, and test-selection policy.
- Strict review passed with 0 blocking issues and 0 documentation opportunities: `trc_7ecf382e6026`.
- Formal full verify passed and is publish-valid: `trc_6c276b853be1`.

## Acceptance status — final

- [x] Strict review and formal verify.
- [ ] Publish task to `stream/os` and clean up after merge.

- 2026-08-15 04:37:04 append: `.task/os/make-authenticated-workspace-subroutes-survive-releases-and-lifecycle-reconciliation/workpad.md`
