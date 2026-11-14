# Repair cancelled macOS ARM64 runner for OS runtime publication

branch: `task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2805
started: 2026-11-14

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

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
## Test-first contract

behavior under test: OS release ARM64 build and optional macOS packaging use the same validated arm64 runner as the green distribution environment, not retired macos-14.

existing local pattern: packages/os/tests/distribution/release-channel-workflows.test.ts parses YAML and checks each release job, dependencies, permissions and artifacts.

new or changed tests: assertion for all macOS arm64 release job matrix rows (build, macos-service-host, macos-menu-app) to equal the passing distribution gate native-macos runner (macos-26).

focused red command: bun --cwd packages/os test tests/distribution/release-channel-workflows.test.ts
expected red failure: old macos-14 label mismatches macos-26, and darwin-arm64 job is cancelled before runner allocation.
no-test waiver: none.

## Plan

1. Add focused failing test, verify red.
2. Change only three macos-14 matrix runner labels in consuelo-os-runtime-publish.yaml to macos-26; preserve Intel, Linux, Windows, conditions, permissions, signing and platform matrix.
3. Run tests and workflow guard, review and full OS verify.
4. Publish isolated task PR #2805 targeting main (stream/os diverged), merge only through formal checks.
5. Resume exact merged SHA runtime publication and canary, with signed Darwin ARM64 artifact required and local lifecycle verification.

## Evidence

- PR #2803 merged main exact SHA 06401babd5b6687499f8401e37eda67880b8ded2; Production Release succeeded.
- OS publish run #43554874868 repeated cancellation of Build darwin-arm64 without any runner assigned, timestamps both 2026-11-14T04:10:53Z. Same in prior #2802 runtime run. All other distribution matrix validation succeeded.
- Green native macOS validation workflow runs on macos-26. OS runtime publish workflow still requests macos-14 for arm64 build and optional packaging.
- Previous release worker release-8b12ebc10de5baccd63a4687 remains tied to old SHA and cannot succeed without required arm64 build. Never claim live until full exact-source publish and canary passes.

- 2026-11-14 04:13:26 append: `.task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-14 04:13:26 fs.write: `.task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication/workpad.md`
- 2026-11-14 04:13:37 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-11-14 04:13:49 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-11-14 04:14:07 fs.write: `.task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication/workpad.md`
- 2026-11-14 04:14:30 fs.write: `.task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication/workpad.md`

## Test-first implementation evidence

- Before edit: focused release-workflow contract RED (1 failed, 8 pass): active build ARM64 runner macos-14 instead of validated macos-26.
- Production change: exactly three ARM64 runner labels in .github/workflows/consuelo-os-runtime-publish.yaml switched to macos-26, covering release build and both optional signing paths; no changes to job conditions, permissions, artifacts, Intel, Linux or Windows lanes.
- After edit: focused release-channel-workflows.test.ts GREEN (9/9); bun run typecheck GREEN.
- git.diff confirmed only workflow YAML, focused test and scoped task metadata, 3 production lines changed.
- Goal is to replace a GitHub-scheduled job that was canceled at enqueue (no runner allocated), not to skip it or alter supported release platform requirements.

- 2026-11-14 04:14:07 append: `.task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication/workpad.md`

## workspace-owned: validation evidence

- 2026-11-14 04:14:20 `review.run`: passed — OK
- 2026-11-14 04:14:57 `verify`: passed — OK

## Formal verification wait plan

Wait reason: formal OS verify worker PID 24798 is running full release workflow checks; publish-valid stamp needed before GitHub task.push.
Duration: bounded 20s polling.
Resume action: OS tool verify with taskSession tsk_b2c4b1047846, base origin/main.
Expected signal: passed true, publishValid true, stamp written, no failed suites.
Fallback: inspect exact test-selection failure and fix, do not merge if verification fails.

- 2026-11-14 04:14:30 append: `.task/os/repair-cancelled-macos-arm64-runner-for-os-runtime-publication/workpad.md`
