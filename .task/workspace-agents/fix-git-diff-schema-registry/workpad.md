# fix git diff schema registry

branch: `task/workspace-agents/fix-git-diff-schema-registry`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/467/fix-git-diff-schema-registry
github pr: https://github.com/consuelohq/opensaas/pull/467
started: 2026-05-22

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

- `git.diff` validates successfully through `workspace.call` after server restart.
- `GitDiffInput` is registered in the runtime facade schema registry, not only in the manifest/generated docs.
- `status` no longer treats shipped historical scoped task metadata as the active stale task on `main`.
- Tests cover the schema registration and stale scoped metadata behavior.
- The task is validated, pushed, promoted to the stream review PR, merged to main if approved, and local main is updated.

### plan before editing

1. Inspect the facade schema registry and generated type/docs surfaces for `GitDiffInput`.
2. Find why the manifest includes `git.diff` while runtime validation cannot resolve `GitDiffInput`.
3. Inspect `status` stale scoped task metadata selection logic.
4. Patch root causes with tests.
5. Validate with focused tests, audit/review/verify, then publish.

### initial assumptions

- The manifest entry is loaded because `get_steering` shows `git.diff`.
- Runtime validation is using a separate schema registry that was not updated for `GitDiffInput`.
- Historical scoped `.task/<area>/<slug>/current.json` files on `main` should be treated as archive metadata unless they match an active task/worktree/session.

- 2026-05-22 09:00:35 append: `.task/workspace-agents/fix-git-diff-schema-registry/workpad.md`
## implementation checkpoint — before edit

Planned changes:

- Add `GitDiffInput` to `packages/workspace/scripts/lib/facade/schemas.ts`.
- Add `GitDiffInput` to the runtime `schemaRegistry` and `schemaTypeSignatures`.
- Add a facade test that every manifest `inputSchema` resolves to a registered runtime schema.
- Change scoped task metadata lookup so historical scoped task metadata is considered only for task branches or explicit task branch lookup, preventing `status` on `main` from reporting old shipped scoped metadata as stale active task state.
- Add tests around scoped metadata lookup behavior.

Why safe:

- The manifest already declares `git.diff`; this completes the runtime schema registry path.
- Historical scoped metadata remains on disk for context/workpad history, but stops driving active status on `main` or stream branches.
- Explicit task-session/task-branch lookup still uses scoped metadata.

Expected validation:

- `bun --cwd packages/workspace test tests/facade/facade.test.ts`
- focused task metadata/status tests if available or added
- `git.diff` smoke through `workspace.call`
- audit/review/verify before publish

- 2026-05-22 09:02:40 append: `.task/workspace-agents/fix-git-diff-schema-registry/workpad.md`
- 2026-05-22 09:05:12 patch lines 8-20: `packages/workspace/tests/task-meta.test.js`
- 2026-05-22 09:07:30 write: `packages/workspace/tests/task-meta.test.ts`
## implementation checkpoint — after edit

Files changed:

- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/task-meta.test.ts`
- generated `packages/workspace/src/generated/workspace.d.ts`
- generated `packages/workspace/TOOLS.md`

Key decisions:

- `GitDiffInput` now lives in the runtime schema registry as well as generated docs/types.
- Added a facade guard test that fails when any manifest input schema is missing from the runtime registry.
- Scoped historical task metadata is searched only for task branch lookups, so `main` and stream status stop treating old task records as active stale state.

Validation so far:

- `bun --cwd packages/workspace test tests/facade/facade.test.ts tests/task-meta.test.ts tests/git-diff.test.ts`: passed, 519 tests.
- `bun run generate-types`: passed.
- `bun run generate-docs`: passed.
- `checkFiles` passed for code/test/generated type files; skipped Markdown syntax because `TOOLS.md` is generated Markdown and `node --check` does not apply.
- `audit --scripts`: passed, 51 documented / 51 actual.

- 2026-05-22 09:13:25 append: `.task/workspace-agents/fix-git-diff-schema-registry/workpad.md`
## final validation before publish

Files changed:

- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/task-meta.test.ts`

Validation evidence:

- Focused tests passed: 519 tests across facade, git diff, and task metadata.
- Generated type stubs passed.
- Generated tool docs passed.
- `audit --scripts` passed.
- `review.run --base origin/stream/workspace-agents --no-tests` passed.
- `verify --base origin/stream/workspace-agents --no-db` passed.

Ready to publish.

- 2026-05-22 09:15:04 append: `.task/workspace-agents/fix-git-diff-schema-registry/workpad.md`