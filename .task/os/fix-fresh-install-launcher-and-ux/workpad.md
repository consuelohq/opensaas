# fix fresh install launcher and UX

branch: `task/os/fix-fresh-install-launcher-and-ux`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2537
started: 2026-09-22

## acceptance criteria

- [x] Hosted curl install defaults to local mode without redundant mode/dependency prompts.
- [x] Device Google auth establishes reusable browser identity for the installed launcher.
- [x] Launcher opening uses the existing membership-validated workspace handoff.
- [x] Device Authority deploys preserve release-managed launcher snapshot values.
- [x] Successful hosted install output is quiet by default while diagnostics remain available.

## plan

1. Compare the fresh-Mac Stable behavior with current `stream/os`.
2. Add focused regressions for auth session reuse, exact workspace handoff, launcher snapshot deploy invariants, and quiet output.
3. Implement the smallest auth/bootstrap/release-config changes that satisfy those contracts.
4. Run focused and publish-gate validation, then merge through the stream workflow.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`

## key decisions

- Reuse the existing authority-session and workspace-handoff model instead of adding an installer-only auth primitive.
- Validate `workspace_host` against active memberships before issuing the handoff.
- Keep launcher snapshot vars release-managed and preserve runtime vars on generic Device Authority deploys.
- Keep workspace name as the only normal first-time prompt.

## notes for ko

- Stable was behind current stream work for the already-completed removal of the mode and dependency confirmation prompts.
- The old launcher was a real stale route snapshot, not merely a browser cache artifact.
- macOS Background Items attribution is separate packaging work and was intentionally not widened into this fix.

## improvements noticed

- Add a release smoke check that provisions a disposable workspace and verifies its root launcher snapshot matches the just-published version.

## errors i ran into

- Verify failed during the earlier in-progress state; it must pass after final edits before publish.
- One large patch retry did not match because prior retries had already applied part of the bootstrap change; exact function bodies were re-read before continuing.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: fresh curl install defaults to local, stays quiet on the happy path, opens the current launcher, and reuses the just-approved identity without a second Google login
existing local pattern: bootstrap-source.test.ts, install-workspace-bootstrap-contract.test.ts, onboarding-flow.test.ts, workspace-edge/device-authority launcher auth tests
new or changed tests: add focused launcher session handoff/freshness regression; extend quiet installer output contract if uncovered
focused red command: pending exact focused Vitest target after read-only source inspection
expected red failure: approved device auth currently does not establish the private workspace launcher session and/or stale snapshot selection remains reachable
no-test waiver: not applicable

- 2026-09-22 19:56:31 append: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`

## workspace-owned: activity log

- 2026-09-22 19:56:31 fs.write: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 20:01:24 fs.write: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 20:10:58 fs.write: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 21:22:33 fs.write: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/constants.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`
- `packages/os/scripts/deploy-cloudflare-worker.ts`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/cloudflare-worker-release-readiness.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/os/tests/universal-login.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/senior-engineer.md`

## Root causes confirmed

- Stable 0.1.126 was behind current stream/os for installer UX. Current stream already defaults hosted curl installs to local mode and removes the dependency confirmation.
- Device Google authorization did not issue the normal __Host-consuelo_os_authority browser session. The launcher therefore had no reusable authenticated web identity and sent the user through Google again.
- Fresh workspace route ko-2nd-test-computer.consuelohq.com was provisioned with stale launcher snapshot sha256-15c3f6f5c611b43c. Static snapshot vars in os-device-authority/wrangler.toml could overwrite the release-managed dynamic snapshot vars during a generic Worker deploy.
- Normal post-browser install output remained noisy because interactive install.ts was not passed --quiet and background-service setup used the non-capturing loading wrapper.
- macOS background-item notifications map to actual LaunchAgent executables: three /bin/bash launchers (system, Caddy, watchdog), direct cloudflared, and the Bun-based consuelo-os heartbeat. The shell entrypoints are currently mode 0644, so changing launcher attribution safely is separate packaging work rather than a low-risk plist-only edit.

## Implemented

- Device Google callbacks now create the same authority-session cookie used by normal web login.
- /auth/workspaces accepts a membership-validated workspace_host target for installer completion and issues the existing one-time host-bound workspace handoff.
- bootstrap opens the installed workspace through os.consuelohq.com/auth/workspaces so the authority cookie is consumed into a workspace session before the launcher renders.
- Removed release-managed launcher snapshot vars from static Device Authority wrangler config and added --keep-vars to generic Device Authority deploys.
- Interactive hosted onboarding passes --quiet outside debug mode.
- Background-service setup captures child stdout/stderr on success and emits it only on failure/debug.
- Final happy-path summary is reduced to “Consuelo OS installed”.

## Verification

- Focused device cookie red -> green: trc_f68c421dc405 -> trc_bf929bda359a
- Exact workspace handoff: trc_f9e56a55afc0
- Bootstrap launcher handoff: trc_82d8762afc45
- Worker release readiness red -> green: trc_9c967015614a -> trc_ea0d0281cc10
- Installer output cleanup red -> green: trc_44b2ea8d07c8 -> trc_6c0dc4e5dac0
- Combined focused suite: 4 files / 69 tests passed, trc_e2b11a696ced
- OS syntax/typecheck passed: trc_4d1de9204124
- Remote fresh-Mac LaunchAgent attribution evidence: trc_d462fccd9029
- Current combined focused suite: 4 files / 69 tests passed, trc_f44939aacdaa

- 2026-09-22 20:10:58 append: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 20:13:39 `verify`: failed — COMMAND_FAILED
- 2026-09-22 20:14:40 `verify`: failed — COMMAND_FAILED
- 2026-09-22 21:13:51 apply-patch: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 21:13:58 apply-patch: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 21:13:59 apply-patch: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 21:14:00 apply-patch: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 21:14:01 apply-patch: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
- 2026-09-22 21:15:03 `verify`: failed — COMMAND_FAILED
- 2026-09-22 21:15:17 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- 2026-09-22 21:15:17 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- 2026-09-22 21:16:24 `verify`: failed — COMMAND_FAILED
- 2026-09-22 21:17:55 apply-patch: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-09-22 21:17:56 apply-patch: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-09-22 21:19:07 `verify`: failed — COMMAND_FAILED
- 2026-09-22 21:20:01 `verify`: failed — COMMAND_FAILED

- 2026-09-22 21:21:16 apply-patch: `packages/os/scripts/compact-daemon-output.test.ts`
- Full publish gate passed after final regression updates: review/static/typecheck passed, all 11 registry-selected suites passed, DB guard passed, publish-valid verify stamp written at `.task/os/fix-fresh-install-launcher-and-ux/verify.json` (trace trc_fc9e1b0a3a74).
- Additional installer contract suite: `scripts/onboarding-flow.test.ts` + `scripts/compact-daemon-output.test.ts`, 29/29 passed (trace trc_dece56396734).

- 2026-09-22 21:22:33 append: `.task/os/fix-fresh-install-launcher-and-ux/workpad.md`
