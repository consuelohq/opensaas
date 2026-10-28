# Installer telemetry — Branch 2

## Acceptance criteria

- Generate exactly one Branch-1-contract `install_id` (`ins_<uuid-v4>`) per `install.ts` run and expose it to child/bootstrap work without placing it in user-facing URLs.
- Emit versioned Branch-1 install-event envelopes for the installer lifecycle with monotonic per-run sequence numbers and only allow-listed context.
- Propagate `x-consuelo-install-id` on installer Device Authority requests (device code, token poll, workspace selection, and install-aware status sync where appropriate).
- Classify device-auth failures into the Branch-1 stable codes (request/unavailable/denied/expired/timeout/poll/proof) instead of silently collapsing every failure into an unobservable fallback.
- Record anonymous install identity initially; after an approved canonical Device Authority grant, bind the install to canonical `userId`/`workspaceId`/`nodeId` when canonical user identity is actually returned. Never treat `google:<sub>` as canonical.
- Capture actionable installer failures in Sentry with safe tags/context/breadcrumbs (`install_id`, stage, stable error code, safe platform/architecture/channel/release fields). Raw exception message/stack may go only to Sentry; contract-forbidden fields must be scrubbed.
- Preserve installer resilience: telemetry/Sentry/diagnostic-upload failures must never break or change the install outcome.
- Provide failed diagnostic upload plumbing that can hand a redacted diagnostic bundle plus correlation metadata to the later control-plane/R2 integration without hard-coding Branch 3 storage internals.
- Instrument the hosted bootstrap/background-service boundary so LaunchAgent install/start/health failures can be correlated to the same install id and stable background-service error codes.
- Existing onboarding, diagnostics, device-auth, bootstrap, and install flows remain compatible; users without telemetry configuration can still install.
- The completed task is promoted into `stream/os` (normal task PR, not task-only) and the task worktree is cleaned up.

## Plan

1. Sync task branch to the already-merged Branch 1 contract in `stream/os` (done; task.start began from main, then merged `origin/stream/os`).
2. Add focused tests first for the installer telemetry runtime: one install id, monotonic event envelopes, safe Sentry metadata/scrubbing, non-fatal sink/upload behavior, identity binding, and stable failure classification.
3. Add device-login client tests first for `x-consuelo-install-id` propagation and canonical identity parsing only when the authority returns canonical IDs.
4. Add bootstrap/background-service tests first for carrying `CONSUELO_INSTALL_ID` into the child installer/daemon process and mapping daemon exit markers to stable failure categories.
5. Implement a small `install-telemetry.ts` runtime around the Branch 1 contract. Keep canonical event storage behind an injectable sink so Branch 3 can own persistence; make Sentry a lazy optional adapter.
6. Wire `install.ts` lifecycle/device-auth/provision/status-sync paths to the telemetry runtime. Emit the same structured events even when dev diagnostics are disabled.
7. Wire device-login request headers and approved identity fields without exposing the install id in verification URLs.
8. Wire bootstrap/daemon boundary correlation and stable background-service failure markers. Keep shell output secret-safe.
9. Add dependency/config changes required for the optional Sentry adapter, then validate focused tests, syntax/typecheck, strict review, and full verify (record the pre-existing operator-login unhandled-rejection issue if unchanged).
10. Push, open/merge normal task PR into `stream/os`, finish task.

## Test-first contract

RED must precede production edits. Initial failing tests will assert:

- `createInstallerTelemetry()` produces one valid `install_id`; events use Branch 1 schema/name/stage/outcome types and sequence 1..N.
- a failing telemetry sink and failing diagnostic uploader are swallowed by telemetry infrastructure and do not throw into the installer.
- Sentry receives only allow-listed tags/context plus the raw exception object; forbidden values such as URL/body/token/path are not sent as structured metadata.
- device-code/token/workspace requests carry `x-consuelo-install-id`, while the human verification URL does not gain that identifier.
- approved auth parsing can bind `{ userId, workspaceId, nodeId }` only from explicit canonical authority fields; `google:<sub>` is rejected/not promoted.
- denied/expired/unavailable/timeout/proof/poll failures map to Branch 1 stable codes.
- bootstrap exports the same install id to `install.ts` and `install-system-daemons.sh`; background service failures emit stable install/start/health markers that the parent can classify.

## Discovery / evidence

