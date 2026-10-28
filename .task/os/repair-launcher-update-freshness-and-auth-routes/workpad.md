# repair launcher update freshness and auth routes

branch: `task/os/repair-launcher-update-freshness-and-auth-routes`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1956/repair-launcher-update-freshness-and-auth-routes
github pr: https://github.com/consuelohq/opensaas/pull/1956
started: 2026-08-14

## acceptance criteria

- [ ] Identify why Ko's installed launcher and authenticated workspace routes are serving stale UI/auth behavior after the latest OS work shipped.
- [ ] Bring Ko's current local OS/runtime and the public/edge launcher surfaces to the newest approved release state so the shipped launcher/dashboard/auth work is actually visible.
- [ ] Fix the update/release path so future `consuelo update` runs refresh every launcher/static-site/auth dependency required by the installed product, rather than leaving stale materialized or edge content behind.
- [ ] Preserve the new native OS auth, workspace identity, node routing, observability, configuration, and internal-dashboard security boundaries.
- [ ] Prove the fix against the real browser/authenticated launcher path plus focused update/materialization tests, strict review, and publish verification.
- [ ] Promote the code fix through `stream/os`; do not silently ship unrelated stream work or destructive cleanup.

## plan

1. Capture runtime truth first: current installed version/commit, public and internal launcher behavior, auth/session behavior, Cloudflare deployment/version state, and recent merged OS PRs.
2. Reconcile runtime truth with the current release/updater/materialized-site code and the recent hosted-site reconciliation/auth changes.
3. Define and run a focused RED contract for the missing freshness/update behavior before production edits.
4. Implement the smallest root-cause repair in the update/release/materialization boundary, then run focused GREEN coverage and browser/runtime proof.
5. Update Ko's own installation/public edge surface using the supported lifecycle/deployment path, verify the new launcher/authenticated routes live, then run review/verify and promote the fix into `stream/os`.

## current status

- Root cause is confirmed and the durable code repair is complete/verified. Ko's local updater is healthy but the signed `dev` channel is still `0.1.37` from source commit `64b93da1ac...`, while the large OS/auth batches landed later. Separately, the production OS release orchestrator omitted Workspace Edge entirely, its D1 migration package script defaulted to local state rather than `--remote`, and default hosted-shell publication only versioned/seeded a subset of the launcher surfaces. The repair now closes all three release-freshness gaps.
- Ko's live Workspace Edge was manually advanced from the current integrated source and all five remote D1 migrations were applied. `internal.consuelohq.com` now reaches the new internal-dashboard handler rather than the stale launcher. The live handler returns `403 forbidden` because the required Cloudflare Access application/JWT policy for `internal.consuelohq.com` has never been provisioned; the Worker correctly refuses to weaken that operator-only boundary.
- Focused selected tests, strict review, and full verification are green. The remaining operational sequence is: promote this task through `stream/os` to `main`, manually publish the signed dev runtime (the workflow now has `workflow_dispatch` for exceptional `[skip ci]` merges), then update Ko's Mac last. Cloud-first Device Authority remains on its deliberate canary/0%-traffic boundary and must not be globally replaced as a side effect of this freshness repair.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `package.json`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release-workspace-edge.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/website-deploy.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 10:08:33 `review.run`: passed — OK
- 2026-08-14 10:09:09 `verify`: passed — OK
- 2026-08-14 10:10:02 `verify`: passed — OK

## key decisions

- Start from `stream/os` because this is a direct follow-up to the large unshipped/recently shipped OS batch and the updater must be tested against that integrated state.
- Trust runtime/deployed evidence before source assumptions; Cloudflare edge state, installed runtime version, and materialized site freshness are separate lanes that all need correlation.
- Keep Cloudflare Access as the internal-dashboard authorization boundary. The live 403 is a missing Access application/configuration problem, not permission to bypass the JWT authorizer with a weaker workspace cookie or hard-coded operator exception.
- Treat private OS shells (`launcher`, `traces`, `configuration`, `tools`, `nodes`, `environments`, `secrets`) as release-managed snapshots that can be refreshed during node reconciliation, while preserving customer-published public `artifacts`, `diffs`, and `docs` routes.
- Make default release snapshots host-neutral and derive their version from the aggregate content of every shipped shell, so changing Nodes/Configuration/Traces cannot silently reuse a stale launcher-only cache key.
- Add Workspace Edge + remote D1 migrations to the existing full OS release orchestrator instead of creating an independent release lane. Preserve `--install-only` / `--device-auth-only` semantics and the existing Device Authority canary safety boundary.

## notes for ko

- Your installed OS is `0.1.37`; `consuelo update --check` correctly says no update because the signed dev pointer itself is still `0.1.37`. The updater is not failing locally—the publication source is stale.
- Workspace Edge and its remote route-registry schema are now current live. The personal dashboard code is therefore deployed, but Cloudflare Access for `internal.consuelohq.com` is the remaining live login blocker. The local Wrangler OAuth token has Workers/D1 write but no Access-application write scope, and the Cloudflare dashboard automation hit Cloudflare's human-verification challenge, so I did not bypass or downgrade that security boundary.

