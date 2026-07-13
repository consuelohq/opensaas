# device approval

branch: `task/os/device-approval`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1023/device-approval
github pr: https://github.com/consuelohq/opensaas/pull/1023
started: 2026-06-13

## acceptance criteria

- [ ] Google is the first strong auth path for OS device approval.
- [ ] First approval implicitly creates/reuses a personal Consuelo account/workspace; no username/password path is used.
- [ ] `os.consuelohq.com` remains the device-code authority and visible entrypoint.
- [ ] The app/backend validates the Google-authenticated browser user, signs an OS approval assertion with `OS_DEVICE_AUTH_ASSERTION_SECRET`, and posts it server-to-server to the OS device authority.
- [ ] The installer polling path completes only after the hardened device public-key proof succeeds.
- [ ] The device login page no longer tells users approval is unavailable.
- [ ] The final doctor command uses Bun's valid `bun run --cwd <home> doctor` syntax.

## plan

1. Record the Google OS device approval contract before production edits.
2. Add failing contract coverage for the static `/login/device` page and backend approval bridge.
3. Implement shared OS approval assertion signing helpers in the backend auth surface.
4. Route Google redirect action `os-device-approval` to approve the device code server-to-server, then render a browser success/failure page.
5. Update the public device login page CTA to start app Google auth with the user code preserved.
6. Fix the installer doctor command syntax and run focused OS/auth checks.

## current status

- Task started and repo docs read.
- Existing device authority already requires signed `x-consuelo-account-assertion` and device-key proof.
- Missing bridge: browser Google login to app/backend to server-to-server `/login/device/approve` call.

## test-first contract

Behavior under test:

- `/login/device` renders the device code from URL search params and links the user to the app/backend Google flow with `action=os-device-approval` and the normalized `osDeviceUserCode`.
- The page no longer says browser approval is only future/deferred.
- Google OAuth state preserves `osDeviceUserCode` and exposes it on `GoogleRequest['user']`.
- Google redirect with action `os-device-approval` does not return the normal app login redirect. Instead, it signs `{ account_id, auth_method: google, expires_at }`, posts it to `OS_DEVICE_AUTH_ORIGIN/login/device/approve`, and renders an OS-specific approved page.
- Missing `OS_DEVICE_AUTH_ASSERTION_SECRET` or approval rejection renders a failure page without leaking secrets.
- Installer final summary prints `bun run --cwd <home> doctor`, not `bun --cwd <home> run doctor`.

Focused red commands:

- `bun --cwd packages/os test tests/oauth-device-page-contract.test.ts`
- `bun --cwd packages/os test tests/os-device-authority-worker.test.ts`

Expected red failures before implementation:

- Static page contract still says approval is not active and lacks the Google approval CTA.
- Backend bridge does not yet exist.
- Installer still prints the invalid doctor command.

## files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`
- `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`

## workspace-owned: files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`
- `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`

## workspace-owned: activity log

