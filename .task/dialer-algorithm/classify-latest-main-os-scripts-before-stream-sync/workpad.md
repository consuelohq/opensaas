# classify latest main OS scripts before stream sync

branch: `task/dialer-algorithm/classify-latest-main-os-scripts-before-stream-sync`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2093/classify-latest-main-os-scripts-before-stream-sync
github pr: https://github.com/consuelohq/opensaas/pull/2093
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 20:13:06 fs.write: `.task/dialer-algorithm/classify-latest-main-os-scripts-before-stream-sync/workpad.md`
- 2026-08-15 20:18:28 fs.write: `.task/dialer-algorithm/classify-latest-main-os-scripts-before-stream-sync/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 20:14:57 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-15 20:18:10 `review.run`: passed — OK
- 2026-08-15 20:18:10 `review.run`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: before `stream.sync` can validate the real combined tree, the Dialer stream's parity baseline must contain classifications for the three OS scripts that exist on current `main` and are absent from the remote stream baseline.
existing local pattern: baseline entries are explicit per script; new OS-only paths use `os-only-needs-review` unless a reviewed intentional classification already exists.
new or changed tests: no product behavior test. Use a deterministic cross-ref check against `origin/main` plus the existing parity audit during `stream.sync`.
focused red command: compare the three current-main script paths against `packages/os/tests/audit/fixtures/script-parity-classifications.json` in this stream task.
expected red failure: all three paths exist on `origin/main` and are missing from the stream baseline.
no-test waiver: not applicable; this task has a deterministic metadata contract and `stream.sync` supplies the combined-tree parity test.

## Acceptance criteria

- Verify all three paths exist on current main and have no workspace counterpart at the same relative path.
- Add exactly three conservative baseline classifications; no production source changes.
- Cross-ref check goes green in the task.
- Promote into the remote stream.
- Rerun `stream.sync`; combined-tree parity must pass before the sync is pushed.

- 2026-08-15 20:13:06 append: `.task/dialer-algorithm/classify-latest-main-os-scripts-before-stream-sync/workpad.md`

- 2026-08-15 20:14:31 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`

## Final validation before promotion

- RED cross-ref: all three current-main OS scripts existed on `origin/main`, had no same-path `packages/workspace` counterpart, and were absent from the remote stream baseline.
- Added exactly three `os-only-needs-review` entries; no production source changed.
- GREEN cross-ref: all three still exist on current main, have no Workspace counterpart, and resolve to the conservative classification.
- JSON parse validation passed; baseline schemaVersion remains 1 and now contains 499 entries.
- `git.diff` shows only +12 lines in `packages/os/tests/audit/fixtures/script-parity-classifications.json` outside task metadata.
- `checkFiles` is not applicable to this JSON fixture: it invoked `node --check` and failed on valid JSON syntax (`"schemaVersion": 1`). JSON.parse is the appropriate syntax validation and passed.
- Strict review against `origin/stream/dialer-algorithm`: 0 owned issues, 0 blockers. The review reused cached project findings and reported no owned source files; deterministic JSON/cross-ref + diff evidence is primary for this metadata-only task.
- Do not expect standalone remote-stream parity to pass before main is merged, because these three classified scripts live on current main. The authoritative next gate is first-class `stream.sync`, which constructs the combined tree and runs verify before pushing.

- 2026-08-15 20:18:28 append: `.task/dialer-algorithm/classify-latest-main-os-scripts-before-stream-sync/workpad.md`
