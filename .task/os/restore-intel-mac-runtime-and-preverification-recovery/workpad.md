# restore intel mac runtime and preverification recovery

branch: `task/os/restore-intel-mac-runtime-and-preverification-recovery`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2426
started: 2026-09-09

## acceptance criteria

- [ ] New OS publications include a signed `darwin-x64` runtime bundle alongside `darwin-arm64`, `linux-x64`, and `windows-x64`.
- [ ] Historical three-platform releases remain internally verifiable and rollbackable; only new publications require the four-platform set.
- [ ] The runtime-publish workflow uses an Intel GitHub-hosted macOS runner and passes the Intel archive into publication/signing.
- [ ] An Intel Mac no longer fails bootstrap with `release does not publish darwin-x64` once the new canary is promoted.
- [ ] Bootstrap verifies the signed runtime before writing Consuelo-managed Bun/Caddy/cloudflared/install identity state, and prepares the recovery CLI before those managed dependencies are persisted.
- [ ] Focused distribution and installer tests, strict review, and full verify pass before promotion through `stream/os` and `main`.

## plan

1. Add RED contracts for four-platform new publication/workflow behavior and for pre-verification bootstrap ordering.
2. Update the release-set default, publish matrix, archive assembly, docs, and fixtures while preserving historical release consensus semantics.
3. Reorder bootstrap so signed runtime verification and recovery preparation precede managed binary/install-state persistence; keep external Bun prerequisite behavior unchanged.
4. Run focused GREEN tests, self-review the diff, then review/verify and promote through the task workflow.
5. After merge, publish the new dev runtime, promote the exact release to canary, refresh the hosted bootstrap if needed, verify live `darwin-x64`, clean the failed test residue on the Intel Mac, and retry the fresh install. Stable remains a separate approval boundary.

## Test-first contract

behavior under test: new signed releases require and publish `darwin-x64`; old three-platform release records remain valid; bootstrap release verification runs before `ensure_named_bun_runtime`, `ensure_install_id`, `ensure_portless`, `ensure_caddy`, and `ensure_cloudflared`, and recovery CLI preparation occurs before those managed writes.
existing local pattern: `release-channel-workflows.test.ts` statically owns the publish matrix, `release-publication-preparer.test.ts` and `release-channels.test.ts` own coherent platform-set publication, and `installer-runtime-dependencies.test.ts` owns bootstrap ordering contracts.
new or changed tests: extend those four suites with Intel platform coverage, historical three-platform consensus/rollback coverage, Intel runner/archive assertions, and strict bootstrap ordering assertions.
focused red command: `bun --cwd packages/os test tests/distribution/release-channel-workflows.test.ts tests/distribution/release-publication-preparer.test.ts tests/distribution/release-channels.test.ts tests/installer-runtime-dependencies.test.ts`
expected red failure: current workflow/publication omits `darwin-x64`; default required set accepts only three platforms; bootstrap calls named Bun/install ID/Caddy/cloudflared before `install_verified_runtime` and before `prepare_recovery_cli`.
no-test waiver: not applicable.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/docs/distribution/release-channels.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/tests/bootstrap-recovery-cli.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/distribution/release-channels.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`


## key decisions

- Do not reinterpret Intel Macs as ARM/Rosetta and do not weaken signed release verification. Publish a native `darwin-x64` runtime.
- Preserve historical release records by applying the expanded platform requirement only to new publication; `verifyReleaseStateConsensus` continues validating each immutable release against its own signed inventory.
- Treat the user-observed pre-verifier Caddy/cloudflared writes as part of this installer reliability regression rather than a separate cleanup implementation.

## notes for ko

- Live canary at diagnosis is v0.1.108 revision 194 and publishes only Darwin ARM64, Linux x64, and Windows x64.
- The Intel Mac correctly reports Bun `macOS x64`; the verifier error is accurate.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-09 17:45:12 write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-09 17:45:12 fs.write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`
- 2026-09-09 17:46:19 fs.write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`
- 2026-09-09 17:49:57 fs.write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/read-log.json`
- 2026-09-09 17:50:15 fs.write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`
- 2026-09-09 17:55:44 fs.write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`
- 2026-09-10 00:04:53 fs.write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/docs/distribution/release-channels.md`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/bootstrap-recovery-cli.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- `packages/workspace/scripts/github.js`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/senior-engineer.md`

## RED evidence

