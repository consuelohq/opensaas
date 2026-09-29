# fix bootstrap dry runs on linux ci

branch: `task/os/fix-bootstrap-dry-runs-on-linux-ci`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2520
started: 2026-09-21

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

## acceptance criteria

- [x] Bootstrap planning/dry-run/source-validation paths run on Linux-equivalent execution without weakening the real-install macOS guard.
- [x] Non-dry-run bootstrap on unsupported platforms still fails closed with the existing macOS-only message.
- [x] The installer-runtime dependency suite passes under the Linux platform shim as well as on macOS.
- [x] The prior portable plist-lint fix remains present on the task base.
- [x] Strict review and full verify pass before promotion; PR #2499 will be rechecked after promotion.

## plan

1. Confirm the latest stream base includes the plist portability fix and inspect bootstrap argument/platform-check order.
2. Use the existing GitHub Ubuntu failure as RED; add or use a deterministic platform seam locally if the script already supports one.
3. Move/narrow the platform guard so dry-run/source-validation remains cross-platform while real installation remains macOS-only.
4. Run focused installer tests, strict review, and full verify.
5. Promote to stream/os, let PR #2499 rerun, then continue release.

## progress

- Added a deterministic Linux uname shim contract. RED reproduced the exact premature platform-guard failure.
- Narrowed the macOS platform guard: non-Darwin dry-runs may plan/validate; non-dry-run installs still fail closed.
- Focused GREEN: installer-runtime-dependencies.test.ts passes 25/25.
- Strict review: 0 task issues, 0 blockers.
- Full verify: passed, publish-valid.

## Test-first contract

behavior under test: bootstrap dry-run and source-validation behavior is platform-neutral, but a real local bootstrap still only executes on macOS.
existing local pattern: packages/os/tests/installer-runtime-dependencies.test.ts spawns the public bootstrap script and asserts dry-run/source-validation/optional-portless behavior.
new or changed tests: add an explicit unsupported-platform dry-run vs real-install contract if no deterministic platform seam exists.
focused red evidence: GitHub Consuelo / verify run 35622101014 failed the package suite on Ubuntu because bootstrap exited early with "currently supports macOS. Detected: Linux."
expected red failure: dry-run/source validation is preempted by the platform guard, causing status 1 and the wrong stderr before the intended assertions.
no-test waiver: not applicable.

- 2026-09-21 16:02:09 append: `.task/os/fix-bootstrap-dry-runs-on-linux-ci/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 16:02:09 fs.write: `.task/os/fix-bootstrap-dry-runs-on-linux-ci/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-09-21 16:04:12 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`

## workspace-owned: validation evidence

- 2026-09-21 16:04:34 `review.run`: passed — OK
- 2026-09-21 16:05:15 `verify`: passed — OK

- 2026-09-21 16:05:24 apply-patch: `.task/os/fix-bootstrap-dry-runs-on-linux-ci/workpad.md`