# typed workspace facade zod schemas standard envelopes full command coverage

branch: `task/workspace-agents/typed-workspace-facade-zod-schemas-standard-envelopes-full-command-coverage`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/225
started: 2026-04-29

## acceptance criteria

- [x] add a manifest-backed typed facade over workspace scripts.
- [x] standardize envelopes, trace ids, request ids, dry-run handling, and stderr audit events.
- [x] generate agent-facing docs and workspace type stubs from the manifest.
- [x] cover wrappers, branch resolution, batch execution, composed methods, and mac operations with vitest.

## plan

1. build the manifest, schemas, executor, typed client, batch runner, and cli entries.
2. add composed helper scripts for file checks, edit flows, and mac operations.
3. generate docs/types and verify with unit, smoke, syntax, and audit checks.

## files changed

- root/package workspace scripts, `packages/workspace/package.json`, and `packages/workspace/bun.lock`.
- facade implementation under `packages/workspace/scripts/lib/facade/`.
- cli entries, composed helper scripts, manifest files, generated docs/types, and facade tests.

## key decisions

- the facade stays thin: it validates and envelopes calls, then invokes the existing scripts.
- `task:*` and `stream:*` calls execute from the controller root so task worktree discovery stays stable.
- facade-local scripts execute from the current task root so unmerged script changes can be tested.

## notes for ko

- `context.categories` currently returns plain text from the underlying script, so the facade wraps it as `data.raw` in an `OK` envelope.

## improvements noticed

- `task.current` now honors `TASK_BRANCH` before stale `.task/current.json` metadata.

## errors i ran into

- `bun install --cwd packages/workspace` populated dependencies but left an untracked worktree `node_modules` symlink; it is not part of the push.
- initial smokes caught plain-text stdout being treated as `PARSE_ERROR` and `mac.*` running from the wrong root; both are fixed.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```
