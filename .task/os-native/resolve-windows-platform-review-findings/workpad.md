# resolve Windows platform review findings

branch: `task/os-native/resolve-windows-platform-review-findings`
stream: `stream/os-native`
pr: https://github.com/consuelohq/opensaas/pull/1655
started: 2026-07-25

## goal

Verify and resolve every actionable CodeRabbit finding left on Worker 21 after PR #1646 and native stream PR #1653 merged. Preserve the accepted Windows lifecycle contract while hardening service startup, shutdown, ACLs, PowerShell compatibility, SID resolution, uninstall sequencing, acceptance diagnostics, and browser authorization.

## acceptance criteria

- [x] Guard drive-root `consueloHome` before deriving HOME/USERPROFILE.
- [x] Kill a started Bun child if Job Object creation or assignment fails.
- [x] Stop asynchronous output capture and serialize writer disposal safely.
- [x] Support Windows PowerShell 5.1 under strict mode without directly reading undefined `$IsWindows`.
- [x] Grant execute-only ancestor traversal rather than directory enumeration rights.
- [x] Wait for the SCM service to reach `stopped` before ACL, service, and binary removal.
- [x] Remove the Null SID fallback and resolve/validate the current interactive SID only when installation needs it.
- [x] Preserve the intended acceptance failure message when health remains null.
- [x] Launch device verification URLs with a direct Windows URL handler.
- [x] Remove the unused bootstrap authorization helper and add a predictable Debug x64 service build.
- [x] Explicitly disposition the test-factory nitpick without unnecessary product churn.
- [ ] Run focused unit/source tests, native Windows CI, review, and publish-valid verification.
- [x] Do not request or retry external AI reviews.

## test-first contract

Before production edits, focused tests must prove the currently merged defects:

- service controller tests expect execute-only traversal, SID resolution through the injected runner, and an SCM `stopped` wait before cleanup;
- source contracts expect PowerShell 5.1-safe host detection, null-health guarding, direct Windows URL handling, no unused authorization helper, C# parent validation/job cleanup/log synchronization, and Debug x64 output settings;
- the tests must fail on the current native stream before implementation.

## findings

All eight actionable CodeRabbit findings are valid against the merged code. Three nitpicks were also evaluated: removing the unused PowerShell helper and adding Debug x64 settings are bounded and useful; extracting a controller test factory is maintainability-only and will be skipped unless required by the functional test additions.

## plan

1. Add focused failing behavioral and source-contract assertions.
2. Apply minimal production corrections, centralizing lazy SID resolution in the service controller.
3. Run Windows unit/source/distribution suites and C#/PowerShell syntax/build gates where available.
4. Run strict review and full verification.
5. Merge to `stream/os-native`, promote the correction to `main`, and post dispositions on PR #1646 without requesting another review.

## dispositions

- Fixed all eight actionable inline/outside-diff findings.
- Fixed the bounded Debug x64 and unused-helper nitpicks.
- Skipped the controller test-factory nitpick: the new functional tests remain readable and the refactor would add broad non-behavioral churn to a security/stability correction.
- SID resolution is lazy inside the controller: install resolves or validates it, while status, diagnostics, restart, dry-run uninstall, and uninstall do not require an unrelated caller-supplied identity.
- Job setup failure now kills the child and executes the same bounded runtime/log teardown used by normal service stop.

## test-first and validation evidence

- RED: 9/25 focused tests failed against the merged native stream, covering PowerShell 5.1 detection, dead helper, null health, URL launch, least-privilege traversal, SID fallback, uninstall sequencing, service-host cleanup, and Debug x64 output (`trc_9664d54f3c99`).
- GREEN: Windows platform and bootstrap source contracts passed 25/25 (`trc_22aaa0ebd724`).
- GREEN: lifecycle engine, retention/uninstall, and runtime-bundle regression suites passed 72/72 (`trc_22aaa0ebd724`).
- GREEN: OS package typecheck/syntax gate passed (`trc_22aaa0ebd724`).
- GREEN: strict task review reported zero owned or pre-existing findings (`trc_002d812985eb`).
- GREEN: full task verification is publish-valid; package registry and DB safety passed (`trc_41786c3440b4`).
- Native Windows build and acceptance remain required in authoritative GitHub CI before promotion.

## files changed

- `packages/os/native/windows-service/Program.cs`
- `packages/os/native/windows-service/Consuelo.Windows.Service.csproj`
- `packages/os/scripts/bootstrap.ps1`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/windows-platform.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/testing/windows-platform-acceptance.ps1`
- `packages/os/tests/windows-bootstrap-source.test.ts`
- `packages/os/tests/windows-platform.test.ts`

- 2026-07-25 02:46:33 write: `.task/os-native/resolve-windows-platform-review-findings/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-25 02:46:33 fs.write: `.task/os-native/resolve-windows-platform-review-findings/workpad.md`

- 2026-07-25 02:46:57 apply-patch: `packages/os/tests/windows-platform.test.ts`
- 2026-07-25 02:46:57 apply-patch: `packages/os/tests/windows-bootstrap-source.test.ts`
- 2026-07-25 02:48:13 apply-patch: `packages/os/native/windows-service/Program.cs`
- 2026-07-25 02:48:13 apply-patch: `packages/os/native/windows-service/Consuelo.Windows.Service.csproj`
- 2026-07-25 02:48:13 apply-patch: `packages/os/scripts/bootstrap.ps1`
- 2026-07-25 02:48:13 apply-patch: `packages/os/scripts/testing/windows-platform-acceptance.ps1`
- 2026-07-25 02:48:13 apply-patch: `packages/os/scripts/install.ts`
- 2026-07-25 02:48:13 apply-patch: `packages/os/scripts/lib/windows-platform.ts`
- 2026-07-25 02:48:13 apply-patch: `packages/os/scripts/lifecycle.ts`
- 2026-07-25 02:48:42 apply-patch: `packages/os/tests/windows-platform.test.ts`
- 2026-07-25 02:49:47 apply-patch: `packages/os/native/windows-service/Program.cs`
- 2026-07-25 02:49:47 apply-patch: `packages/os/tests/windows-platform.test.ts`

- 2026-07-25 02:50:15 apply-patch: `.task/os-native/resolve-windows-platform-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-07-25 02:50:39 `review.run`: passed — OK
- 2026-07-25 02:50:53 apply-patch: `packages/os/scripts/lib/windows-platform.ts`
- 2026-07-25 02:51:14 `review.run`: passed — OK
- 2026-07-25 02:51:26 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os-native/resolve-windows-platform-review-findings/current.json`, `.task/os-native/resolve-windows-platform-review-findings/evidence-log.json`, `.task/os-native/resolve-windows-platform-review-findings/read-log.json`, `.task/os-native/resolve-windows-platform-review-findings/session.json`, `.task/os-native/resolve-windows-platform-review-findings/workpad.md`, `.task/tasks/os-native/resolve-windows-platform-review-findings.json`, `packages/os/native/windows-service/Consuelo.Windows.Service.csproj`, `packages/os/native/windows-service/Program.cs`, `packages/os/scripts/bootstrap.ps1`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/windows-platform.ts`, `packages/os/scripts/lifecycle.ts`, `packages/os/scripts/testing/windows-platform-acceptance.ps1`, `packages/os/tests/windows-bootstrap-source.test.ts`, `packages/os/tests/windows-platform.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

- 2026-07-25 02:51:37 apply-patch: `.task/os-native/resolve-windows-platform-review-findings/workpad.md`