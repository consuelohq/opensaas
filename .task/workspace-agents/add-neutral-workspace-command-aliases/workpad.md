# add neutral workspace command aliases

branch: `task/workspace-agents/add-neutral-workspace-command-aliases`
stream: `stream/workspace-agents`
task pr: https://github.com/consuelohq/opensaas/pull/620
started: 2026-05-28

## acceptance criteria

- [x] `workspace.call({ tool: "task.call", ... })` is supported by the updated manifest/facade code anywhere `task.exec` was supported. The already-running workspace server still reports `unknown tool: task.call` until it reloads the updated manifest.
- [x] `workspace.call({ tool: "mac.call", ... })` is supported by the updated manifest/facade code anywhere `mac.exec` was supported. The already-running workspace server requires a manifest reload before live direct calls are recognized.
- [x] `task.exec` and `mac.exec` still exist and use the original command mappings.
- [x] Steering prefers `task.call`/`mac.call` and labels old names legacy-compatible.
- [x] Repo-local task skill source was not present; no editable skill file with `task.exec`/`mac.exec` references was found. Steering and generated workspace docs now carry the preference.
- [x] No command semantics or safety checks were weakened.
- [x] No worker/delegation tool was added.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## validation

- `workspace.call({ tool: "task.call", ... })` before server reload: expected current-session `NOT_FOUND`, confirming active server manifest is stale relative to task branch.
- `bun run generate-types`: passed.
- `bun run generate-docs`: passed.
- `cd packages/workspace && bun x vitest run tests/facade/facade.test.ts -u`: passed after snapshot update.
- `cd packages/workspace && bun x vitest run tests/facade/facade.test.ts`: passed.
- `bun run audit -- --scripts`: passed, documented 56 / actual 56.
- `git diff --check`: passed.
- `review.run --base origin/stream/workspace-agents --no-tests`: passed, 0 blocking issues.

## tooling note

Used temp-file Python/Node scripts through legacy `task.exec` during this task because `task.call` was the feature being added and the running workspace server had not loaded the new manifest yet. The scripts were stored in temp files rather than heredocs or giant shell arguments.

- 2026-05-28 20:37:26 write: `.task/workspace-agents/add-neutral-workspace-command-aliases/workpad.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-05-28 20:37:26 fs.write: `.task/workspace-agents/add-neutral-workspace-command-aliases/workpad.md`

## workspace-owned: validation evidence

- 2026-05-28 20:37:45 `verify`: passed — OK
