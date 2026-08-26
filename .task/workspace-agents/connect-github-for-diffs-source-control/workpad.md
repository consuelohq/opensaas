# connect github for diffs source control

branch: `task/workspace-agents/connect-github-for-diffs-source-control`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2178/connect-github-for-diffs-source-control
github pr: https://github.com/consuelohq/opensaas/pull/2178
started: 2026-08-26

## acceptance criteria

- [x] `/diffs` setup state offers a direct **Connect GitHub** action instead of sending users to a manual connection-binding form.
- [x] Normal Configuration UX hides internal plumbing (`connectionRef`, project ID, provider selector) and presents GitHub connection/repository state in user terms.
- [x] GitHub repository authorization is modeled as a GitHub App installation flow with opaque internal connection bindings; repository/default-branch metadata comes from GitHub rather than manual typing where possible.
- [x] Existing Diffs credential isolation remains intact: secret/token values never load into the browser and Diffs continues to consume an internal binding ID.
- [x] Existing manually configured workspaces remain readable/compatible while the new UX becomes the preferred setup path.
- [x] Missing runtime GitHub App configuration fails clearly and safely; this task must not create or alter GitHub organization/App settings without separate approval.
- [x] Focused route/config/UI tests cover the new behavior, then relevant OS validation, review, verify, and browser proof pass before publish.

## plan

1. Inspect current source-control routes, credential-binding/storage primitives, web-auth callback patterns, and settings/Diffs tests to identify the narrowest existing boundary for a GitHub App installation flow.
2. Define the GitHub connection contract and add focused RED tests for setup CTA, callback/state handling, repository hydration, and the simplified Configuration surface.
3. Implement the smallest vertical slice that starts GitHub App installation, handles the callback safely, derives repository metadata, writes opaque bindings/source-control configuration, and renders the simplified UX.
4. Preserve the existing manual/config data model as compatibility plumbing, but remove internal binding details from the normal user path.
5. Run focused GREEN tests, broader OS checks, structured diff review, browser verification, strict review, and canonical verify against `origin/main`.
6. Push the task and promote it into `stream/workspace-agents`; stop at the stream review PR unless Ko separately asks to ship main or alter GitHub org/App settings.

## Test-first contract

- behavior under test: an unconfigured Diffs workspace can initiate GitHub connection directly; GitHub App callback state is validated; authorized repository metadata is converted into workspace source-control entries with an opaque connection reference; Configuration shows connection/repository state without requiring users to type internal IDs.
- existing local pattern: Hono route/service tests under `packages/os/tests`, source-control snapshot/persistence in `packages/os/scripts/lib/source-control-config.ts`, signed gateway settings routes, and Device Authority web-auth callback/state patterns where applicable.
- new or changed tests: focused Diffs setup-page CTA test; settings-site UX contract test; GitHub source-control connect/callback service or route tests after the concrete boundary is identified; compatibility test for pre-existing `connectionRef` entries.
- focused red command: `bun test packages/os/tests/diffs-hono-routes.test.ts packages/os/tests/settings-site.test.ts packages/os/tests/settings-hono-routes.test.ts packages/os/tests/github-source-control-authority.test.ts`
- expected red failure: current setup page has no direct GitHub connection action, current settings UI exposes manual `connectionRef`/project/provider fields, and no GitHub App installation/callback route exists.
- no-test waiver: not applicable.

## current status

