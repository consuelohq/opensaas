# Fix launcher existing-account auth routing

branch: `task/os/fix-launcher-existing-account-auth-routing`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1962
started: 2026-08-14

## acceptance criteria

- [x] `intent=login` resolves an existing canonical Consuelo user and never creates a new canonical user for an unknown email.
- [x] An existing canonical user with authoritative existing OS workspace evidence routes to that workspace launcher instead of `Name your workspace`.
- [x] Existing local/free OS workspaces do not require a Consuelo Cloud trial or managed cloud node to use the launcher.
- [x] `intent=signup` can create a new canonical user and expose cloud-first workspace creation only for a genuinely new account.
- [x] Signup with an already-existing canonical account reuses the existing account and does not make it cloud-onboarding-eligible.
- [x] Existing device-code/MCP OAuth, host-only workspace sessions, safe return paths, CSRF, handoff single-use/audience binding, and node identity semantics remain unchanged.
- [x] Cloudflare Access protection for internal operator-dashboard paths remains intact.
- [x] Focused auth/onboarding, device identity, node routing, syntax, review/DB, Worker dry-run, and full task verification gates pass.

## root cause

1. Web OAuth stored `WebOAuthState.intent`, but the callback ignored it and always used create-or-resolve identity behavior. `Log in` could silently become `Sign up`.
2. Browser authority sessions use canonical `user_*` identity, while an existing installed workspace can still be owned by the historical server-side `google:<sub>` operating account. The web membership lookup therefore saw zero workspaces and displayed cloud onboarding.
3. `internal.consuelohq.com` is both Ko's existing `internal` workspace hostname and the internal install/user dashboard hostname. Workspace Edge intercepted the entire host for the dashboard Access authorizer, so `/`, `/auth/consume`, `/observability`, `/configuration`, `/nodes`, and other launcher routes could return the dashboard's plain `forbidden` instead of entering workspace auth/routing.

## implementation

- Split canonical web identity resolution by intent: login is resolve-only; signup may create only when the canonical email does not already exist.
- Added explicit authority-session `cloudOnboardingEligible` provenance. Only a genuinely newly-created signup session may see or POST cloud-first workspace creation.
- Existing accounts with no currently resolvable workspace get a non-destructive `Workspace unavailable` state instead of being converted into cloud signup.
- Reuse a legacy `google:<sub>` OS operating account only when it comes from the verified Google subject and does not conflict with canonical workspace membership evidence. Canonical active membership wins.
- Route workspace `/auth/consume` and `/auth/logout` ahead of the internal dashboard interception.
- Restrict the internal dashboard interception to its admin namespaces (`/users`, `/installs`, `/devices`, `/errors`, `/internal/assets/*`, `/api/internal/os/v1/*`). All other `internal.consuelohq.com` paths continue through normal workspace routing. The admin Access gate is not weakened.

## test-first evidence

A temporary focused regression file was written and run before production edits. Initial result: 4 tests, 3 expected failures and 1 pass:
- existing account + existing workspace incorrectly landed on cloud onboarding;
- unknown login incorrectly created a user;
- `internal.consuelohq.com/auth/consume` incorrectly hit the admin Access gate;
- genuinely new signup remained valid.

Those cases were then folded into the existing registered auth/onboarding/dashboard suites and the temporary file was removed so normal task test selection remains bounded.

## validation

- Focused post-fix suite: 5 files, 64 tests, all passed:
  - `cloud-first-web-onboarding.test.ts` — 7/7
  - `os-universal-login.test.ts` — 10/10
  - `internal-dashboard-integration.test.ts` — 5/5
  - `native-google-device-approval.test.ts` — 2/2
  - `workspace-node-registry-routing.test.ts` — 40/40
- Registered critical selection also passed earlier in the task:
  - cloud-first auth contracts: 46/46
  - Device Authority Worker contract: 26/26
  - canonical device approval contracts: 60/60
  - one-click managed cloud contracts: 89/89
- `bun run typecheck`: passed (`workspace script syntax checks passed`).
- `git diff --check`: passed.
- `cloudflare:device-authority:deploy:dry-run`: passed.
- `cloudflare:workspace-edge:deploy:dry-run`: passed.
- Review: 0 blocking issues.
- DB guard: 0 risks/findings.
- Final `verify`: `passed: true`, `publishValid: true`, full mode; stamp written to `.task/os/fix-launcher-existing-account-auth-routing/verify.json`.

An intermediate full package test was selected only because a temporary new test file and a convenience doc edit matched the generic package rule; its failure was unrelated pre-existing script-parity/audit drift. The regression tests were folded into registered explicit suites, the doc convenience edit was reverted, and the final full task gate is publish-valid.

## final files changed

- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/tests/cloud-first-web-onboarding.test.ts`
- `packages/os/tests/internal-dashboard-integration.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- task metadata/workpad/verification evidence

## product/security decisions

- Login and signup are separate product intents, not aliases.
- Existing workspace ownership wins over cloud-first onboarding; cloud is optional for launcher access.
- Workspace routing comes only from server-owned canonical/OS records and verified Google identity, never a browser-supplied host or account id.
- `internal.consuelohq.com` is a shared hostname: normal paths are Ko's workspace launcher; internal operator-dashboard namespaces remain protected by their separate Access authorizer.

## user state confirmed

The user's local migration/update succeeded before this task: the three recognized legacy root LaunchDaemons were backed up and retired, all lifecycle stages completed, and the installed runtime reported `changed: yes`, `version: 0.1.38`.

## publish/deploy

- Task is ready to publish to `stream/os`.
- After stream/main integration, deploy both `os-device-authority` and `workspace-edge` because the live repair spans both Workers.
- Live verification must prove:
  - normal `internal.consuelohq.com` launcher paths no longer return the internal dashboard's plain `forbidden`;
  - `/users` remains Access-protected;
  - existing account login routes to its existing workspace and does not show cloud signup;
  - unknown login produces account-not-found and explicit signup remains the path for new accounts.

- 2026-08-14 18:22:34 write: `.task/os/fix-launcher-existing-account-auth-routing/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-14 18:22:34 fs.write: `.task/os/fix-launcher-existing-account-auth-routing/workpad.md`
