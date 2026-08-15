# Hotfix canary runtime missing diff-cockpit dependency

branch: `task/os/hotfix-canary-runtime-missing-diff-cockpit-dependency`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1904/hotfix-canary-runtime-missing-diff-cockpit-dependency
github pr: https://github.com/consuelohq/opensaas/pull/1904
started: 2026-08-13

## acceptance criteria

- [x] Reproduce the 0.1.32 activation failure from immutable runtime and service evidence.
- [x] Keep the OS runtime archive self-contained while preserving the Diff Cockpit source package as its authoring boundary.
- [x] Include the exact Diff Cockpit source bytes in both the release fingerprint and every platform archive.
- [x] Trigger OS runtime publication when Diff Cockpit source changes.
- [x] Prove the extracted production archive installs dependencies and imports `diffs-gateway.ts` without escaping the release root.
- [ ] Push the hotfix, merge it to main, publish/promote a signed canary, and update the local install forward.

## plan

1. Diagnose the failed activation from lifecycle and daemon logs.
2. Add a focused red test for the missing runtime closure.
3. Vendor the sibling source through the deterministic runtime builder and point runtime imports at the internal archive path.
4. Verify the focused suite plus an exact build/extract/install/import smoke.
5. Push, merge to main, publish/promote canary, then update and verify the installed bundle.

## current status

- Implementation and exact local archive smoke are green; ready to push.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/scripts/server/vendor/diff-cockpit.ts`
- `packages/os/tests/distribution/runtime-bundle-workspace-closure.test.ts`

## workspace-owned: files changed

- Same as files changed; task metadata/workpad are workspace-owned.

## workspace-owned: activity log

- Reproduced live failure: `Cannot find module '../../../../diff-cockpit/src/index'` from signed 0.1.32 archive.
- RED: focused closure test failed because `scripts/server/vendor/diff-cockpit.ts` was absent from the fingerprint.
- GREEN: focused closure + runtime bundle suite, 22 tests passed.
- Exact archive smoke: build and verify passed, vendored source byte comparison passed, frozen production dependency install passed, extracted `diffs-gateway.ts` import passed.
- Package syntax checks and `git diff --check` passed.

## workspace-owned: validation evidence

- Root Yarn workspaces intentionally exclude both `packages/os` and `packages/diff-cockpit`, while installed OS releases run standalone `bun install --frozen-lockfile --production`; a workspace protocol dependency would not materialize on customer machines.
- Use an explicit, fingerprinted vendored-source mapping. The repo shim preserves the authoring import; the archive replaces that path with the exact provider source.
- Keep the updater's automatic rollback behavior unchanged; this task fixes forward only.

## key decisions

- 0.1.32 was automatically rolled back by the failed lifecycle transaction. Current 0.1.27 is valid and connector-ready.

## notes for ko

- Add a generalized static audit for runtime imports that escape `packages/os` so future sibling imports fail before publication.

## improvements noticed

- Retention still reports a pre-existing digest mismatch for a previously modified 0.1.27 runtime file; it did not cause this activation failure.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Discovery — canary runtime dependency hotfix

- Live failure: 0.1.32 workers crash resolving `../../../../diff-cockpit/src/index` from `packages/os/scripts/server/services/diffs-gateway.ts`.
- Signed darwin-arm64 archive verified but omits the sibling `packages/diff-cockpit` runtime source.
- Safety: fix forward only; do not invoke rollback. Preserve other agents and keep this change isolated.
- Test-first contract: add a focused release-archive coverage test that fails when a runtime workspace dependency is omitted.

- 2026-08-13 17:04:01 apply-patch: `packages/os/tests/distribution/runtime-bundle-workspace-closure.test.ts`
- 2026-08-13 17:04:56 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-08-13 17:04:56 apply-patch: `packages/os/scripts/build-runtime-bundle.ts`
- 2026-08-13 17:04:56 apply-patch: `packages/os/scripts/server/services/diffs-gateway.ts`
- 2026-08-13 17:04:56 apply-patch: `packages/os/scripts/server/vendor/diff-cockpit.ts`
- 2026-08-13 17:04:56 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-08-13 17:05:29 apply-patch: `packages/os/tests/distribution/runtime-bundle-workspace-closure.test.ts`

- 2026-08-13 17:07:15 apply-patch: `.task/os/hotfix-canary-runtime-missing-diff-cockpit-dependency/workpad.md`