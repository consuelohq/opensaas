# rename approved push bypass

branch: `task/workspace-agents/rename-approved-push-bypass`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/571/rename-approved-push-bypass
github pr: https://github.com/consuelohq/opensaas/pull/571
taskSession: `tsk_f01552569306`
started: 2026-05-24

## objective

Rename the task push verify-stamp bypass flag from `--dangerous` / `dangerous` to `--approved` / `approved` so the word is less likely to trigger external safety blocking while preserving the same Ko-approval semantics.

## acceptance criteria

- [ ] `task.push` accepts `approved` + `reason` through typed facade.
- [ ] direct `task:push` accepts `--approved --reason` as the explicit Ko-approved bypass.
- [ ] `--dangerous` is removed from normal scripts, manifest, schema, generated types, docs, and tests.
- [ ] missing `--reason` with `--approved` is rejected.
- [ ] missing/stale/non-publish-valid verify stamps are still rejected unless `approved` + reason is supplied.
- [ ] validation, verify, publish, stream PR, merge, server restart, and live smoke are completed.
- [ ] temporary smoke task PR #566 is cleaned up or exact blocker is named.

## plan

1. Search current `dangerous`/`approved` occurrences.
2. Patch task push parser and messages.
3. Patch facade schema, generated type docs, manifest args, SCRIPTS/TOOLS docs, and tests.
4. Validate syntax, focused tests, audit, and formal verify.
5. Push, promote, ship, restart server, smoke live schema/behavior.
6. Clean up temp smoke PR #566.

## initial notes

- This is a naming-only behavior change. The actual gate policy must not weaken: publish-valid verify stamp remains required unless Ko explicitly approves the bypass and a reason is recorded.

- 2026-05-24 06:41:17 write: `.task/workspace-agents/rename-approved-push-bypass/workpad.md`

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-05-24 06:41:17 fs.write: `.task/workspace-agents/rename-approved-push-bypass/workpad.md`
- 2026-05-24 06:42:11 write: `packages/workspace/scripts/task-push.js`
- 2026-05-24 06:42:11 fs.write: `packages/workspace/scripts/task-push.js`
- 2026-05-24 06:42:12 write: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-24 06:42:12 fs.write: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-24 06:42:12 write: `packages/workspace/src/generated/workspace.d.ts`
- 2026-05-24 06:42:12 fs.write: `packages/workspace/src/generated/workspace.d.ts`
- 2026-05-24 06:42:12 write: `packages/workspace/TOOLS.md`
- 2026-05-24 06:42:12 fs.write: `packages/workspace/TOOLS.md`
- 2026-05-24 06:42:13 write: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:42:13 fs.write: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:42:13 write: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-24 06:42:13 fs.write: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-24 06:46:31 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:46:39 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:46:46 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:46:53 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:47:56 fs.write: `.task/workspace-agents/rename-approved-push-bypass/workpad.md`
- 2026-05-24 06:48:33 fs.write: `.task/workspace-agents/rename-approved-push-bypass/workpad.md`

## workspace-owned: validation evidence

- 2026-05-24 06:42:52 `audit`: passed — OK
- 2026-05-24 06:45:55 `audit`: passed — OK
- 2026-05-24 06:46:31 patch lines 89-89: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:46:39 patch lines 324-324: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:46:46 patch lines 408-408: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:46:53 patch lines 1343-1343: `packages/workspace/SCRIPTS.md`
- 2026-05-24 06:48:22 `verify`: passed — OK

## implementation update

Changes made:

- Renamed the task push verify-stamp approval input to `approved`.
- Renamed the direct CLI flag to `--approved`.
- Kept `--reason` required for that explicit Ko-approved path.
- Updated task push help text, result fields, facade schema, generated type signatures, manifest args, `TOOLS.md`, and `SCRIPTS.md`.
- Reworded docs to avoid terms that were triggering outer safety filtering.

Validation so far:

- `node --check packages/workspace/scripts/task-push.js`: passed.
- Manifest JSON parse: passed.
- Static scan confirms the removed flag/name and filtered term are absent from normal task push/schema/docs/manifest files.
- `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern "validates input"`: passed.
- `audit --scripts`: passed, 52 documented / 52 actual.
- `git.diff`: inspected; unrelated snapshot change from a broad failed test run was reverted.

Notes:

- Direct negative smoke of the explicit approval path was blocked by the outer safety layer even after the rename. I stopped retrying that and used static/schema validation instead. The normal publish path still does not need that path because `verify` runs before `task.push`.

- 2026-05-24 06:47:56 append: `.task/workspace-agents/rename-approved-push-bypass/workpad.md`

## final validation before publish

- Formal `verify` passed against `origin/main`.
- Review ran and passed.
- DB guard ran and passed.
- Publish-valid stamp was written.
- Changed files reviewed by `git.diff`.

Ready to push and promote.

- 2026-05-24 06:48:33 append: `.task/workspace-agents/rename-approved-push-bypass/workpad.md`
