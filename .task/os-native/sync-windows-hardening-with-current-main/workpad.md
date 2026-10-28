# sync Windows hardening with current main

branch: `task/os-native/sync-windows-hardening-with-current-main`
stream: `stream/os-native`
pr: https://github.com/consuelohq/opensaas/pull/1658
started: 2026-07-25

## goal

Reconcile the fully reviewed Windows hardening with current `main`, which already contains the original Worker 21 implementation plus later web changes. Preserve the hardening exactly where it supersedes the original code, retain unrelated current-main changes, and repair native-stream ancestry before PR #1656 promotion.

## acceptance criteria

- [x] Merge current `origin/main` into the scoped task branch with a real two-parent merge.
- [x] Resolve only the nine known Windows implementation/test conflicts.
- [x] Prove each resolved file equals the tested hardening version except for unrelated current-main hunks.
- [x] Run Windows platform/bootstrap, lifecycle, retention, runtime-bundle, universal-login, and trace route regression suites.
- [ ] Run OS typecheck, strict review, and publish-valid verification.
- [ ] Merge the reconciliation into `stream/os-native` without squashing away main ancestry.
- [ ] Refresh and merge PR #1656 after normal CI.
- [ ] Do not request or retry external AI reviews.

## test-first contract

This is ancestry reconciliation, not a new behavior change. Existing tests are the contract. No tested hardening assertion may be removed to resolve conflicts:

- drive-root validation and bounded child cleanup;
- synchronized output capture teardown;
- PowerShell 5.1-safe host detection;
- execute-only ancestor ACLs;
- lazy valid SID resolution with no Null SID fallback;
- stopped-state wait before uninstall cleanup;
- null-health readiness diagnostics;
- direct Windows URL handling;
- Debug and Release x64 service outputs.

The merged branch must also retain current-main web/auth/trace behavior.

## current status

- Task PR #1655 completed 49/49 checks, including native Windows build and acceptance, and merged to `stream/os-native`.
- Stream PR #1656 is green but conflict-dirty because `main` advanced after the web stream merged.
- Direct `stream.sync` reported nine conflicts in the Windows files that exist independently on both histories.

## reconciliation result

- Created merge commit `3439aed519d17ef6b3d4c121ad06df0c715b73a2` with native-stream/task parent `de65c4544af963df67c9e630469d4ac99e697c00` and current-main parent `e3b9e675f972f9935bcb2cb46b170fe22ef25024`.
- The conflict list exactly matched the nine expected Windows implementation/test files; no other conflict was accepted.
- Each resolved file's Git blob is byte-identical to `origin/stream/os-native`, preserving the implementation that passed PR #1655's 49 checks.
- Unrelated current-main web/auth/trace changes auto-merged outside those files.

## validation evidence

- GREEN: 25/25 Windows platform/bootstrap tests.
- GREEN: 72/72 lifecycle, retention/uninstall, and runtime-bundle tests.
- GREEN: 18/18 universal-login, Hono trace, redaction, and renderer tests.
- GREEN: OS package typecheck/syntax gate.
- Combined evidence trace: `trc_c1ba456d9f74`.

- 2026-07-25 03:04:03 write: `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-25 03:04:03 fs.write: `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`

- 2026-07-25 03:05:02 apply-patch: `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`

## workspace-owned: validation evidence

- GREEN: 25/25 Windows platform/bootstrap tests.
- GREEN: 72/72 lifecycle, retention/uninstall, and runtime-bundle tests.
- GREEN: 18/18 universal-login, Hono trace, redaction, and renderer tests.
- GREEN: OS package typecheck/syntax gate.
- Combined evidence trace: `trc_c1ba456d9f74`.
- 2026-07-25 03:04:03 write: `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`
- 2026-07-25 03:05:26 `review.run`: passed — OK
- 2026-07-25 03:05:40 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os-native/resolve-windows-platform-review-findings/current.json`, `.task/os-native/resolve-windows-platform-review-findings/evidence-log.json`, `.task/os-native/resolve-windows-platform-review-findings/read-log.json`, `.task/os-native/resolve-windows-platform-review-findings/session.json`, `.task/os-native/resolve-windows-platform-review-findings/verify.json`, `.task/os-native/resolve-windows-platform-review-findings/workpad.md`, `.task/os-native/sync-windows-hardening-with-current-main/current.json`, `.task/os-native/sync-windows-hardening-with-current-main/session.json`, `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`, `.task/tasks/os-native/resolve-windows-platform-review-findings.json`, `.task/tasks/os-native/sync-windows-hardening-with-current-main.json`, `packages/os/native/windows-service/Consuelo.Windows.Service.csproj`, `packages/os/native/windows-service/Program.cs`, `packages/os/scripts/bootstrap.ps1`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/windows-platform.ts`, `packages/os/scripts/lifecycle.ts`, `packages/os/scripts/testing/windows-platform-acceptance.ps1`, `packages/os/tests/windows-bootstrap-source.test.ts`, `packages/os/tests/windows-platform.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
