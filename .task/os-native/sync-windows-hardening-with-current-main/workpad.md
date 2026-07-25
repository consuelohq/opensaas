# sync Windows hardening with current main

branch: `task/os-native/sync-windows-hardening-with-current-main`
stream: `stream/os-native`
pr: https://github.com/consuelohq/opensaas/pull/1658
started: 2026-07-25

## goal

Reconcile the fully reviewed Windows hardening with current `main`, which already contains the original Worker 21 implementation plus later web changes. Preserve the hardening exactly where it supersedes the original code, retain unrelated current-main changes, and repair native-stream ancestry before PR #1656 promotion.

## acceptance criteria

- [ ] Merge current `origin/main` into the scoped task branch with a real two-parent merge.
- [ ] Resolve only the nine known Windows implementation/test conflicts.
- [ ] Prove each resolved file equals the tested hardening version except for unrelated current-main hunks.
- [ ] Run Windows platform/bootstrap, lifecycle, retention, runtime-bundle, universal-login, and trace route regression suites.
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

- 2026-07-25 03:04:03 write: `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-25 03:04:03 fs.write: `.task/os-native/sync-windows-hardening-with-current-main/workpad.md`
