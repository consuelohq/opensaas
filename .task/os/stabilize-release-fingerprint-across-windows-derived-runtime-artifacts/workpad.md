# stabilize release fingerprint across windows derived runtime artifacts

branch: `task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1727/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts
github pr: https://github.com/consuelohq/opensaas/pull/1727
started: 2026-07-29

## acceptance criteria

- [x] Preserve the planned cross-platform source fingerprint after the Windows service host is compiled.
- [x] Ship the exact Windows service executable required by bootstrap.
- [x] Exclude Windows `obj/**`, PDB, and other generated service intermediates from publication.
- [x] Keep the derived executable covered by the bundle ID, per-file digest, and archive digest.
- [x] Pass strict review and the stream verification gate.
- [ ] Merge through the OS stream and validate the exact main publication workflow.

## plan

1. Reproduce the failed main publication from its downloaded three-platform artifacts.
2. Add a failing regression that separates planned source identity from the derived Windows host.
3. Narrow bundle classification and fingerprinting without weakening archive integrity.
4. Run focused distribution tests, strict review, and stream verification.
5. Publish through the stream, gate the exact PR head, merge to main, and validate publication.

## current status

- Regression, implementation, strict review, and stream verification are green; publication remains.

## files changed

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files changed

- none

## workspace-owned: activity log

- Added a pre-build versus post-build Windows release fingerprint regression before changing production code.
- Classified all Windows service `bin/**` outputs as source-only except the exact required Release EXE.
- Excluded only the derived service EXE from release fingerprint identity while retaining it in the manifest and archive.

## workspace-owned: validation evidence

- Red: `bun test packages/os/tests/distribution/runtime-bundle.test.ts` failed because the generated PDB was included.
- Green: focused runtime bundle test passed, 20 tests and 134 expectations.
- Green: runtime bundle, publication preparer, and release workflow suites passed, 29 tests and 273 expectations.
- Green: strict review against `origin/stream/os` reported zero new issues and zero blockers.
- Green: workspace verify against `origin/stream/os` passed review, OS package selection, and DB guard with a publish-valid stamp.
- 2026-07-29 08:20:34 `review.run`: passed — OK
- 2026-07-29 08:20:47 `verify`: passed — OK
- 2026-07-29 08:21:05 `verify`: passed — OK

## key decisions

- The release fingerprint is the platform-neutral classified source identity; it must not change because a platform compiler emitted the required service host.
- The Windows EXE remains in `manifest.files`, so its per-file digest, bundle ID, and archive digest still fail closed on byte drift.
- PDB and `obj/**` outputs are build intermediates and are not customer runtime inputs.

## notes for ko

- The original main failure was isolated to final publication verification after all validators and all Darwin, Linux, and Windows builds passed; no signing or Cloudflare provider write had begun.

## improvements noticed

- none yet

## Release publication discovery

- Main run `30433706147` built and verified all three platform archives, then failed before signing or provider writes because the Windows archive fingerprint differed from the planned source fingerprint.
- Artifact evidence: darwin/linux fingerprint `sha256:7d6d...` with 415 files; Windows fingerprint `sha256:5454...` with 417 files.
- Windows-only files: required `Consuelo.Windows.Service.exe` and non-runtime `Consuelo.Windows.Service.pdb`; `obj/**` was correctly absent.
- Test-first contract: compute the planned source fingerprint before generated artifacts exist, then require the built Windows archive to preserve that fingerprint while including the executable and excluding PDB/obj intermediates.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-29 08:15:55 apply-patch: `.task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts/workpad.md`
- 2026-07-29 08:18:10 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-29 08:18:44 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-29 08:19:38 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-07-29 08:20:08 apply-patch: `.task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts/current.json`, `.task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts/session.json`, `.task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts/verify.json`, `.task/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts/workpad.md`, `.task/tasks/os/stabilize-release-fingerprint-across-windows-derived-runtime-artifacts.json`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
