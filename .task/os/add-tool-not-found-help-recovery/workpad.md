# add tool not found help recovery

branch: `task/os/add-tool-not-found-help-recovery`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/629/add-tool-not-found-help-recovery
github pr: https://github.com/consuelohq/opensaas/pull/629
started: 2026-05-28

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

- 2026-05-28 23:05:57 fs.write: `.task/os/add-tool-not-found-help-recovery/workpad.md`
- 2026-05-28 23:12:29 fs.write: `.task/os/add-tool-not-found-help-recovery/workpad.md`

## workspace-owned: validation evidence

- 2026-05-28 23:12:06 `review.run`: passed — OK
- 2026-05-28 23:12:11 `verify`: failed — COMMAND_FAILED

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

## Ko approval

Approved scope: add tool-not-found help recovery, keep `NOT_FOUND`, steer agents toward actual `--help` commands rather than adding `tools.list`, and test/fix representative help flags.

- 2026-05-28 23:05:57 append: `.task/os/add-tool-not-found-help-recovery/workpad.md`

## implementation

- Added compact `NOT_FOUND` recovery data for unknown workspace facade tool names.
- Kept `NOT_FOUND` as an error; no `tools.list` tool was added.
- Added `workspace <tool-or-family> --help` recovery output backed by the canonical tool manifest.
- Updated workspace and OS steering to say manifest-first, then relevant `workspace ... --help`; do not guess tool names.
- Added focused `not-found-recovery.test.ts` instead of modifying the snapshot-heavy facade test file.

## representative help evidence

- `bun --cwd packages/workspace workspace --help`: passed.
- `bun --cwd packages/workspace workspace browser --help`: passed.
- `bun --cwd packages/workspace workspace task --help`: passed.
- `bun --cwd packages/workspace workspace stream --help`: passed.
- `bun --cwd packages/workspace workspace browser.eval --help`: passed.

## validation evidence

- `bun --cwd packages/workspace test tests/facade/not-found-recovery.test.ts`: passed, 3 tests.
- `bun packages/workspace/scripts/check-files.js --branch task/os/add-tool-not-found-help-recovery --files packages/workspace/scripts/workspace.ts packages/workspace/scripts/lib/facade/executor.ts packages/workspace/tests/facade/not-found-recovery.test.ts --json`: passed.
- `review.run` against `origin/stream/os`: passed, 0 blocking issues.
- `verify` full path still fails on known stale `review.js --summary-json` and missing `test-selection.js` path.
- Recovery verify: `bun packages/workspace/scripts/verify.js --base origin/stream/os --no-review --json --quiet`: passed after explicit review passed.

## files changed

- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/workspace.ts`
- `packages/workspace/tests/facade/not-found-recovery.test.ts`
- `packages/workspace/STEERING.md`
- `packages/os/dev-steering.md`

- 2026-05-28 23:12:29 append: `.task/os/add-tool-not-found-help-recovery/workpad.md`
