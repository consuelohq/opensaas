# repair Google sign-in launcher redirect

branch: `task/os-web/repair-google-sign-in-launcher-redirect`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1704/repair-google-sign-in-launcher-redirect
github pr: https://github.com/consuelohq/opensaas/pull/1704
started: 2026-07-28

## acceptance criteria

- [ ] Selecting a Google account completes the callback, workspace handoff, and host-scoped launcher session instead of returning to the account chooser.
- [ ] The workspace-edge Worker and device-authority Worker share a dedicated `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET` in production.
- [ ] Missing internal session-validation configuration remains fail closed and cannot expose the launcher.
- [ ] Deployment contracts declare the internal signing secret as required for both Workers without committing its value.
- [ ] Device OAuth, MCP OAuth, connector signing, and the existing `CONSUELO_EDGE_SIGNING_SECRET` contract remain unchanged.
- [ ] Focused auth/deployment tests, package typecheck, review, verify, and a live browser login pass before completion.

## plan

1. Lock the deployment contract with a failing test requiring the shared internal session-validation secret on both Workers.
2. Update only the two Wrangler manifests to declare the secret requirement; never commit or print the value.
3. Generate one new high-entropy value in memory and provision the same value to both production Workers.
4. Deploy only if Wrangler secret provisioning does not activate the new Worker versions automatically.
5. Validate the complete Google callback → authority session → handoff → workspace session → launcher flow live.
6. Run focused tests, typecheck, review, verify, and promote through `stream/os-web` to `main`.

## Test-first contract

- Behavior under test: production deployment metadata must require the same named internal session-validation secret on both the workspace edge and device authority.
- Existing local pattern: `cloudflare-worker-deployment-contract.test.ts` reads Wrangler manifests and asserts bindings and secret hygiene without embedding values.
- New or changed tests: require `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET` in both Worker manifests and continue asserting no literal secret value is committed.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/os-universal-login.test.ts`.
- Expected red failure: neither deployed Worker currently lists `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET`; live `wrangler secret list` confirms it is absent from both.

## current status

- Reproduced the redirect chain: `internal.consuelohq.com/` correctly starts Google OAuth at `os.consuelohq.com` with the expected callback, state, nonce, and return path.
- Root cause identified in production configuration. Workspace session validation requires `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET` on both Workers, but `wrangler secret list` shows the secret is absent from both deployments.
- After `/auth/consume` sets the workspace cookie, the edge therefore rejects every session and redirects back to Google, producing the observed account-chooser loop.
- No OAuth client or callback URI defect was found. The Google request uses the registered `https://os.consuelohq.com/login/google/callback` URI.
- The shared secret has now been generated in memory and provisioned successfully to both production Workers. Its value was not printed, stored, or committed.
- Live secret inventories confirm `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET` is active on `consuelo-workspace-edge` and `consuelo-os-device-authority`.
- Wrangler manifests now declare the secret requirement on both Workers.
- Focused deployment and universal-login contracts are green: 13 tests passed.
- Package typecheck and `git diff --check` pass.
- Strict review reports zero findings and full verification is publish-valid.

## files changed

- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 04:07:06 `review.run`: passed — OK
- 2026-07-28 04:07:19 `verify`: passed — OK
- 2026-07-28 04:07:36 `verify`: passed — OK

## key decisions

- Use a dedicated new shared secret rather than reuse `CONSUELO_EDGE_SIGNING_SECRET`; the two contracts protect different trust boundaries.
- Provision one generated value to both Workers through stdin so it never appears in shell argv, logs, source, or task metadata.
- Add a manifest-level regression because the runtime already fails closed correctly; the defect is deployment configuration drift.

## validation evidence

- Production red evidence: workspace-edge secret inventory contained only `CONSUELO_EDGE_SIGNING_SECRET`; device-authority contained Cloudflare and Google secrets but no internal session-validation secret.
- Focused red: both new deployment-contract assertions failed against the existing manifests while all eight universal-login behavioral tests passed.
- Focused green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/os-universal-login.test.ts` — 2 files, 13 tests passed.
- Production configuration green: both Worker secret inventories now contain `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET`.
- `bun run --cwd packages/os typecheck` — passed.
- `git diff --check` — passed.
- `review.run --strict --base origin/main` — zero findings.
- `verify --base origin/main` — publish-valid.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Browser automation could not inspect the already-running Google page because the shared browser daemon was wedged. Direct HTTP and Worker configuration inspection were sufficient to isolate the server-side loop.
- Two initial Wrangler-tail attempts failed due a collector parser error and an invalid sampling-rate boundary. No production state changed during those attempts.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-web): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-28 04:05:05 apply-patch: `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- 2026-07-28 04:05:27 apply-patch: `packages/os/cloudflare/workspace-edge/wrangler.toml`
- 2026-07-28 04:05:27 apply-patch: `packages/os/cloudflare/os-device-authority/wrangler.toml`

- 2026-07-28 04:06:12 apply-patch: `.task/os-web/repair-google-sign-in-launcher-redirect/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os-web/repair-google-sign-in-launcher-redirect/current.json`, `.task/os-web/repair-google-sign-in-launcher-redirect/evidence-log.json`, `.task/os-web/repair-google-sign-in-launcher-redirect/read-log.json`, `.task/os-web/repair-google-sign-in-launcher-redirect/session.json`, `.task/os-web/repair-google-sign-in-launcher-redirect/verify.json`, `.task/os-web/repair-google-sign-in-launcher-redirect/workpad.md`, `.task/tasks/os-web/repair-google-sign-in-launcher-redirect.json`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