- Task started from `main`. Approved product direction is GitHub App installation/repository selection with internal bindings hidden from users.
- `session.start` is advertised by the installed facade but its backing `session:start` script is missing; recovered through the documented `task.start` compatibility alias. Task session is healthy.
- Discovery converged on a split trust boundary: Device Authority owns the GitHub App private key/installation mapping and mints short-lived installation tokens; workspace nodes retain only an opaque managed connection reference and use node-signed control-plane calls. Existing sealed/static credential bindings remain a compatibility path.
- RED confirmed on 2026-08-26: 25 focused tests passed and the 6 intended new-behavior assertions failed. Existing routes return 404 for GitHub start/complete and authority start/claim, Diffs still renders the old setup copy, and Configuration still renders the manual binding form. Trace: `trc_008e0434f4ae`.
- Focused GREEN confirmed: 31 tests / 297 expectations pass across Diffs routes, Configuration routes/site, and Device Authority GitHub source-control authority. Trace: `trc_4f0a98f08c16`.
- Edge-route follow-up used the contract suite with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` from `packages/os`: RED showed the new GitHub source-control path was missing from the route seed (`trc_80eb4573e655`), then GREEN passed 10/10 after routing `/gateway/configuration/source-control/github` through the Configuration write service (`trc_c6bc09c5d551`).
- Broader Vitest validation recovered from an initial runner mismatch. The first broad command used Bun's native test runner, which does not implement this suite's `vi.stubGlobal` / `vi.unstubAllGlobals` APIs; rerunning through the package's canonical `vitest run` script passed 7 files / 80 tests (`trc_6fd60afaccdc`), including all 33 existing Device Authority worker tests.
- Workspace `audit` ran and failed on known repository-wide drift unrelated to this task: script-doc parity mismatches, 11k+ stale documentation paths, and a stale global index. No audit finding is specific to the GitHub source-control files. Trace: `trc_4a1730851386`.
- First strict workspace review found six task-owned static `ERROR_HANDLING` findings, all async helpers lacking a local try/catch. They were accepted and repaired without changing the behavior contract. Trace: `trc_521a30b71d84`.
- Post-review focused validation is green: the canonical Vitest selection again passed 7 files / 80 tests (`trc_bfa7c753d4dd`), the route-seed contract passed 10/10 (`trc_3a7a0d55fe55`), and the full workspace-edge Sites gateway contract passed 15/15 when enabled (`trc_7c3a61b9646a`).
- Second strict workspace review against `origin/main` is clean: 0 task-owned issues, 0 blocking issues (`trc_847f938bae92`).
- Browser proof used a temporary local preview rendered from the task worktree. `/configuration` showed `Manage GitHub access`, `consuelohq/opensaas`, `main`, and `GitHub` without a connection-binding form (`trc_c2533d745b0c`, screenshot `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/127.0.0.1-2026-08-26T01-51-47.png`). `/diffs` showed only the direct `Connect GitHub` action (`trc_a3f3df3a711a`, screenshot `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/127.0.0.1-2026-08-26T01-51-53.png`); clicking the CTA returned to the Configuration preview as expected (`trc_8ca32d49b222`). The temporary preview process was terminated afterward (`trc_475a74453986`).
- A live GitHub-provider installation was not attempted because the production GitHub App has not been configured in this task and creating/installing it would mutate external organization/security state outside this approval. The deterministic Device Authority tests cover installation verification, one-time handoff, repository enumeration, and short-lived token minting.
- Canonical `verify` initially failed even though review and DB guard passed (`trc_d4062a338ac4`, retry `trc_b99c046d59c6`). Exact test-selection execution showed the new source-control files fell through to the historically red broad `@consuelo/os package test`; it also revealed a facade snapshot accidentally rewritten by that unrelated package run (`trc_6ce48b3997c3`). The accidental snapshot was restored (`trc_cf34250fac18`). A focused `os-github-source-control` critical/exclusive selection rule was added test-first: RED `trc_48792799a301`, generated registry `trc_a695accb9214`, GREEN `trc_c588bb79b059`. The complete selected gate now runs 14 focused suites and passes all 14 without invoking the broad OS package suite (`trc_24307672fc15`).
- Final strict review is clean with 0 task-owned/blocking issues (`trc_64dcc2f99fbf`). Canonical full verify now passes and is publish-valid (`trc_ec1369fa5af2`); the only DB guard signal is a warning that the route-seed file is classified as a database sync script, with 0 findings.
- Implementation is ready to publish to `stream/workspace-agents`. Production activation still requires GitHub App credentials/configuration, which remains a separate external-security action.

## files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/source-control-config.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`
- `packages/os/tests/github-source-control-authority.test.ts`
- `packages/os/tests/settings-hono-routes.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/tests/github-source-control-authority.test.ts`

## workspace-owned: activity log

- 2026-08-26 01:29:43 fs.write: `.task/workspace-agents/connect-github-for-diffs-source-control/workpad.md`
- 2026-08-26 01:38:50 fs.write: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-08-26 01:40:26 fs.write: `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- 2026-08-26 01:41:02 fs.write: `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- 2026-08-26 01:41:31 fs.write: `packages/os/scripts/lib/github-source-control-client.ts`

## workspace-owned: validation evidence

- 2026-08-26 01:46:19 `checkFiles`: passed — OK
- 2026-08-26 01:48:37 `checkFiles`: passed — OK
- 2026-08-26 01:48:43 `audit`: failed — COMMAND_FAILED
- 2026-08-26 01:49:08 `review.run`: passed — OK
- 2026-08-26 01:49:57 `review.run`: passed — OK
- 2026-08-26 01:53:35 `verify`: failed — COMMAND_FAILED
- 2026-08-26 01:55:44 `verify`: failed — COMMAND_FAILED
- 2026-08-26 02:00:05 `review.run`: passed — OK
- 2026-08-26 02:00:48 `verify`: passed — OK

## key decisions

- Keep `connectionRef` as an internal security/credential boundary; remove it from normal user configuration.
- Prefer GitHub App repository authorization over a generic OAuth token flow because repository selection/installation permissions belong to GitHub's UI.
- Do not mutate external GitHub organization/App configuration as part of this repo task without separate approval.
- Device Authority is the trust boundary for the GitHub App private key and installation-token minting; workspace nodes receive short-lived tokens only through signed node-authenticated requests, and browser callbacks carry a one-time opaque handoff rather than credentials.
- Add a focused critical/exclusive test-selection rule for this source-control surface so publish verification exercises the relevant security/UI/runtime contracts instead of the known-red unrelated OS package suite.

## notes for ko

- Runtime activation may still require a GitHub App to be created/configured after the code path exists; that external account change is intentionally outside this approval unless an already-configured app is found during discovery.

## improvements noticed

- none yet

## issues and recovery

- `session.start({kind:"task"})` first failed because the installed facade forwarded an unsupported timeout field, then without timeout failed because `session:start` is missing. `task.start` compatibility alias succeeded and created PR #2178/taskSession `tsk_0c44fa7c4a1a`.
- Full verify initially fell through to the unrelated broad OS package suite. The failure was isolated with the exact `test-selection --run --json` command, an accidental generated facade snapshot was restored, and the source-control surface received a dedicated test-selection contract. The 14-suite selected gate and final full verify are green.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-26 01:29:43 write: `.task/workspace-agents/connect-github-for-diffs-source-control/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway.ts`
- `packages/os/scripts/lib/consuelo-sites-settings-adapter.ts`
- `packages/os/scripts/lib/credential-broker.ts`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/node-identity-key-file.ts`
- `packages/os/scripts/lib/node-sealed-credential-store.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/source-control-config.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-scheduler.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-script.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/configuration.ts`
- `packages/os/scripts/server/routes/secrets.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/scripts/server/vendor/diff-cockpit.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/skills/browser/SKILL.md`
- `packages/os/tests/consuelo-sites-settings-adapter.test.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/settings-hono-routes.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-26 02:01:10 apply-patch: `.task/workspace-agents/connect-github-for-diffs-source-control/workpad.md`