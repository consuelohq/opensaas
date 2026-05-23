# normalize workpad activity formatting

branch: `task/workspace-agents/normalize-workpad-activity-formatting`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/491/normalize-workpad-activity-formatting
github pr: https://github.com/consuelohq/opensaas/pull/491
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/lib/task-workpad.js`




## workspace-owned: files changed

- `packages/workspace/scripts/lib/task-workpad.js`




## workspace-owned: activity log

- 2026-05-23 05:59:48 fs.write: `.task/workspace-agents/normalize-workpad-activity-formatting/workpad.md`
- 2026-05-23 06:03:35 fs.write: `.task/workspace-agents/normalize-workpad-activity-formatting/workpad.md`

- 2026-05-23 06:00:37 fs.patch: `packages/workspace/scripts/lib/task-workpad.js`



## workspace-owned: validation evidence

- 2026-05-23 06:03:05 `review.run`: passed — OK
- 2026-05-23 06:03:26 `verify`: passed — OK



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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## implementation checkpoint — initial task setup

### acceptance criteria

- Normalize workspace-owned activity log rendering into one compact ordered list.
- Fix section replacement so automated workpad sections update the full section body.
- Add regression coverage for malformed activity sections with blank lines and out-of-order entries.
- Validate and promote from a clean task branch.
- Account for stale PR #488 after the clean replacement is promoted.

### plan before editing

1. Read current `task-workpad.js` and tests.
2. Replace regex section replacement with deterministic string scanning.
3. Normalize activity lines before rendering.
4. Add focused tests.
5. Validate, push, promote, and close/account for stale PR #488.

- 2026-05-23 05:59:48 append: `.task/workspace-agents/normalize-workpad-activity-formatting/workpad.md`

- 2026-05-23 06:00:37 patch lines 42-58: `packages/workspace/scripts/lib/task-workpad.js`

## final validation before publish

Files changed:

- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/tests/task-workpad.test.ts`

Validation evidence:

- `node --check packages/workspace/scripts/lib/task-workpad.js`: passed.
- `bun test packages/workspace/tests/task-workpad.test.ts`: passed, 8 tests.
- `review.run --base origin/main --no-tests`: passed.
- `verify --base origin/main --no-db`: passed.

Notes:

- This clean task replaces stale PR #488.
- The stale PR will be closed after this clean replacement is promoted.

- 2026-05-23 06:03:35 append: `.task/workspace-agents/normalize-workpad-activity-formatting/workpad.md`