- 2026-06-13 16:44:19 fs.write: `.task/os/device-approval/workpad.md`
- 2026-06-13 16:46:31 fs.write: `packages/os/tests/oauth-device-page-contract.test.ts`
- 2026-06-13 16:50:10 fs.write: `packages/consuelo-website/src/pages/login/device.astro`
- 2026-06-13 16:50:45 fs.write: `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`
- 2026-06-13 16:51:57 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 16:52:28 fs.write: `.task/os/device-approval/auth-type-content.txt`
- 2026-06-13 16:52:36 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 16:53:21 fs.write: `.task/os/device-approval/test-small.txt`
- 2026-06-13 16:53:30 fs.write: `.task/os/device-approval/test-small.txt`
- 2026-06-13 16:53:46 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:54:02 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:54:12 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:54:19 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:54:26 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:54:37 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:55:45 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:56:21 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:56:29 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:56:42 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:57:00 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:57:08 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:57:15 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:57:25 fs.write: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 16:57:35 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 17:01:42 fs.patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-13 17:02:02 fs.patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-13 17:02:39 fs.write: `.task/os/device-approval/worker-hidden-url.txt`
- 2026-06-13 17:02:46 fs.write: `.task/os/device-approval/worker-hidden-url.txt`
- 2026-06-13 17:02:54 fs.patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-13 18:04:03 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:04:51 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:05:17 fs.trash: `.task/os/device-approval/auth-methods-content.txt`
- 2026-06-13 18:05:29 fs.trash: `.task/os/device-approval/auth-type-content.txt`
- 2026-06-13 18:05:37 fs.trash: `.task/os/device-approval/test-small.txt`
- 2026-06-13 18:06:15 fs.trash: `.task/os/device-approval/worker-hidden-url.txt`
- 2026-06-13 18:08:28 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:20:22 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:21:36 fs.write: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:24:10 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:24:36 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13 18:24:58 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-13: fs.write workpad with acceptance criteria and test-first contract.
- 2026-06-14 03:24:20 fs.trash: `.task/os/device-approval/server-typecheck-errors.txt`
- 2026-06-14 03:24:37 fs.trash: `.task/os/device-approval/validation-summary.txt`
- 2026-06-14 03:26:40 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-14 03:27:33 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-14 03:28:28 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-14 03:32:27 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- 2026-06-14 03:33:48 fs.patch: `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`

## workspace-owned: validation evidence

- 2026-06-14 03:29:39 `review.run`: passed — OK
- 2026-06-14 03:34:49 `review.run`: passed — OK
- 2026-06-14 03:42:23 `verify`: failed — COMMAND_FAILED
- 2026-06-14 03:44:47 `verify`: failed — COMMAND_FAILED
- 2026-06-14 03:46:51 `verify`: failed — COMMAND_FAILED
- 2026-06-14 03:46:52 `verify`: failed — COMMAND_FAILED
- 2026-06-14 03:47:34 `verify`: failed — COMMAND_FAILED
- 2026-06-14 03:47:34 `verify`: failed — COMMAND_FAILED
- 2026-06-14 03:47:34 `verify`: failed — COMMAND_FAILED

## key decisions

- Google is the first approval method; passkey and magic link will plug into the same signed assertion contract later.
- The OS device authority stays on `os.consuelohq.com`; app/backend owns browser identity and signs approval assertions.

## notes for ko

- Do not paste or commit `OS_DEVICE_AUTH_ASSERTION_SECRET`.

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

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/twenty-server/package.json`
- `packages/twenty-server/project.json`
- `packages/twenty-server/src/engine/core-modules/auth/controllers/cli-auth.controller.ts`
- `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`
- `packages/twenty-server/src/engine/core-modules/auth/services/sign-in-up.service.ts`
- `packages/twenty-server/src/engine/core-modules/auth/strategies/google.auth.strategy.ts`
- `packages/twenty-server/src/engine/core-modules/auth/types/signInUp.type.ts`
- `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`
- `packages/twenty-server/src/engine/core-modules/twenty-config/twenty-config.service.ts`

## workspace-owned: test selection

- changed files: `.task/os/device-approval/current.json`, `.task/os/device-approval/evidence-log.json`, `.task/os/device-approval/read-log.json`, `.task/os/device-approval/session.json`, `.task/os/device-approval/workpad.md`, `.task/tasks/os/device-approval.json`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/install.ts`, `packages/os/tests/oauth-device-page-contract.test.ts`, `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`, `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`, `packages/twenty-server/src/engine/core-modules/auth/strategies/google.auth.strategy.ts`, `packages/twenty-server/src/engine/core-modules/auth/types/signInUp.type.ts`, `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`
- matched rules: `twenty-server-project`, `auto:twenty-server:test`
- selected suites: `twenty-server affected test target`
- run results: `twenty-server affected test target` failed
- failed suites: `twenty-server affected test target`