- Focused release workflow contract fails because `.github/workflows/consuelo-os-runtime-publish.yaml` contains no `darwin-x64` archive/job.
- Release-channel contract fails because `DEFAULT_REQUIRED_RELEASE_PLATFORMS` is still `[darwin-arm64, linux-x64, windows-x64]`.
- New bootstrap ordering contract fails with `ensure_named_bun_runtime` before `prepare_recovery_cli` (`291` vs `465` within `main`).
- Historical three-platform consensus regression already passes when publication explicitly supplies the legacy required-platform list, confirming the migration can preserve old signed releases without weakening new publication.
- `release-publication-preparer.test.ts` passes with a four-archive fixture because the preparer is already platform-generic; the production gap is the workflow and default release requirement, not the signing/assembly primitive.
- The full `installer-runtime-dependencies.test.ts` file currently has unrelated pre-existing fixture failures around fake Bun install-id generation and daemon dry-runs. Subsequent focused evidence for this task uses the new ordering test (`-t 'verify the signed runtime'`) plus the distribution suites; full verify remains the final authority.

- 2026-09-09 17:46:19 append: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`

- 2026-09-09 17:48:12 apply-patch: `packages/os/scripts/lib/distribution/release-channels.ts`
- 2026-09-09 17:48:12 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-09-09 17:48:12 apply-patch: `packages/os/docs/distribution/release-channels.md`
- 2026-09-09 17:48:16 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-09 17:48:30 apply-patch: `.github/workflows/consuelo-os-distribution-environments.yaml`

## workspace-owned: validation evidence

- 2026-09-09 17:49:22 `review.run`: passed — OK
- 2026-09-09 17:49:44 apply-patch: `packages/os/tests/distribution/workflow-contract.test.ts`
- 2026-09-09 17:49:57 write: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/read-log.json`
- 2026-09-09 17:51:40 `verify`: failed — COMMAND_FAILED

## GREEN evidence

- `release-channel-workflows.test.ts`, `release-channels.test.ts`, `release-publication-preparer.test.ts`, and `workflow-contract.test.ts`: 35/35 passed.
- New bootstrap ordering contract: 1/1 passed (`23` unrelated tests skipped by filter).
- `bash -n packages/os/scripts/bootstrap.sh`: passed.
- `packages/workspace/tests/github-workflow-policy.test.js`: 12/12 passed.
- Strict no-test review: 0 current issues, 0 pre-existing issues.
- GitHub hosted-runner reference verified `macos-15-intel` is a supported standard Intel/x64 runner as of 2026-09-09.
- Task `read-log.json` was repaired after concurrent automatic read logging produced NUL-padded binary content; the repaired file is valid UTF-8 JSON.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/docs/distribution/release-channels.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/distribution/release-channels.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

## acceptance progress

- [x] New publication contract requires and builds `darwin-x64` with the other three platforms.
- [x] Historical three-platform release consensus remains verifiable when using its original signed inventory.
- [x] Runtime publish and native distribution workflows include an Intel GitHub-hosted macOS runner.
- [x] Bootstrap verification/dependency/recovery ordering precedes managed Bun/install-ID/Caddy/cloudflared persistence.
- [ ] Full task verify and promotion through `stream/os` / `main`.
- [ ] Live canary contains `darwin-x64`, hosted bootstrap is current, and the Intel fresh-install retry passes the verifier boundary.

- 2026-09-09 17:50:15 append: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`

- 2026-09-09 17:53:51 apply-patch: `packages/os/tests/bootstrap-recovery-cli.test.ts`

## formal verify blocker

- Formal `verify` review and DB guards pass, but the registry `@consuelo/os package test` makes the stamp non-publish-valid because the current synchronized OS branch has unrelated package-wide failures.
- The one verify-selected failure caused by this task was `bootstrap-recovery-cli.test.ts` still asserting the old ordering; its contract was updated and now passes 2/2.
- Fresh package-wide baseline after that fix: 12 test files fail / 360 pass / 16 skip; 15 tests fail / 3291 pass / 151 skip / 7 todo. Unrelated examples include `doctor-redaction`, memory/replica tests, workspace-edge seed/write-budget, lifecycle-help's invalid `toStartWith` matcher, skill-migration parity, and existing installer fixture failures already observed during RED before production edits.
- Current lockfile intentionally specifies Vitest 4.1.5, so this is not dependency drift.
- No approved verify bypass has been used. Task changes remain local/unpublished pending Ko approval or separate repair of the existing package-wide failures.

- 2026-09-09 17:55:44 append: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`

## publish approval

- 2026-09-09: Ko explicitly approved publishing this task despite the known unrelated pre-existing `@consuelo/os` package-test failures that make the full verify stamp non-publish-valid.
- This approval applies only to the existing baseline failures already separated from this task's green release/recovery contracts. It does not waive task-specific failures, merge conflicts, or live canary verification.
- Publish target: task -> `stream/os` -> `main` -> exact new canary release. Stable is not approved.

- 2026-09-10 00:04:53 append: `.task/os/restore-intel-mac-runtime-and-preverification-recovery/workpad.md`