- Branch 1 contract is now present after merging `origin/stream/os`; contract files are `packages/os/scripts/lib/install-telemetry-contract.ts` and `packages/os/docs/install-telemetry-contract.md`.
- `install.ts` currently catches device-login failures and falls back with local dev diagnostics only; no central observability is emitted.
- `workspace-device-login-client.ts` centralizes device code, token poll, workspace selection, and agent-status HTTP calls and is the correct header propagation seam.
- Current approved grant JSON exposes workspace/node bootstrap fields but not canonical user ID. Device Authority internally has `accountId`; the main app approval path sets that to `approvedUser.id`, while direct Google authority flow can still use `google:<sub>`. Branch 2 must not guess canonical identity; only bind canonical user identity when explicitly returned under the canonical contract.
- `install-system-daemons.sh` performs LaunchAgent bootstrap and post-cutover health checks after TypeScript onboarding. Hosted `bootstrap.sh` is the parent process, so background-service correlation must cross the bootstrap/child boundary rather than be faked inside `install.ts`.
- Existing CLI Sentry pattern lazy-loads `@sentry/node`; OS package currently has no Sentry dependency. Workspace already carries Sentry v10 elsewhere, so add an explicit OS production dependency if the runtime adapter imports it.
- Local `install-diagnostics.ts` is dev-only and must remain separate from always-on structured telemetry. Its redaction primitives can be reused conceptually, but canonical event context stays allow-listed by the Branch 1 contract.

## Recovery log

- First `task.start` call omitted `title` and was rejected; retried correctly.
- `task.start` created the task from `main`, so Branch 1 contract was initially missing. Confirmed Branch 1 on `stream/os`, then fetched and merged `origin/stream/os` into this task before implementation.
- One discovery batch used the wrong `fs.search` argument name (`query` instead of `pattern`); corrected immediately. No production files were changed.
- First workpad overwrite omitted `force`; the task fs correctly refused to replace the template. Retrying with `force`.

## Status

Task started. Discovery complete enough to define the test contract. No production telemetry implementation edits yet; next step is RED tests.

- 2026-08-13 16:44:47 write: `.task/os/installer-telemetry/workpad.md`

## files changed

- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/lib/install-telemetry-sentry.ts`
- `packages/os/scripts/lib/install-telemetry.ts`
- `packages/os/tests/installer-telemetry-device-correlation.test.ts`
- `packages/os/tests/installer-telemetry-onboarding-wiring.test.ts`
- `packages/os/tests/installer-telemetry-runtime.test.ts`


## workspace-owned: files changed

- `packages/os/scripts/lib/install-telemetry-sentry.ts`
- `packages/os/scripts/lib/install-telemetry.ts`
- `packages/os/tests/installer-telemetry-device-correlation.test.ts`
- `packages/os/tests/installer-telemetry-onboarding-wiring.test.ts`
- `packages/os/tests/installer-telemetry-runtime.test.ts`

## workspace-owned: activity log

- 2026-08-13 16:44:47 fs.write: `.task/os/installer-telemetry/workpad.md`
- 2026-08-13 16:48:30 fs.write: `packages/os/tests/installer-telemetry-runtime.test.ts`
- 2026-08-13 16:48:48 fs.write: `packages/os/tests/installer-telemetry-device-correlation.test.ts`
- 2026-08-13 16:49:01 fs.write: `.task/os/installer-telemetry/workpad.md`
- 2026-08-13 16:49:51 fs.write: `packages/os/scripts/lib/install-telemetry.ts`
- 2026-08-13 16:51:29 fs.write: `packages/os/scripts/lib/install-telemetry-sentry.ts`
- 2026-08-13 16:54:13 fs.write: `packages/os/tests/installer-telemetry-onboarding-wiring.test.ts`
- 2026-08-13 16:58:22 fs.write: `.task/os/installer-telemetry/workpad.md`
- 2026-08-13 17:03:37 fs.write: `.task/os/installer-telemetry/workpad.md`
- 2026-08-13 17:04:08 fs.write: `.task/os/installer-telemetry/workpad.md`

## workspace-owned: files read

- `packages/os/docs/install-telemetry-contract.md`
- `packages/os/package.json`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-diagnostics.ts`
- `packages/os/scripts/lib/install-telemetry-contract.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/workspace/scripts/task-push.js`

## RED evidence

Focused RED run:
`bun --cwd packages/os vitest run tests/installer-telemetry-runtime.test.ts tests/installer-telemetry-device-correlation.test.ts`

Expected failures observed before production edits:
- missing `scripts/lib/install-telemetry` runtime module;
- Device Authority machine requests do not yet send `x-consuelo-install-id`;
- approved response does not yet parse explicit canonical `user_id`;
- expected device-auth failures do not yet expose Branch 1 stable error codes;
- bootstrap/background daemon path does not yet carry `CONSUELO_INSTALL_ID` or stable background-service failure markers.

