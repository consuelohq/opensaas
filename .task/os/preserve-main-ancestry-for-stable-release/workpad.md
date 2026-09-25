# preserve main ancestry for stable release

branch: `task/os/preserve-main-ancestry-for-stable-release`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2587
started: 2026-09-25

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

behavior under test: make current main a real ancestor of stream/os while preserving only the already-validated optional experimental macOS service-host release patch.
existing local pattern: packages/os/tests/distribution/release-channel-workflows.test.ts passed 8/8 with 161 assertions after the prior conflict resolution.
new or changed tests: none; preserve the validated workflow/test files during the ancestry merge and rerun the focused contract.
focused validation command: bun test packages/os/tests/distribution/release-channel-workflows.test.ts
expected result: 8 pass, 0 fail; tree diff vs main remains only the approved workflow/test patch plus task metadata.
no-test waiver: ancestry-only reconciliation; existing regression is rerun.

- 2026-09-25 17:43:01 append: `.task/os/preserve-main-ancestry-for-stable-release/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-25 17:43:01 fs.write: `.task/os/preserve-main-ancestry-for-stable-release/workpad.md`

## workspace-owned: validation evidence

- 2026-09-25 17:43:22 `review.run`: passed — OK
- 2026-09-25 17:43:30 `verify`: passed — OK