## improvements noticed

- `deployment.raw` currently fails to construct Cloudflare raw operations (`MALFORMED_OUTPUT`), so the emergency Workspace Edge update had to use the repository's authenticated Wrangler release scripts instead of the typed deployment facade.
- `lifecycle.status` currently resolves through a missing root `lifecycle` package script. This is independent of the stale launcher root cause and was not expanded into this task.

## issues and recovery

- First `task.start` returned a transient MCP network error; `status` showed no active task, and the retry recovered the pre-created task/session safely as `tsk_5390629a4392` / PR #1956.
- Initial discovery batch used an invalid `tools.search` limit of 8; the tool contract caps it at 5. No product mutation occurred.
- The first Workspace Edge migration command exposed a product bug: `cloudflare:workspace-edge:migrate` applied only local Miniflare D1 because `--remote` was absent. The generated local `.wrangler/state` files were removed from the task worktree, the remote migration state was inspected explicitly, and all five pending remote migrations were then applied successfully before browser re-verification.
- After the live Workspace Edge + remote D1 update, `/`, `/users`, and `/observability` on `internal.consuelohq.com` all return the new dashboard's intentional `403 forbidden` response without an Access JWT. Wrangler `whoami` confirms the current OAuth identity has account read + Workers/D1 write, but no Cloudflare Access application write permission; no secret was printed or copied.

## Test-first contract

- Behavior under test: a successful supported OS update/release must refresh the runtime plus every launcher/hosted-site/auth surface that depends on the activated runtime, so a user cannot remain on an older generated launcher or stale authenticated route after the update reports success.
- Existing local pattern to inspect: lifecycle update handoff, hosted-site reconciliation/materialization, install/runtime bundle activation, Cloudflare Device Authority/workspace-edge publication, and launcher site generation tests.
- RED coverage was split across the real failure boundaries before production edits: generic launcher release snapshots did not resolve request-host state; Device Authority release only emitted five snapshots; runtime publication had no operator dispatch escape hatch; D1 reconciliation preserved stale private shell snapshots; and the production release aggregator had no Workspace Edge step. The OS RED run failed exactly on the new launcher/workflow/snapshot assertions, and the production-release RED failed on the missing Workspace Edge script/orchestrator step.
- A second selector RED proved the new release files fell through to the broad OS package suite until `os-release-surface-freshness` was defined (trace `trc_59dd3f3d1f8f`).
- Safety preflight scanned all 26 selected test files for destructive shell/database/deployment literals and found none (trace `trc_84d7cc9c0aee`).
- Runtime proof: live browser before/after, installed version/commit before/after, Cloudflare deployed version before/after, and authenticated route behavior after refresh.

## Validation evidence

- Initial focused GREEN after implementation: launcher/release workflow/Device Authority snapshot contracts passed; D1 reconciliation passed 11/11 with gateway contracts enabled; production release contract passed; Workspace Edge dry-run bundled successfully.
- Selector focused GREEN passed after adding `os-release-surface-freshness`, and the complete selector registry now passes 31/31 (trace `trc_0d5c5dbbf54c`).
- Actual changed-file selection runs 15 focused suites with `auto:@consuelo/os:package-test` absent; all selected suites passed, including 89 managed-cloud/Device Authority tests, 26 Worker tests, hosted-site reconciliation, launcher/Astro, release dry-run, workflow policy, and server selector contracts (trace `trc_974b38a84d63`).
- Strict review against `origin/stream/os`: 0 blocking issues / 0 pre-existing issues / 0 documentation opportunities (trace `trc_7f382662ca16`).
- Full verify against `origin/stream/os`: passed with `publishValid: true`; DB guard has one expected warning for the changed route-seed migration/sync script and 0 findings (trace `trc_c0e5fdf6016f`).
- Task is stream-synced (`behind: 0`) before promotion (trace `trc_44468728c55b`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `cron_jobs/index.ts`
- `package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/migrations/0001_init.sql`
- `packages/os/cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`
- `packages/os/cloudflare/workspace-edge/migrations/0005_install_user_workspace_verification.sql`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/docs/install-control-plane.md`
- `packages/os/package.json`
- `packages/os/scripts/deploy-cloudflare-worker.ts`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/scripts/lib/install-control-plane-http.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/internal-user-dashboard.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/private-workspace-session-recovery.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/smoke-workspace-edge.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/skills/browser/SKILL.md`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/cloudflare-worker-release-readiness.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/lifecycle-facade.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tools/lifecycle/handler.ts`
- `packages/os/tools/lifecycle/schema.ts`
- `packages/workspace/scripts/github.js`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release-install.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/website-deploy.test.js`

- 2026-08-14 10:09:36 apply-patch: `.task/os/repair-launcher-update-freshness-and-auth-routes/workpad.md`
