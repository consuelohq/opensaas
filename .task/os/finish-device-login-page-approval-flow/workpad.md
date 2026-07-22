# finish device login page approval flow

branch: `task/os/finish-device-login-page-approval-flow`
stream: `stream/os`
task pr: https://github.com/consuelohq/opensaas/pull/998

## observed failure

- The browser opens `/login/device?user_code=...`, but the static Astro page renders `Waiting for code` because it reads `Astro.url.searchParams` at static-build time.
- The installer then prints `Device login unavailable; continuing with local workspace bootstrap.` because there is no deployed/live handler for the POST device-code/token endpoints.

## acceptance criteria

- The device page must render the URL `user_code` client-side on static hosting.
- The page must not claim approval is enabled unless a real approval endpoint exists.
- The installer must not open a fake/local preview authorization page when the live device-code endpoint is unavailable.
- Existing noninteractive `--yes`/`--json` behavior remains nonblocking.

## test plan

- Add a source contract for the static page reading `window.location.search` client-side.
- Update installer source contract to require live endpoint start before browser open and no local preview browser fallback.
- Run focused OS tests for device page/login installer contracts.

- 2026-06-13 06:45:37 write: `.task/os/finish-device-login-page-approval-flow/workpad.md`

## files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`

## workspace-owned: files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`

## workspace-owned: activity log

- 2026-06-13 06:45:37 fs.write: `.task/os/finish-device-login-page-approval-flow/workpad.md`
- 2026-06-13 06:46:33 write: `packages/os/tests/oauth-device-page-contract.test.ts`
- 2026-06-13 06:46:33 fs.write: `packages/os/tests/oauth-device-page-contract.test.ts`
- 2026-06-13 06:48:41 fs.write: `packages/consuelo-website/src/pages/login/device.astro`
- 2026-06-13 06:52:29 fs.patch: `packages/os/scripts/onboarding-flow.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-13 06:48:21 `bun --cwd packages/os test tests/oauth-device-page-contract.test.ts`: failed exit 1 trace: `trc_b1d0887b6d52`
  - output: :[2m28:27[22m[39m [90m 26| [39m expect(installer).toContain("if (liveDeviceCode.status !== 'starte… [90m 27| [39m [34mexpect[39m(installer)[33m.[39m[34mtoContain[39m([32m"return { status: 'fallback' };"[39m)[33m;[39m [90m 28| [39m expect(installer).not.toContain('startWorkspaceDeviceAuthorization… [90m | [39m [31m^[39m [90m 29| [39m })[33m;[39m [90m 30| [39m})[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-13 06:48:41 write: `packages/consuelo-website/src/pages/login/device.astro`

## workspace-owned: files read

- `packages/os/scripts/install.ts`

## workspace-owned: TDD green evidence

- 2026-06-13 06:49:55 `bun --cwd packages/os test tests/oauth-device-page-contract.test.ts`: passed exit 0 trace: `trc_aa0ec8f7a92f`
  - output: → tmux: opensaas-os-finish-device-login-page-approval-flow-1981dd1d $ vitest run tests/oauth-device-page-contract.test.ts
- 2026-06-13 06:52:29 patch lines 48-48: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-13 06:52:36 `bun --cwd packages/os test scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts tests/oauth-device-page-contract.test.ts tests/oauth-device-onboarding-contract.test.ts`: passed exit 0 trace: `trc_575d95d0116b`
  - output: → tmux: opensaas-os-finish-device-login-page-approval-flow-1981dd1d $ vitest run scripts/onboarding-flow.test.ts tests/oauth-device-http-client.test.ts tests/oauth-device-page-contract.test.ts tests/oauth-device-onboarding-contract.test.ts

## workspace-owned: validation evidence

- 2026-06-13 06:53:15 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-13 06:53:29 `checkFiles`: passed — OK
- 2026-06-13 06:54:40 `review.run`: passed — OK
- 2026-06-13 06:54:58 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/finish-device-login-page-approval-flow/current.json`, `.task/os/finish-device-login-page-approval-flow/evidence-log.json`, `.task/os/finish-device-login-page-approval-flow/read-log.json`, `.task/os/finish-device-login-page-approval-flow/session.json`, `.task/os/finish-device-login-page-approval-flow/workpad.md`, `.task/tasks/os/finish-device-login-page-approval-flow.json`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/os/scripts/install.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/oauth-device-page-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
