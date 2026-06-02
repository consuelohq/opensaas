# fix github raw args and cleanup branch facade

branch: `task/workspace-agents/fix-github-raw-args-and-cleanup-branch-facade`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/547/fix-github-raw-args-and-cleanup-branch-facade
github pr: https://github.com/consuelohq/opensaas/pull/547
started: 2026-05-23

## acceptance criteria

- [x] Demonstrate no-task `code.run` read workflow before task work.
- [x] Identify recent failures from trace data.
- [x] Fix GitHub raw passthrough command construction for `rawArgs` and legacy `args`.
- [x] Fix array flag emission in the generic facade builder.
- [x] Make `task.cleanup` a repo-level facade tool with explicit `--branch` target support.
- [x] Validate focused facade behavior and script-level behavior.

## notes

No-task `code.run` worked for read-style investigation by composing `mac.exec` and `context.trace`. Typed `fs.read` remains task-scoped, which is still the desired default for repo file reads/edits.

## files changed

- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tooling/tool-manifest.json`

## validation evidence

- `code.run` no-task investigation completed and read recent trace data.
- `bun run github -- raw --reason 'dry-run raw arg smoke' --raw-arg api --raw-arg repos/consuelohq/opensaas --dry-run --json`: passed.
- `bun run task:cleanup -- --branch task/workspace-agents/not-real-cleanup-smoke --preview --json`: passed.
- `bun packages/workspace/scripts/workspace.ts github '{...rawArgs...dryRun:true}'`: passed; command was `gh api repos/consuelohq/opensaas`.
- `bun packages/workspace/scripts/workspace.ts github '{...args...dryRun:true}'`: passed; command was `gh api repos/consuelohq/opensaas`.
- `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern 'github|cleanup|array'`: passed, 10 tests.
- `bun run audit -- --scripts --json`: passed, 52 documented / 52 actual.
- `verify --base origin/main --no-review --no-db`: passed.

## issues and recovery

- Full facade suite currently has unrelated `fs.js` path-environment failures in the task worktree (`scripts/fs.js` lookup). Focused affected tests passed.
- A direct task-worktree facade smoke for `task.cleanup` hit the old installed/root script before merge; script-level and unit validation cover the changed behavior, and live test should be run after merge/restart.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace-agents): repair github raw args and cleanup branch facade" --changed
bun run task:pr
bun run task:finish
```
