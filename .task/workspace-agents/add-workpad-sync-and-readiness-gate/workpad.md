# add workpad sync and readiness gate

branch: `task/workspace-agents/add-workpad-sync-and-readiness-gate`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/480/add-workpad-sync-and-readiness-gate
github pr: https://github.com/consuelohq/opensaas/pull/480
started: 2026-05-23

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## implementation checkpoint — initial task setup

### acceptance criteria

- Add a centralized workpad helper that renders human-readable workspace-owned sections without removing existing JSON metadata.
- Mutating file tools keep human-readable files changed and activity sections current.
- `task.push` and `task.pr` block when the workpad is still starter-scaffold only, with a helpful message and an explicit accountable escape hatch.
- Automated workpad sections alone do not satisfy readiness; at least one agent-authored update is required.
- Tests cover readiness, automated section rendering, and publish gate behavior.

### plan before editing

1. Add `scripts/lib/task-workpad.js` for section replacement, activity rendering, files changed sync, and readiness checks.
2. Update `task-start.js` scaffold to distinguish agent-owned and workspace-owned sections.
3. Update `task-fs.js` to record writes/patches/trash in the workpad.
4. Update `task-push.js` to use the helper and block scaffold-only workpads before publishing.
5. Update `task-pr.js` to run the same readiness gate.
6. Add focused tests and docs.

### initial assumptions

- Existing JSON task metadata/evidence/read/verify files remain the machine source of truth.
- The workpad should be a readable projection plus agent-authored judgment, not a replacement for JSON logs.
- Readiness should be lightweight: meaningful agent-authored update exists, not every section perfectly filled.

- 2026-05-23 04:17:36 append: `.task/workspace-agents/add-workpad-sync-and-readiness-gate/workpad.md`
## implementation checkpoint — after edit

Files changed:

- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/tests/task-workpad.test.ts`
- `packages/workspace/SCRIPTS.md`

Key decisions:

- Keep all existing JSON metadata and logs.
- Add a human-readable workpad projection helper instead of replacing machine metadata.
- Automated activity/files sections do not satisfy readiness by themselves.
- Publish gates require one meaningful agent-authored workpad update, with `--ack-workpad-incomplete` as the accountable escape hatch.

Expected validation:

- Syntax checks for changed scripts.
- Focused task workpad tests.
- Focused task push/pr behavior tests if existing coverage can be updated quickly.
- `audit --scripts`, `review.run`, and `verify`.

- 2026-05-23 04:19:37 append: `.task/workspace-agents/add-workpad-sync-and-readiness-gate/workpad.md`
- 2026-05-23 04:20:46 write: `packages/workspace/tests/task-workpad.test.ts`
## final validation before publish

Files changed:

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-workpad.test.ts`

Validation evidence:

- `node --check` passed for `task-workpad.js`, `task-start.js`, `task-fs.js`, `task-push.js`, and `task-pr.js`.
- `bun --cwd packages/workspace test tests/task-workpad.test.ts`: passed, 4 tests.
- `bun --cwd packages/workspace test`: passed.
- `audit --scripts`: passed, 51 documented / 51 actual.
- `review.run --base origin/stream/workspace-agents --no-tests`: passed.
- `verify --base origin/stream/workspace-agents --no-db`: passed.

Notes:

- Full workspace package tests reported obsolete snapshots from existing facade snapshot drift, but the test command exited successfully.
- `checkFiles` was safety-blocked before execution, so validation used direct syntax checks plus focused/full tests.

Ready to publish.

- 2026-05-23 04:22:26 append: `.task/workspace-agents/add-workpad-sync-and-readiness-gate/workpad.md`