# fix installer daemon tests on linux ci

branch: `task/os/fix-installer-daemon-tests-on-linux-ci`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2519
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

- [x] Linux CI can exercise install-system-daemons.sh dry-run behavior without requiring macOS plutil.
- [x] Real macOS installs continue to use /usr/bin/plutil semantics for plist mutation.
- [x] Existing installer runtime dependency assertions for portless, connectors, heartbeat, and flattened Consuelo home remain green locally; Linux CI will exercise the fallback after promotion.
- [x] Focused installer-runtime-dependencies suite, strict review, and full verify pass before promotion.

## plan

1. Inspect install-system-daemons.sh plist mutation paths and the failing installer runtime dependency tests.
2. Reproduce the Linux-equivalent failure locally with plutil unavailable.
3. Add the smallest portability seam that preserves macOS production behavior and lets dry-run/test paths operate cross-platform.
4. Run focused GREEN, review, verify, promote to stream/os, then resume #2499 release.

## progress

- CI RED: Ubuntu verify exited 127 at install-system-daemons.sh plutil lint in the existing runtime-dependency suite.
- Added a portable plist validation seam: prefer /usr/bin/plutil on macOS, otherwise plutil on PATH, otherwise Python stdlib plistlib.
- Focused GREEN: installer-runtime-dependencies.test.ts passes 24/24 on the Mac path.
- Strict review: 0 task issues and 0 blockers.
- Full verify: passed and publish-valid.

## Test-first contract

behavior under test: install-system-daemons.sh dry-run/listing behavior must not fail merely because plutil is unavailable on non-macOS CI, while actual plist mutation on macOS still uses plutil.
existing local pattern: packages/os/tests/installer-runtime-dependencies.test.ts spawns the public installer scripts in controlled temporary homes and asserts exit status/output.
new or changed tests: extend the existing test seam only if needed to make the non-macOS contract explicit; the current failing tests already reproduce the regression.
focused red command: bun --cwd packages/os test tests/installer-runtime-dependencies.test.ts
expected red failure: daemon dry-run/listing cases exit 127 at install-system-daemons.sh plutil invocation on Linux.
no-test waiver: not applicable.

- 2026-09-21 15:50:44 append: `.task/os/fix-installer-daemon-tests-on-linux-ci/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 15:50:44 fs.write: `.task/os/fix-installer-daemon-tests-on-linux-ci/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-09-21 15:52:12 apply-patch: `packages/os/scripts/install-system-daemons.sh`

## workspace-owned: validation evidence

- 2026-09-21 15:53:04 `review.run`: passed — OK
- 2026-09-21 15:53:46 `verify`: passed — OK

- 2026-09-21 15:53:59 apply-patch: `.task/os/fix-installer-daemon-tests-on-linux-ci/workpad.md`