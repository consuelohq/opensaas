# Fix Windows release CLI harness

branch: `task/os/fix-windows-release-cli-harness`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2261
started: 2026-08-29

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

- [ ] Release-channel CLI tests resolve a native Bun executable on Windows and POSIX.
- [ ] Child test environment retains only the platform runtime variables needed to launch Bun while excluding all release-provider credentials.
- [ ] Spawn failures surface the underlying `spawnSync` error rather than only `status: null`.
- [ ] Existing release-channel CLI behavior remains unchanged; this is a test-harness-only fix.
- [ ] Windows native distribution CI passes on stream PR #2255 before canary release resumes.

## Test-first contract

behavior under test: `release-channels-cli.test.ts` must launch the Bun CLI subprocess cross-platform, especially on Windows runners, without inheriting release signing/provider credentials.
existing local pattern: `lifecycle-command.test.ts` resolves Bun using `where.exe` on Windows and `which` elsewhere; current release CLI harness uses POSIX-only `which` plus `PATH=/usr/bin:/bin`.
new or changed tests: update the existing credential-isolation test to assert platform runtime environment is preserved and release credential keys are absent; helper must throw with `spawnSync` error when process launch fails.
focused red evidence: GitHub run 33223848234 job 99023401949 on Windows: 3 failures in `release-channels-cli.test.ts`, all `result.exitCode === null`; Windows service build and acceptance passed. Root cause is the harness using `which bun` and POSIX-only PATH on Windows.
expected red failure: on Windows the resolved Bun path is not a native Windows path and child launch fails before the CLI can return its intended 0/1 exit code.
no-test waiver: not applicable; the existing Windows CI failure is the cross-platform red proof and local tests will prove unchanged semantics.

- 2026-08-29 00:40:31 append: `.task/os/fix-windows-release-cli-harness/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 00:40:31 fs.write: `.task/os/fix-windows-release-cli-harness/workpad.md`
- 2026-08-29 00:41:13 fs.write: `.task/os/fix-windows-release-cli-harness/workpad.md`
- 2026-08-29 00:42:10 fs.write: `.task/os/fix-windows-release-cli-harness/workpad.md`

## implementation

- `release-channels-cli.test.ts` now resolves Bun with `where.exe` on Windows and `which` on POSIX, taking the first native executable path.
- The child environment preserves an explicit allowlist of platform runtime variables (`PATH`, temp/home/user/profile, Windows SystemRoot/ComSpec/PATHEXT variants) instead of hardcoding `/usr/bin:/bin`.
- Release-provider/signing credential keys remain excluded and are still asserted absent.
- `runCli` throws the underlying `spawnSync` error when process creation fails, so future launch failures are diagnostic rather than `exitCode: null`.

## validation evidence

- Focused CLI harness: 7/7 passed.
- Related release-channel contracts: 4 files / 49 tests passed.
- Production/runtime files changed: none.

- 2026-08-29 00:41:13 append: `.task/os/fix-windows-release-cli-harness/workpad.md`

## workspace-owned: validation evidence

- Focused CLI harness: 7/7 passed.
- Related release-channel contracts: 4 files / 49 tests passed.
- Production/runtime files changed: none.
- 2026-08-29 00:41:13 append: `.task/os/fix-windows-release-cli-harness/workpad.md`
- 2026-08-29 00:41:46 `review.run`: passed — OK
- 2026-08-29 00:42:04 `verify`: passed — OK

## current status

- [x] Windows CI failure diagnosed as test harness process-launch portability bug.
- [x] Local focused harness 7/7 and related release-channel contracts 49/49.
- [x] Strict review: 0 findings / 0 blockers.
- [x] Full verify: passed=true, publishValid=true.
- [ ] Push PR #2261 and promote into `stream/os` / PR #2255.
- [ ] Confirm fresh Windows CI is green, then resume canary release.

- 2026-08-29 00:42:10 append: `.task/os/fix-windows-release-cli-harness/workpad.md`
