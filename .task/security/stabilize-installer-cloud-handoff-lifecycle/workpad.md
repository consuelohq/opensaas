# stabilize installer cloud handoff lifecycle

branch: `task/security/stabilize-installer-cloud-handoff-lifecycle`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1374/stabilize-installer-cloud-handoff-lifecycle
github pr: https://github.com/consuelohq/opensaas/pull/1374
started: 2026-07-08

## acceptance criteria

- [x] Fix the installer failure where the child process exits after `workspace_selection` `request` and before writing onboarding result JSON.
- [x] Keep the normal installer generic for all users; no Ko-machine URL, workspace, IP, or one-off hardcoding.
- [x] Keep diagnostics gated by `CONSUELO_OS_DEV_DIAGNOSTICS=1`, local, and redacted.
- [x] Add a behavior-level test that exercises the workspace selection handoff, not only source-string assertions.
- [x] Preserve existing auth-first flow and flattened `~/.consuelo` install home behavior.
- [x] Validate focused OS tests, typecheck, review, and verify before push.

## current evidence

Ko's latest diagnostics showed:

- Device code request succeeds.
- Polling reaches `workspace_required` and asks for a workspace name.
- Diagnostics record `workspace_selection` `start` and `request`.
- The process records lifecycle exit before any `device.workspace_selection` HTTP result or `workspace_selection` complete/failed step.
- The raw onboarding result file is empty, so bootstrap reports: `Consuelo OS interactive onboarding did not complete: onboarding result file was empty`.

Working diagnosis:

- The workspace-selection POST was the same async-liveness class as the previous poll failure.
- `attemptWorkspaceDeviceLogin` already wrapped poll wait/request in `withRuntimeHold`.
- `resolveWorkspaceIdentity` called `selectWorkspaceForDeviceLogin` directly, so Bun could exit while that cloud request was pending.

## implementation

- Added exported `completeWorkspaceDeviceSelection` in `packages/os/scripts/install.ts`.
- Moved workspace-selection diagnostics and result handling into that helper.
- Wrapped `selectWorkspaceForDeviceLogin` in `withRuntimeHold`.
- Preserved `device.workspace_selection` HTTP breadcrumbs and complete/failed installer steps.
- Kept secrets out of installer step diagnostics; the bootstrap token remains only in the returned workspace bootstrap payload.
- Replaced the inline `resolveWorkspaceIdentity` workspace-selection block with the helper call.

## test-first contract

Behavior under test:

- When device login returns `workspace_required`, workspace selection records `start`, `request`, HTTP result, and `complete` or `failed` before returning or throwing.
- The POST to `/login/device/workspace` executes inside the runtime hold so the child installer cannot go idle before the HTTP result.
- Server-supplied `message` and `errorCode` are preserved in diagnostics for unavailable or rejected workspace selection responses.
- No raw verification URL, device code, token, proof, or state is added to diagnostics.

Red evidence:

- `cd packages/os && bun x vitest run scripts/onboarding-flow.test.ts` failed as expected with `TypeError: completeWorkspaceDeviceSelection is not a function` after adding the behavior test first.

Green evidence:

- `cd packages/os && bun x vitest run scripts/onboarding-flow.test.ts` passed: 21 tests.
- `cd packages/os && bun x vitest run scripts/onboarding-flow.test.ts tests/bootstrap-source.test.ts tests/install-diagnostics.test.ts` passed: 36 tests.
- `cd packages/os && bun run typecheck` passed: `workspace script syntax checks passed`.
- `review.run --base origin/main --no-tests` passed after moving cloud-request error capture inside the runtime-held async boundary.
- `verify --base origin/main` passed and wrote `.task/security/stabilize-installer-cloud-handoff-lifecycle/verify.json`.

Verification note:

- Workspace verify selected zero registry suites for these changed files, so the focused installer/diagnostics suites above are the behavior proof for this task.

## files changed

- `.task/security/stabilize-installer-cloud-handoff-lifecycle/verify.json`
- `.task/security/stabilize-installer-cloud-handoff-lifecycle/workpad.md`
- `.task/tasks/security/stabilize-installer-cloud-handoff-lifecycle.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/onboarding-flow.test.ts`

## workspace-owned: files changed

- `.task/security/stabilize-installer-cloud-handoff-lifecycle/verify.json`
- `.task/security/stabilize-installer-cloud-handoff-lifecycle/workpad.md`
- `.task/tasks/security/stabilize-installer-cloud-handoff-lifecycle.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/onboarding-flow.test.ts`

## workspace-owned: activity log

- 2026-07-08 16:32:24 fs.write: `.task/security/stabilize-installer-cloud-handoff-lifecycle/workpad.md`
- 2026-07-08: added failing behavior test for runtime-held workspace selection handoff.
- 2026-07-08: extracted workspace selection handoff helper and wrapped the cloud POST in `withRuntimeHold`.
- 2026-07-08: fixed review finding by recording request exceptions inside the runtime-held async operation.
- 2026-07-08: task started from `main` after `stream/security` context showed local stream ahead of origin by 8.

## workspace-owned: validation evidence

- Red: `cd packages/os && bun x vitest run scripts/onboarding-flow.test.ts` failed on missing `completeWorkspaceDeviceSelection` helper.
- Green: `cd packages/os && bun x vitest run scripts/onboarding-flow.test.ts tests/bootstrap-source.test.ts tests/install-diagnostics.test.ts` passed: 36 tests.
- Green: `cd packages/os && bun run typecheck` passed.
- Green: `review.run --base origin/main --no-tests` passed: 0 blocking issues.
- Green: `verify --base origin/main` passed and wrote publish-valid stamp.
- 2026-07-08 16:32:35 `verify`: passed — OK

## key decisions

- Do not add Hono in this branch. The failure is inside the local Bun CLI installer lifecycle, not the HTTP router layer.
- Start from `main` to avoid stale task worktree state.
- Keep the fix generic. Diagnostics are dev-only; the install flow remains user-generic.

## notes for ko

- This branch fixes the current install crash class first. After it lands and releases, the next reinstall should get past workspace selection instead of returning an empty onboarding result file.
- Security rule cleanup and installer release remain follow-through steps once this branch is promoted/merged.

## improvements noticed

- `stream/security` is locally ahead of origin by 8 from the earlier sync. This task is still started from `main` per approval.
- The test registry does not automatically select `scripts/onboarding-flow.test.ts` for `install.ts`; focused tests are recorded here until registry coverage improves.

## issues and recovery

- The provisional task session returned by `task.intent` was rejected by `stream.context`; using the real `task.start` session `tsk_e6ba6255d489`.
- Review initially flagged the helper async request boundary; fixed by moving request-level failure capture inside the runtime-held operation.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): stabilize installer cloud handoff" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-08 16:32:24 write: `.task/security/stabilize-installer-cloud-handoff-lifecycle/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/stabilize-installer-cloud-handoff-lifecycle/current.json`, `.task/security/stabilize-installer-cloud-handoff-lifecycle/session.json`, `.task/security/stabilize-installer-cloud-handoff-lifecycle/verify.json`, `.task/security/stabilize-installer-cloud-handoff-lifecycle/workpad.md`, `.task/tasks/security/stabilize-installer-cloud-handoff-lifecycle.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/onboarding-flow.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
