# wire hosted installer device login

branch: `task/os/wire-hosted-installer-device-login`
stream: `stream/os`
task pr: https://github.com/consuelohq/opensaas/pull/995
started: 2026-06-13

## acceptance criteria

- Hosted local installer attempts the Consuelo website device-login flow after `enter workspace name`.
- The installer opens the browser to `https://consuelohq.com/login/device?user_code=...` when a local/preview or live device session is prepared.
- Live endpoint shape follows GitHub device flow:
  - `POST https://consuelohq.com/login/device/code`
  - `POST https://consuelohq.com/login/oauth/access_token`
- When the live endpoints are unavailable, the installer must not fail or hang; it should clearly continue with local workspace bootstrap fallback.
- `--yes` / `--json` paths must not block on browser authorization.
- The installer never uses `app.consuelohq.com/os/activate`.
- Keep existing local install and cloud-contact behavior intact.

## exploration

- Current installer already asks `enter workspace name` and derives `workspaceHost = <name>.consuelohq.com`.
- Current device helper only provides local in-memory contract constants/session helpers; it does not perform HTTP start/poll.
- `WorkspaceBootstrap` supports `connectorBootstrapToken`, so an approved device grant can map into provisioning.
- No existing website route for `/login/device` was found in `packages/consuelo-website`; this task focuses installer-side open/poll/fallback and can add website surface later if needed.

## test-first contract

Focused tests to add/update:
- source contract for installer importing/using device login and graceful fallback copy.
- HTTP client contract for request-code, browser verification URL, poll approval, pending/slow_down, and unavailable fallback.

Commands:
- red/green `bun --cwd packages/os test scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts`
- smoke `bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json --mode local --workspace-name testing`

- 2026-06-13 06:01:02 write: `.task/os/wire-hosted-installer-device-login/workpad.md`

## files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`

## workspace-owned: files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`

## workspace-owned: activity log

- 2026-06-13 06:01:02 fs.write: `.task/os/wire-hosted-installer-device-login/workpad.md`
- 2026-06-13 06:03:35 fs.write: `packages/os/tests/oauth-device-http-client.test.ts`
- 2026-06-13 06:06:15 fs.patch: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-13 06:08:05 fs.write: `packages/os/scripts/lib/workspace-device-login-client.ts`
- 2026-06-13 06:10:22 fs.patch: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-13 06:10:33 fs.patch: `packages/os/tests/oauth-device-http-client.test.ts`
- 2026-06-13 06:12:50 fs.write: `packages/consuelo-website/src/pages/login/device.astro`

## workspace-owned: files read

- `packages/consuelo-website/astro.config.mjs`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/pages/contact.astro`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-13 06:06:27 `bun --cwd packages/os test scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts`: failed exit 1 trace: `trc_eac7d94f34b4`
  - output: d falls back cle… [90m 43| [39m [34mexpect[39m(install)[33m.[39m[34mtoContain[39m([32m'attemptWorkspaceDeviceLogin'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 44| [39m [34mexpect[39m(install)[33m.[39m[34mtoContain[39m([32m'requestWorkspaceDeviceCode'[39m)[33m;[39m [90m 45| [39m [34mexpect[39m(install)[33m.[39m[34mtoContain[39m([32m'pollWorkspaceDeviceAccessToken'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-13 06:08:05 write: `packages/os/scripts/lib/workspace-device-login-client.ts`

## workspace-owned: TDD green evidence

- 2026-06-13 06:10:02 `bun --cwd packages/os test scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts`: failed exit 1 trace: `trc_4c344aac8907`
  - output: [22m tests/oauth-device-http-client.test.ts:[2m66:41[22m[39m [90m 64| [39m expect(String(calls[0].init?.body)).toContain('client_id=consuelo-… [90m 65| [39m expect(String(calls[0].init?.body)).toContain('workspace_name=test… [90m 66| [39m expect(String(calls[0].init?.body)).toContain('scope=workspace%3Ar… [90m | [39m [31m^[39m [90m 67| [39m })[33m;[39m [90m 68| [39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-13 06:10:22 patch lines 48-48: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-13 06:10:33 patch lines 66-66: `packages/os/tests/oauth-device-http-client.test.ts`
- 2026-06-13 06:10:49 `bun --cwd packages/os test scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts`: passed exit 0 trace: `trc_f1a77a955c17`
  - output: → tmux: opensaas-os-wire-hosted-installer-device-login-632e809f $ vitest run scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts
- 2026-06-13 06:12:50 write: `packages/consuelo-website/src/pages/login/device.astro`
- 2026-06-13 06:13:11 `bun --cwd packages/os test scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts`: passed exit 0 trace: `trc_72ea02df06b8`
  - output: → tmux: opensaas-os-wire-hosted-installer-device-login-632e809f $ vitest run scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts

## workspace-owned: validation evidence

- 2026-06-13 06:15:02 `checkFiles`: passed — OK
- 2026-06-13 06:17:14 `review.run`: passed — OK
- 2026-06-13 06:18:48 `review.run`: passed — OK
- 2026-06-13 06:19:09 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/wire-hosted-installer-device-login/current.json`, `.task/os/wire-hosted-installer-device-login/evidence-log.json`, `.task/os/wire-hosted-installer-device-login/read-log.json`, `.task/os/wire-hosted-installer-device-login/session.json`, `.task/os/wire-hosted-installer-device-login/workpad.md`, `.task/tasks/os/wire-hosted-installer-device-login.json`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/oauth-device-http-client.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