One test intentionally passed in RED: an `account_id: google:<sub>` response is not currently promoted to `userId`, preserving the Branch 1 canonical-identity rule.

Additional discovery recovery: a `fs.search` pattern containing an unescaped parenthesis and a search over a nonexistent `apps` path both failed without changing files; subsequent reads/searches used exact existing paths/patterns.

- 2026-08-13 16:49:01 append: `.task/os/installer-telemetry/workpad.md`

- 2026-08-13 16:49:51 write: `packages/os/scripts/lib/install-telemetry.ts`

- 2026-08-13 16:50:42 apply-patch: `packages/os/scripts/lib/workspace-device-authorization.ts`
- 2026-08-13 16:50:42 apply-patch: `packages/os/scripts/lib/workspace-device-login-client.ts`
- 2026-08-13 16:50:48 apply-patch: `packages/os/tests/installer-telemetry-device-correlation.test.ts`

- 2026-08-13 16:51:29 write: `packages/os/scripts/lib/install-telemetry-sentry.ts`

- 2026-08-13 16:51:49 apply-patch: `packages/os/package.json`
- 2026-08-13 16:52:14 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-08-13 16:52:14 apply-patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-08-13 16:53:40 apply-patch: `packages/os/scripts/lib/install-telemetry.ts`
- 2026-08-13 16:53:40 apply-patch: `packages/os/scripts/install-system-daemons.sh`

- 2026-08-13 16:54:13 write: `packages/os/tests/installer-telemetry-onboarding-wiring.test.ts`

- 2026-08-13 16:55:18 apply-patch: `packages/os/scripts/install.ts`
- 2026-08-13 16:55:55 apply-patch: `packages/os/scripts/install.ts`

## workspace-owned: validation evidence

- 2026-08-13 16:57:21 `review.run`: passed — OK
- 2026-08-13 16:57:38 apply-patch: `packages/os/scripts/lib/install-telemetry-sentry.ts`
- 2026-08-13 16:57:38 apply-patch: `packages/os/scripts/lib/install-telemetry.ts`
- 2026-08-13 16:57:56 `review.run`: passed — OK
- 2026-08-13 16:59:21 `verify`: failed — COMMAND_FAILED
- 2026-08-13 16:59:45 `review.run`: passed — OK
- 2026-08-13 17:00:44 `verify`: failed — COMMAND_FAILED
- 2026-08-13 17:03:54 `review.run`: passed — OK

## Implementation status

Branch 2 implementation is now wired end-to-end on the installer side:

- Added `scripts/lib/install-telemetry.ts` around the Branch 1 contract. It owns one install ID per run, monotonic event envelopes, allow-listed context, anonymous/canonical identity state, non-fatal event/reporter plumbing, and diagnostic-uploader handoff.
- Added lazy optional `@sentry/node` adapter in `scripts/lib/install-telemetry-sentry.ts`. It initializes only when `CONSUELO_OS_SENTRY_DSN` or `SENTRY_DSN` is configured, disables default PII, adds safe install breadcrumbs/tags/context, and captures the original exception object.
- `install.ts` now records installer start, device authorization, workspace selection, local provisioning, agent-status sync, health, completion/degraded completion, and terminal failure events. Recoverable device-auth and agent-status failures are no longer observability-silent.
- Machine Device Authority requests now propagate `x-consuelo-install-id`; the human verification URL remains unchanged.
- Device authorization results expose a separate `telemetryErrorCode` while preserving pre-existing device-domain `errorCode` values. Explicit `user_id` can bind canonical identity; `account_id` and `google:<sub>` are never promoted.
- `bootstrap.sh` establishes/exports one valid `CONSUELO_INSTALL_ID` after Bun is available so the TypeScript installer and later daemon installation share the same run identifier.
- `install-system-daemons.sh` classifies nonzero exits as install/start/health-check failures, emits a safe install/error-code marker, and optionally writes the same pair to `CONSUELO_BACKGROUND_SERVICE_RESULT_FILE` for the parent/integration layer.
- Failed diagnostic handoff is wired through an injectable uploader interface; Branch 3/7 can supply canonical control-plane/R2 transport without Branch 2 hard-coding storage endpoints. Successful diagnostic upload remains opt-in (`CONSUELO_OS_UPLOAD_SUCCESS_DIAGNOSTICS=1`) per the Branch 1 retention contract.
- `@sentry/node` is now an explicit OS runtime dependency. Existing lock resolution already covered the requested `^10.38.0` range, so `yarn install --mode=update-lockfile` produced no lockfile delta.

