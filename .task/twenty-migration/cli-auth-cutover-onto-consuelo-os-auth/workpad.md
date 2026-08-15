# CLI auth cutover onto Consuelo OS auth

branch: `task/twenty-migration/cli-auth-cutover-onto-consuelo-os-auth`
stream: `stream/twenty-migration`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2019/cli-auth-cutover-onto-consuelo-os-auth
github pr: https://github.com/consuelohq/opensaas/pull/2019
started: 2026-08-15

## acceptance criteria

- [x] `@consuelo/cli` browser login targets `https://os.consuelohq.com/oauth/authorize` using the existing `consuelo-os-operator-cli` public PKCE client and a literal loopback callback.
- [x] The callback validates OAuth state before accepting a code, exchanges the code without exposing the verifier, and persists the returned renewable OS access/refresh credentials securely in the existing `~/.consuelo/config.json` file.
- [x] Login resolves the authenticated account email plus canonical `workspaceId` / `workspaceHost` from Consuelo OS and preserves the CLI's existing workspace handoff.
- [x] An OS access token is never written to the legacy `apiKey` field; an existing Twenty API key is preserved only for legacy commands until M2 removes/replaces that surface.
- [x] `consuelo init --managed` and the setup login prompt use the OS-native auth result, and the CLI exposes a native `consuelo login` path rather than directing users to Twenty's `auth:login`.
- [x] M1 does not remove `twenty-sdk`, legacy platform commands, or other M2-owned code.
- [x] Focused auth tests, changed-surface typecheck, strict review, and repository verification pass before publish. Full CLI build is currently blocked only by the two pre-existing `twenty-sdk/cli` TS2307 errors owned by M2.

## plan

1. Pin the existing OS operator OAuth contract (PKCE client, loopback redirect, token exchange, introspection, workspace nodes) and the legacy CLI credential consumers.
2. Add focused RED tests for the OS authorize/token/workspace contract and for never substituting an OS access token into `apiKey`.
3. Replace the legacy `app.consuelohq.com/cli/auth` flow with the OS authorization-code + PKCE flow, persist OS-native auth separately, and add native `consuelo login` wiring.
4. Run focused GREEN tests, CLI typecheck/build, task-selected tests, strict review, and full verify. Fix only M1-owned findings.
5. Push PR #2019 and mark it ready without starting M2.

## current status

- Implementation complete. Focused tests, changed-surface typecheck, strict review, and canonical verify are green; publish-valid verify stamp written. Ready to push PR #2019.

## files changed

- `packages/cli/package.json`
- `packages/cli/src/api-client.ts`
- `packages/cli/src/auth.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/sentry.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/tests/auth.test.ts`


## workspace-owned: files changed

- `packages/cli/src/auth.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/tests/auth.test.ts`

## workspace-owned: activity log

- 2026-08-15 04:32:30 fs.write: `.task/twenty-migration/cli-auth-cutover-onto-consuelo-os-auth/workpad.md`
- 2026-08-15 05:45:09 fs.write: `packages/cli/tests/auth.test.ts`
- 2026-08-15 05:46:02 fs.write: `packages/cli/src/auth.ts`
- 2026-08-15 05:46:24 fs.write: `packages/cli/src/commands/login.ts`

## workspace-owned: validation evidence

- 2026-08-15 05:49:17 `review.run`: passed — OK
- 2026-08-15 05:52:49 `review.run`: passed — OK
- 2026-08-15 05:53:05 `verify`: failed — COMMAND_FAILED
- 2026-08-15 05:53:55 `review.run`: passed — OK
- 2026-08-15 05:54:07 `verify`: passed — OK

## key decisions

