# preserve windows service host after runtime bundle review

branch: `task/os/preserve-windows-service-host-after-runtime-bundle-review`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1726/preserve-windows-service-host-after-runtime-bundle-review
github pr: https://github.com/consuelohq/opensaas/pull/1726
started: 2026-07-29

## acceptance criteria

- [x] Reproduce the exact-head review finding with a focused failing test.
- [x] Preserve the built Windows service host while excluding `obj/**` intermediates.
- [x] Follow the required `should ... when ...` test naming convention.
- [x] Pass strict review and full verification.
- [ ] Pass the native Windows GitHub job.

## plan

1. Confirm the release workflow output and bootstrap lookup path.
2. Change the regression first so the missing service host fails.
3. Narrow production classification from `obj/**` plus `bin/**` to `obj/**` only.
4. Run focused tests, strict review, verification, and exact Windows CI.

## current status

- Review correction, strict review, and full verification are green; ready to publish.

## files changed

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: focused bundle suite failed because the expected `bin/x64/Release/Consuelo.Windows.Service.exe` was absent (19 pass, 1 fail).
- Green: bundle and release workflow suites pass (28 tests, 251 assertions).
- Strict review: 0 issues.
- Full verification: publish-valid with static, type, spec, package, and DB gates green.
- 2026-07-29 07:50:45 `review.run`: passed — OK
- 2026-07-29 07:50:58 `verify`: passed — OK
- 2026-07-29 07:51:15 `verify`: passed — OK

## key decisions

- `obj/**` is build-intermediate state and must remain source-only.
- `bin/Release/Consuelo.Windows.Service.exe` is a required runtime platform adapter consumed by `bootstrap.ps1`.

## notes for ko

- This corrects the P1 from the exact-head Codex review on stream PR #1725.

## improvements noticed

- none yet

## Exact-head review discovery

- Evidence: Codex P1 on stream PR #1725 found that excluding `native/windows-service/bin/**` removes the service host built immediately before bundling.
- Bootstrap contract: `scripts/bootstrap.ps1` requires `native/windows-service/bin/Release/Consuelo.Windows.Service.exe` or the alternate `bin/windows` path.
- Test-first contract: change the bundle regression to require the built service host while still excluding `obj/**`; observe the focused failure before narrowing production classification.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-29 07:49:09 apply-patch: `.task/os/preserve-windows-service-host-after-runtime-bundle-review/workpad.md`
- 2026-07-29 07:49:34 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-29 07:49:54 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`

- 2026-07-29 07:50:19 apply-patch: `.task/os/preserve-windows-service-host-after-runtime-bundle-review/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/preserve-windows-service-host-after-runtime-bundle-review/current.json`, `.task/os/preserve-windows-service-host-after-runtime-bundle-review/session.json`, `.task/os/preserve-windows-service-host-after-runtime-bundle-review/verify.json`, `.task/os/preserve-windows-service-host-after-runtime-bundle-review/workpad.md`, `.task/tasks/os/preserve-windows-service-host-after-runtime-bundle-review.json`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
