# remove misplaced worker providers

branch: `task/os/remove-misplaced-worker-providers`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/632/remove-misplaced-worker-providers
github pr: https://github.com/consuelohq/opensaas/pull/632
started: 2026-05-28

## acceptance criteria

- [x] Revert misplaced worker-provider commit `21ac2b88bebe1fa6f9ecfff57f9d77282379bab5` from `stream/os`.
- [x] Remove only worker-provider changes and their accidental `os` task metadata from the OS stream.
- [x] Do not touch unrelated OS stream work.
- [x] Validate against `origin/stream/os`.
- [ ] Push and promote into the `stream/os` review PR.

## plan

1. Run `git revert --no-edit 21ac2b88bebe1fa6f9ecfff57f9d77282379bab5` in this task worktree.
2. Resolve only conflicts directly caused by removing the misplaced worker-provider changes.
3. Validate review/verify against `origin/stream/os`.
4. Push/promote through the workspace task scripts.

## current status

- Revert commit `84c4a59551abe07ecf0d48d5cc273d4069a5d931` removes misplaced worker-provider changes from `stream/os`.
- Revert applied cleanly. No manual conflict resolution was required.

## files changed

- `packages/workspace/TOOLS.md`
- `packages/workspace/decision.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- deleted `.task/os/add-neutral-command-aliases-and-worker-providers/*`
- deleted `.task/tasks/os/add-neutral-command-aliases-and-worker-providers.json`
- `.task/os/remove-misplaced-worker-providers/*`
- `.task/tasks/os/remove-misplaced-worker-providers.json`

## workspace-owned: files changed

- `packages/workspace/TOOLS.md`
- `packages/workspace/decision.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: activity log

- `bun run --cwd packages/workspace review -- --base origin/stream/os --mine --no-tests --json`: passed with no findings.
- `bun packages/workspace/scripts/verify.js --base origin/stream/os --json`: passed review and db guard. The stream-local verify script did not write a scoped stamp because this stream still has the older verify implementation.

## workspace-owned: validation evidence

- The code was promoted into `stream/workspace-agents` first through task PR #630 / stream PR #622 before reverting from `stream/os`.

## key decisions

- `stream/os` verify passed but did not write a stamp due older scoped metadata support. Publish will use the explicit approved recovery path, backed by the passing stream-local verify result.

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