- Reuse the already-deployed OS OAuth protocol rather than the old Twenty `CliAuthController` or the short-lived installer bootstrap token.
- Keep OS credentials separate from `CliConfig.apiKey`; the latter remains a legacy Twenty API credential until M2.
- Do not modify the OS authority implementation in M1. The legacy CLI will implement the stable public OAuth protocol locally so this migration does not collide with ongoing `stream/os` work.
- Preserve `CliConfig.apiKey` only as a temporary legacy-command credential; OS auth lives under `CliConfig.osAuth` and login never synthesizes or overwrites `apiKey`.
- Store OS access/refresh credentials in the existing global config with directory mode `0700` and file mode `0600`; Sentry scrubbing now treats the nested OS auth object and token fields as sensitive.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: CLI browser login uses Consuelo OS auth authority instead of Twenty/app.consuelohq.com and returns a usable local credential/workspace handoff.
existing local pattern: inspect current packages/cli auth flow and packages/os device/browser auth contracts before editing.
new or changed tests: add focused CLI auth URL/callback contract coverage plus negative assertions that the legacy Twenty auth URL is not used.
focused red command: `bunx vitest run packages/cli/tests/auth.test.ts`
expected red failure: 7/7 tests failed because the existing CLI auth module did not export or implement the OS PKCE/auth/workspace contracts.
no-test waiver: not applicable.

## files changed

- `packages/cli/src/auth.ts` — replace Twenty browser/API-key login with OS PKCE OAuth, loopback callback, token exchange, introspection, and workspace resolution.
- `packages/cli/src/config.ts` — add separate OS auth storage and harden config permissions.
- `packages/cli/src/commands/login.ts` — add native `consuelo login`.
- `packages/cli/src/commands/init.ts` — route setup login through OS auth without writing `apiKey`.
- `packages/cli/src/api-client.ts` — distinguish OS login from temporary legacy API-key commands.
- `packages/cli/src/index.ts` — register native login command; existing `twenty-sdk` commands remain for M2.
- `packages/cli/src/sentry.ts` — scrub OS auth/token fields.
- `packages/cli/tests/auth.test.ts` — focused auth contract and end-to-end loopback tests.
- `packages/cli/package.json` — add focused package test script.

## validation

- RED: `bunx vitest run packages/cli/tests/auth.test.ts` → 7 failed / 0 passed because OS auth contracts were absent.
- GREEN: `npx vitest run packages/cli/tests` → 8 passed / 0 failed.
- Changed surface: targeted `npx tsc --noEmit ... auth.ts config.ts commands/login.ts commands/init.ts sentry.ts api-client.ts` → passed.
- Legacy endpoint sweep: no `app.consuelohq.com/cli/auth`, `auth:login`, or `result.apiKey` references remain under `packages/cli`.
- Full CLI `npx tsc -p packages/cli/tsconfig.json` → blocked only by pre-existing `twenty-sdk/cli` TS2307 errors at `src/index.ts:56` and `src/index.ts:135`; these imports are deliberately unchanged and owned by M2.
- Strict `review.run` → 0 M1-owned issues; the same 2 `twenty-sdk/cli` type errors classified as pre-existing.
- Canonical `verify` → passed; publish-valid stamp written to this task.
- Mechanical review cleanup: replaced wildcard Node imports in touched auth/config files with named imports; verification then reported 0 related-pre-existing findings.
- Stream maintenance note: `stream.sync` against current `main` surfaced one generated `packages/workspace/test-selection.registry.json` conflict caused by newer CI/test-selection work. The OS edit facade correctly refused to mutate the temporary stream-sync worktree; this does not affect M1 verification or its task-local diff and should be resolved as stream maintenance, not by widening M1.

- 2026-08-15 04:32:30 append: `.task/twenty-migration/cli-auth-cutover-onto-consuelo-os-auth/workpad.md`

## workspace-owned: files read

- `package.json`
- `packages/api/src/middleware/auth.ts`
- `packages/cli/package.json`
- `packages/cli/src/api-client.ts`
- `packages/cli/src/auth.ts`
- `packages/cli/src/commands/auth.ts`
- `packages/cli/src/commands/index.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/os.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/sentry.ts`
- `packages/cli/tsconfig.json`
- `packages/consuelo-core/package.json`
- `packages/os/cloudflare/os-device-authority/src/constants.ts`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/operator-login.ts`
- `packages/os/scripts/lib/operator-token-store.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/cli-update-routing.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/operator-login.test.ts`
- `packages/os/tests/operator-oauth-client.test.ts`
- `packages/sdk/package.json`
- `packages/twenty-server/src/engine/core-modules/auth/controllers/cli-auth.controller.ts`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/test-selection.rules.json`
- `tsconfig.base.json`

- 2026-08-15 05:53:35 apply-patch: `packages/cli/src/config.ts`

- 2026-08-15 05:54:18 apply-patch: `.task/twenty-migration/cli-auth-cutover-onto-consuelo-os-auth/workpad.md`