## Validation evidence so far

- RED onboarding wiring test run failed all 3 expected assertions before `install.ts` telemetry integration (missing correlation propagation / failure event / canonical binding).
- GREEN telemetry tests: 12/12 across runtime, device correlation, and onboarding wiring.
- Regression bundle: 54/54 across Branch 1 contract, existing diagnostics, OAuth device HTTP client, onboarding flow/UI, and all Branch 2 tests.
- `bash -n scripts/bootstrap.sh` and `bash -n scripts/install-system-daemons.sh`: pass.
- `bun run --cwd packages/os typecheck` (`check-syntax.js`): pass.
- `git diff --check`: pass.
- Strict review initially found 5 static ERROR_HANDLING findings in the new telemetry/Sentry helpers. Refactored the Sentry adapter to promise chaining and added defensive local catch boundaries in the telemetry runtime. Strict review rerun: 0 blocking/review issues.
- Real dry-run smoke with inherited `CONSUELO_INSTALL_ID`: pass (`installer-dry-run-ok`).
- Real daemon failure smoke with nonexistent daemon user + result file: pass; the same install ID and `BACKGROUND_SERVICE_INSTALL_FAILED` were emitted (`background-service-failure-correlation-ok`).

## Additional recovery notes

- The first package.json dependency patch assumed an older `@clack/prompts` line and did not match; reread the manifest and applied the exact hunk. No unintended file change.
- The first package-script syntax invocation used Bun's `--cwd` placement incorrectly and printed CLI help while exiting zero; reran correctly as `bun run --cwd packages/os typecheck` and recorded the real passing result.

## Remaining

- Run the full task safety gate and classify any failure against the known pre-existing `operator-login.test.ts` unhandled-rejection issue.
- Inspect final diff/status, update this workpad with final evidence, then push -> normal task PR into `stream/os` -> finish/cleanup.

- 2026-08-13 16:58:22 append: `.task/os/installer-telemetry/workpad.md`

- 2026-08-13 16:59:34 apply-patch: `packages/os/scripts/install.ts`

## Full-gate classification

- Full `verify` now reaches a clean Branch-2 review/db result but still reports `publishValid: false` because the repository-wide facade suite is already red on the exact `origin/stream/os` base.
- The full gate/test runner wrote two unrelated `fs.list` snapshots into `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`; those generated changes were reverted and are not part of Branch 2.
- Proven pre-existing independently: a detached worktree at exact `origin/stream/os` SHA `25dbe03f50d8663829de658153c2a3f333874231`, sharing only the existing dependency installation, ran `tests/facade/facade.test.ts` and exited 1 with the same `43 failed | 636 passed (679)` and `2 written` snapshots.
- `git diff --quiet origin/stream/os -- packages/os/tests/facade packages/os/scripts/lib/facade packages/os/tools/deployment-provider/redaction.ts` confirms Branch 2 has no changes in the failing facade surface.
- The facade failures are workspace-tool/media/subagent/fs/code.call contract mismatches unrelated to installer telemetry. This task will use the repository's explicit approved-publish path rather than absorb unrelated facade repairs. The earlier Branch-1 record also notes a separate pre-existing `operator-login.test.ts` unhandled-rejection issue in the full OS suite; Branch 2 does not modify that surface either.

## Finalization plan

- Re-run the focused 54-test regression bundle, shell syntax/diff check, and strict review after the final telemetry boundary patch.
- Inspect final diff/name list for unrelated files.
- Publish with approval reason documenting the exact base-worktree facade reproduction, then use normal `task.pr` so this task is merged into `stream/os` (not task-only), and finish/clean the task worktree.

- 2026-08-13 17:03:37 append: `.task/os/installer-telemetry/workpad.md`

## Final validation

- Focused regression rerun after final patch: 8 files / 54 tests passed.
- Shell syntax and `git diff --check`: pass (`syntax-and-diff-ok`).
- Final strict review against `origin/stream/os`: 0 blocking issues, 0 review issues.
- Final status contains only Branch-2 installer/telemetry files plus task metadata/workpad; no facade source/test/snapshot diff remains.
- Approved-publish justification: full-gate facade failure reproduced unchanged on exact stream base (43 failing / 636 passing), while Branch-2-owned tests and strict review are green.

- 2026-08-13 17:04:08 append: `.task/os/installer-telemetry/workpad.md`
