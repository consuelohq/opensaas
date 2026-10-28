# fix cross-platform release fingerprint parity

branch: `task/os-distribution/fix-cross-platform-release-fingerprint-parity`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1632
started: 2026-07-24

## goal

Make the version-neutral runtime release fingerprint deterministic across macOS, Linux, and Windows so one planned release can verify all three independently built archives.

## acceptance criteria

- [x] Reproduce the live Windows fingerprint mismatch with a focused deterministic test.
- [x] Identify every platform-dependent input to `releaseFingerprint`.
- [x] Normalize source closure content and modes without weakening bundle byte verification.
- [x] Preserve platform-specific archive IDs and manifests while requiring one shared release fingerprint.
- [x] Runtime bundle, publication preparation, release workflow, and full distribution tests pass.
- [x] Full task verify passes.
- [ ] Merge through the distribution stream to `main` without manually requesting/retrying external reviews.
- [ ] Observe a successful live `Consuelo OS runtime publish` and verify tag, release, R2 state/channel objects, signatures, and dev deployment.
- [ ] Sync distribution, provider, and web streams to final main.

## live failure

- Workflow run: `30074430404`.
- Planning succeeded with version `0.1.0` and fingerprint `sha256:ab760cbc01268a64d55cf69edc6b175c3878939c6ba5885b3563e46d3380fa22`.
- `darwin-arm64`, `linux-x64`, and `windows-x64` builds all passed their individual bundle verification.
- Publication preparation rejected `windows-x64`: `runtime bundle release fingerprint mismatch for windows-x64`.
- Therefore archive integrity is intact, but the version-neutral closure fingerprint contains a Windows-dependent representation.

## test-first contract

Before production edits, add a focused regression that computes the same logical source closure using POSIX-style and Windows-style path representations and proves the release fingerprint must be identical. The test must fail on current code.

The fix may normalize path separators and canonical text bytes used by the version-neutral fingerprint, but must not:

- replace archive digest verification;
- make platform-specific bundle IDs identical;
- ignore file contents, modes, roles, or customer/operator classification;
- remove required-platform verification from publication preparation.

## plan

1. Read fingerprint construction, runtime manifest generation, archive assembly, and publication verification.
2. Add the smallest failing cross-platform parity contract.
3. Patch canonical fingerprint input only.
4. Run focused runtime/publication tests, full distribution suite, typecheck, and task verify.
5. Merge to main and follow the live release through immutable publication.

## constraints

- Do not manually request or retry external AI reviews.
- Do not reuse or mutate prior failed run artifacts as authoritative release state.
- Do not alter Ko's Macs.

## files changed

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

## issues and recovery

- Initial search exceeded the facade's 200-result cap; retried once with the supported bound.

## root cause and correction

- The release fingerprint included raw host filesystem permission bits and raw text bytes.
- Windows checkout reports non-POSIX file modes and may materialize CRLF, so the same logical source closure produced a different file inventory and fingerprint.
- Runtime source text is now canonicalized to LF before digesting and archiving.
- File modes are now derived from portable executable intent: shebang files are `0755`; all other source files are `0644`.
- Archive verification still checks every canonical byte, digest, size, path, role, and mode. Platform bundle IDs and archive digests remain independent.

## test-first and validation evidence

- RED: the new POSIX-vs-Windows representation test produced distinct release fingerprints.
- GREEN: the parity test passed after canonical content/mode normalization.
- GREEN: runtime bundle and publication preparation suites passed 19/19.
- GREEN: full distribution suite passed 74 tests with 7 existing TODO contracts.
- GREEN: OS typecheck/syntax gate passed.
- GREEN: workflow security guard returned zero findings.
- GREEN: full task verify passed in publish-valid mode with static rules, ESLint, typecheck, spec compliance, and DB safety clean.

- 2026-07-24 07:11:37 write: `.task/os-distribution/fix-cross-platform-release-fingerprint-parity/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 07:11:37 fs.write: `.task/os-distribution/fix-cross-platform-release-fingerprint-parity/workpad.md`

- 2026-07-24 07:13:02 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-24 07:13:20 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`

## workspace-owned: files read

- none yet

- 2026-07-24 07:14:06 apply-patch: `.task/os-distribution/fix-cross-platform-release-fingerprint-parity/workpad.md`

## workspace-owned: validation evidence

- 2026-07-24 07:14:26 `verify`: passed — OK

- 2026-07-24 07:14:32 apply-patch: `.task/os-distribution/fix-cross-platform-release-fingerprint-parity/workpad.md`