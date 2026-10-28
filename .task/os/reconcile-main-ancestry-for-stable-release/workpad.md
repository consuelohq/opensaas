# reconcile main ancestry for stable release

branch: `task/os/reconcile-main-ancestry-for-stable-release`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2586
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

behavior under test: preserve current main exactly while retaining the already-validated optional experimental macOS service-host release gate on stream/os.
existing local pattern: focused contract is packages/os/tests/distribution/release-channel-workflows.test.ts; it passed 8/8 with 161 assertions before ancestry reconciliation.
new or changed tests: none in this ancestry-only reconciliation; preserve the validated test file from stream when resolving its conflict.
focused validation command: bun test packages/os/tests/distribution/release-channel-workflows.test.ts
expected result: 8 pass, 0 fail after merge resolution.
no-test waiver: ancestry reconciliation introduces no new behavior; existing focused regression is rerun after conflict resolution.

- 2026-09-25 17:37:18 append: `.task/os/reconcile-main-ancestry-for-stable-release/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-25 17:37:18 fs.write: `.task/os/reconcile-main-ancestry-for-stable-release/workpad.md`
- 2026-09-25 17:39:01 fs.write: `.task/os/reconcile-main-ancestry-for-stable-release/workpad.md`

## workspace-owned: validation evidence

- 2026-09-25 17:38:26 `review.run`: passed — OK
- 2026-09-25 17:38:43 `review.run`: passed — OK
- 2026-09-25 17:38:50 `verify`: passed — OK

## Reconciliation result

Resolved the two content conflicts by retaining the already-validated optional macOS service-host workflow/test patch while accepting all other current main changes. Merge commit `5dbbbebb21a1e048d5467750b042162435a14759` has `d6205fbad1cb1c20d3c980763ce3dc07d63e5acc` as its second parent. After commit, strict review passed with 0 blockers and full verify passed with `publishValid: true`; diff vs main is exactly the two approved production/test files plus prior task metadata.

- 2026-09-25 17:39:01 append: `.task/os/reconcile-main-ancestry-for-stable-release/workpad.md`
