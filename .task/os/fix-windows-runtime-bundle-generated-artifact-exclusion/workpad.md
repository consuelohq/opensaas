# fix windows runtime bundle generated artifact exclusion

branch: `task/os/fix-windows-runtime-bundle-generated-artifact-exclusion`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1724/fix-windows-runtime-bundle-generated-artifact-exclusion
github pr: https://github.com/consuelohq/opensaas/pull/1724
started: 2026-07-29

## acceptance criteria

- [x] Reproduce the exact main Windows bundle failure with a focused regression test.
- [x] Exclude generated .NET `obj/**` and `bin/**` products without excluding Windows service source files.
- [x] Build and verify a real Windows-labeled runtime archive locally.
- [x] Pass strict review and full task verification.
- [ ] Pass the Windows GitHub release job after main promotion.

## plan

1. Trace the failed main workflow to the runtime bundle source classifier.
2. Add a focused red test with the generated `FileListAbsolute.txt` artifact.
3. Add the narrow generated-directory classification boundary.
4. Run focused release tests, strict review, verification, and main publication.

## current status

- Focused fix, strict review, and full task verification are green; ready to publish.

## files changed

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Focused red: 19 pass, 1 fail on the production `FileListAbsolute.txt` error.
- Focused green: 20 pass, 126 assertions.
- Bundle and workflow tests: 28 pass, 250 assertions.
- Real Windows-labeled archive build and verification: valid, 415 files.
- Strict review: 0 blocking, changed, or pre-existing issues.
- Full verification: publish-valid; static rules, ESLint, typecheck, spec compliance, package registry gate, and DB guard passed.
- 2026-07-29 07:41:17 `review.run`: passed — OK
- 2026-07-29 07:41:30 `verify`: passed — OK
- 2026-07-29 07:41:49 `verify`: passed — OK

## key decisions

- Keep generated .NET output out through the content classifier so explicit inclusion also fails closed as source-only.
- Preserve `native/windows-service/Program.cs` and the `.csproj` as platform-adapter content.

## notes for ko

- The failing main publish was a deterministic source-boundary defect, not a credential or Cloudflare problem.

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

## Release failure discovery

- Evidence: main workflow 30431905257 failed in Windows runtime bundle build because native/windows-service/obj/x64/Release/Consuelo.Windows.Service.csproj.FileListAbsolute.txt contains machine-specific absolute paths.
- Scope: runtime bundle source selection and its focused regression tests only.
- Test-first contract: add a focused failing test proving generated native build directories are excluded while required native service sources remain included; then implement the smallest bundle-boundary fix.
- Red: `bun test packages/os/tests/distribution/runtime-bundle.test.ts` reproduced the main failure on `native/windows-service/obj/x64/Release/Consuelo.Windows.Service.csproj.FileListAbsolute.txt` (19 pass, 1 fail).
- Implementation: classify only `native/windows-service/obj/**` and `native/windows-service/bin/**` as source-only; required Windows service source and project files remain platform-adapter content.
- Green: the same focused suite passes (20 tests, 126 assertions).

- 2026-07-29 07:38:46 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-29 07:39:18 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`

- 2026-07-29 07:39:43 apply-patch: `.task/os/fix-windows-runtime-bundle-generated-artifact-exclusion/workpad.md`

- 2026-07-29 07:40:46 apply-patch: `.task/os/fix-windows-runtime-bundle-generated-artifact-exclusion/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-windows-runtime-bundle-generated-artifact-exclusion/current.json`, `.task/os/fix-windows-runtime-bundle-generated-artifact-exclusion/session.json`, `.task/os/fix-windows-runtime-bundle-generated-artifact-exclusion/verify.json`, `.task/os/fix-windows-runtime-bundle-generated-artifact-exclusion/workpad.md`, `.task/tasks/os/fix-windows-runtime-bundle-generated-artifact-exclusion.json`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
