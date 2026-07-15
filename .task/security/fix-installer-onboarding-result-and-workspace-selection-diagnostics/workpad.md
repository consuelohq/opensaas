# fix installer onboarding result and workspace selection diagnostics

branch: `task/security/fix-installer-onboarding-result-and-workspace-selection-diagnostics`
stream: `stream/security`
pr: https://github.com/consuelohq/opensaas/pull/1364
started: 2026-07-04

taskSession: `tsk_c6919ae33d03`

## acceptance criteria

- Normal hosted bootstrap must fail loudly when the child installer exits without valid onboarding JSON.
- The child installer must record the exact workspace-selection step around the verified-account workspace POST.
- Workspace-selection failures must show as diagnostic breadcrumbs and normal installer errors, not clean bootstrap completion.
- The fix must keep normal install generic for all users and keep dev diagnostics behind `CONSUELO_OS_DEV_DIAGNOSTICS=1`.
- Focused tests must prove the bootstrap guard and workspace-selection diagnostics contracts.

## test-first contract

Behavior under test:
- Interactive bootstrap with an empty, missing, or invalid child onboarding result fails before daemon setup and before `Consuelo OS setup complete`.
- Valid child onboarding JSON must include an object payload and boolean `installDaemons`, so bootstrap can safely decide LaunchAgent installation.
- After auth returns `workspace_required`, the installer records `workspace_selection` start, an HTTP/result breadcrumb for the POST, complete on approved, and failed on unavailable/denied/expired/exception.

Existing local pattern to follow:
- `packages/os/scripts/onboarding-flow.test.ts` already contains source-contract coverage for installer/bootstrap flow regressions.
- `packages/os/tests/install-diagnostics.test.ts` covers the local redacted diagnostics module.
- `packages/os/tests/oauth-device-http-client.test.ts` covers the device login client mapping layer.

New or changed tests:
- Add onboarding-flow source contracts for validated onboarding JSON and workspace-selection diagnostics.
- Add focused diagnostics or client tests only if implementation changes the public diagnostic/client contract.

Focused red command:
- `bun x vitest run scripts/onboarding-flow.test.ts` from `packages/os`.

Expected red failure:
- Current bootstrap has no valid-onboarding JSON guard, and current installer records only `security` plus `workspace.name`, so both new source contracts should fail.

## current findings

- Bootstrap currently creates `ONBOARDING_RESULT_FILE` with `mktemp`, runs the child installer, cats the file, then treats empty JSON as `installDaemons=false`.
- The child installer currently records `workspace.name`, calls `selectWorkspaceForDeviceLogin`, and throws `workspace selection failed: <status>` without recording which POST/state failed.
- The worker `/login/device/workspace` endpoint does return `approvedJson(g)`, including `connector_bootstrap_expires_at`; the likely live failure is route setup or malformed/missing bootstrap in the approved response, and diagnostics need to name that state.

## validation evidence

Red evidence:
- `bun x vitest run scripts/onboarding-flow.test.ts` failed after adding source contracts because bootstrap lacked a valid-onboarding JSON guard and installer lacked `workspace_selection` breadcrumbs. Existing flattened-home expectations also needed alignment with the current resolver shape.

Green evidence:
- `bun x vitest run scripts/onboarding-flow.test.ts` from `packages/os`: 17 passed.
- `bun x vitest run tests/oauth-device-http-client.test.ts` from `packages/os`: 6 passed.
- `bun x vitest run tests/install-diagnostics.test.ts` from `packages/os`: 3 passed.
- `bun run typecheck` from `packages/os`: workspace script syntax checks passed.
- `bash -n packages/os/scripts/bootstrap.sh`: passed.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`

## key decisions

- Bootstrap validates the child result with Bun before using `installDaemons`; empty/missing/malformed JSON now fails the install instead of implying `skip daemons`.
- Workspace-selection diagnostics are separate from the broader `security` step so the next failure names the POST boundary.
- The device-login client now preserves worker `message` fields for workspace-selection errors, so route setup failures keep the actual reason.

## workspace-owned: validation evidence

Red evidence:
- `bun x vitest run scripts/onboarding-flow.test.ts` failed after adding source contracts because bootstrap lacked a valid-onboarding JSON guard and installer lacked `workspace_selection` breadcrumbs. Existing flattened-home expectations also needed alignment with the current resolver shape.
Green evidence:
- `bun x vitest run scripts/onboarding-flow.test.ts` from `packages/os`: 17 passed.
- `bun x vitest run tests/oauth-device-http-client.test.ts` from `packages/os`: 6 passed.
- `bun x vitest run tests/install-diagnostics.test.ts` from `packages/os`: 3 passed.
- `bun run typecheck` from `packages/os`: workspace script syntax checks passed.
- `bash -n packages/os/scripts/bootstrap.sh`: passed.
- 2026-07-04 16:20:34 `review.run`: passed — OK
- 2026-07-04 16:20:50 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-installer-onboarding-result-and-workspace-selection-diagnostics/current.json`, `.task/security/fix-installer-onboarding-result-and-workspace-selection-diagnostics/session.json`, `.task/security/fix-installer-onboarding-result-and-workspace-selection-diagnostics/workpad.md`, `.task/tasks/security/fix-installer-onboarding-result-and-workspace-selection-diagnostics.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/oauth-device-http-client.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation gates

- `review.run --base HEAD --no-tests`: passed with 0 blocking issues.
- `verify --base HEAD`: passed and wrote publish-valid stamp to `.task/security/fix-installer-onboarding-result-and-workspace-selection-diagnostics/verify.json`.

## notes for Ko

- The normal installer will now stop if child onboarding exits early or writes empty/invalid JSON; it will no longer print clean completion and skip LaunchAgent setup from an empty result file.
- Dev diagnostics now include `device_login` and `workspace_selection` boundaries. A workspace-selection route failure should show as `workspace_route_setup_failed: <reason>` instead of disappearing behind `unavailable`.
- This does not loosen Cloudflare security rules or hardcode a user-specific workspace URL.
