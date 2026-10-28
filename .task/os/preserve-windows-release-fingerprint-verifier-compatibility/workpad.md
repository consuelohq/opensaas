# preserve Windows release fingerprint verifier compatibility

branch: `task/os/preserve-windows-release-fingerprint-verifier-compatibility`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1731/preserve-windows-release-fingerprint-verifier-compatibility
github pr: https://github.com/consuelohq/opensaas/pull/1731
started: 2026-07-29

## acceptance criteria

- [x] Keep runtime bundle policy v1 semantics unchanged for deployed verifiers.
- [x] Produce one deterministic Windows service host before release planning.
- [x] Use the exact same EXE bytes in Darwin, Linux, and Windows bundle inventories.
- [x] Keep PDB and `obj/**` intermediates excluded while preserving EXE digest/signature coverage.
- [x] Pass strict review and workspace verification.
- [ ] Prove the exact stream head with native Windows CI and main publication.

## plan

1. Reproduce the old-verifier rejection with a policy-v1 fingerprint helper.
2. Preserve policy v1 and move deterministic Windows host construction before planning.
3. Share the exact host artifact with every platform build.
4. Run focused updater, bundle, publication, channel, and workflow tests.
5. Pass strict review, merge through the stream, and validate the exact main release.

## compatibility discovery

- P1 source: Codex review on stream PR #1728 observed that deployed policy-v1 verifiers hash every manifest file, while the proposed Windows bundle keeps policy v1 but omits the EXE from its fingerprint.
- Security constraint: do not weaken bundle verification or silently redefine an existing policy version.
- Test-first contract: reproduce verification with the pre-change policy-v1 algorithm before implementing a transition.
- Decision pending: identify whether compatibility belongs in bundle layout, policy versioning, updater staging, or publication sequencing.

## current status

- Compatibility implementation, focused suites, strict review, and verification are green; publication remains.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`

## workspace-owned: files changed

- Added an independent policy-v1 fingerprint helper to protect deployed verifier semantics.
- Added a pre-plan Windows host build artifact and made plan plus all matrix builds consume it.
- Restored release fingerprints to cover every manifest file.

## workspace-owned: activity log

- Red: runtime-bundle test rejected the filtered fingerprint under legacy policy v1, and the workflow test found no pre-plan host job.
- Green: runtime bundle and release workflow suites passed, 28 tests and 263 expectations.
- Green: updater, runtime bundle, publication preparer, release channels, and workflow suites passed, 84 tests and 422 expectations.
- Green: Prettier check passed for the workflow, runtime implementation, and both focused tests.
- Green: strict review reported zero issues and zero blockers.
- Green: workspace verify passed with a publish-valid stamp.

## workspace-owned: validation evidence

- Policy v1 remains immutable: its fingerprint hashes every manifest file, including the required Windows EXE.
- A single within-run EXE artifact avoids cross-runner compiler divergence and gives all platform bundles the same fingerprint.
- The EXE remains in each bundle manifest and therefore remains covered by per-file SHA-256, bundle ID, archive digest, detached signature, and signed release consensus.
- Windows PDB and `obj/**` products remain source-only and are never uploaded as the shared artifact.
- 2026-07-29 08:42:47 `review.run`: passed — OK
- 2026-07-29 08:42:58 `verify`: passed — OK
- 2026-07-29 08:43:16 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

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

- 2026-07-29 08:34:55 apply-patch: `.task/os/preserve-windows-release-fingerprint-verifier-compatibility/workpad.md`
- 2026-07-29 08:38:49 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-29 08:38:49 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-07-29 08:39:46 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-29 08:39:46 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-07-29 08:40:48 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-07-29 08:42:22 apply-patch: `.task/os/preserve-windows-release-fingerprint-verifier-compatibility/workpad.md`

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-os-runtime-publish.yaml`, `.task/os/preserve-windows-release-fingerprint-verifier-compatibility/current.json`, `.task/os/preserve-windows-release-fingerprint-verifier-compatibility/session.json`, `.task/os/preserve-windows-release-fingerprint-verifier-compatibility/verify.json`, `.task/os/preserve-windows-release-fingerprint-verifier-compatibility/workpad.md`, `.task/tasks/os/preserve-windows-release-fingerprint-verifier-compatibility.json`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/tests/distribution/release-channel-workflows.test.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
