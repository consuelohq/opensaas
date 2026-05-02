# make fs patch multiline safe

branch: `task/workspace-agents/make-fs-patch-multiline-safe`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/281
started: 2026-05-02

## acceptance criteria

- [x] Add a safe multiline replacement transport for `fs.patch`.
- [x] Reject unsafe inline multiline/literal-newline-escape patch content.
- [x] Ensure `editFlow` preserves `contentFile` instead of reserializing source into argv.
- [x] Regenerate typed facade docs/types for the new `contentFile` surface.
- [x] Update `STEERING.md` and `SCRIPTS.md` so future agents use `--content-file` for multiline code.
- [x] Validate the CLI patch path and typed facade behavior.

## plan

1. Add `--content-file` support to `packages/workspace/scripts/fs.js`.
2. Add guards for unsafe inline patch content.
3. Update facade schema, manifest, generated types, generated docs, and script docs.
4. Update steering with durable command-construction guidance for source-code patching.
5. Run syntax, unit, smoke, and review validation.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/edit-flow.js`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tooling/tool-manifest.json`


## key decisions

- `fs.patch --content` remains available for single-line patches.
- `fs.patch --content-file` is the supported path for multiline replacement content.
- Inline patch content containing real newlines or literal `\\n` escape sequences is rejected before writing.
- `editFlow` now passes `--content-file` to `task:fs patch` directly so it does not reintroduce the argv serialization failure.

## notes for ko

- `workspace stream.sync` failed before task start because `stream/workspace-agents` is already checked out by `/private/tmp/opensaas-worktrees/stream-workspace-agents-merge-main`. The task still started from `stream/workspace-agents` at commit `39eb0665`.

## improvements noticed

- `checkFiles` is still syntax-oriented and not enough to validate structured file types such as Astro. The steering update now explicitly tells agents to use file-type validation after patching.

## errors i ran into

- Initial generated edit wrote an invalid JavaScript string containing an actual newline; `node --check packages/workspace/scripts/fs.js` caught it before any publish step.
- One Vitest invocation used a repo-rooted test path with `--cwd packages/workspace`; rerunning with `tests/facade/facade.test.ts` passed.

## validation

- `node --check packages/workspace/scripts/fs.js` passed.
- `node --check packages/workspace/scripts/edit-flow.js` passed.
- `workspace checkFiles` passed for `fs.js`, `edit-flow.js`, `schemas.ts`, `generate-docs.ts`, and `generate-types.ts`.
- `bun --cwd packages/workspace test tests/facade/facade.test.ts` passed.
- Manual CLI smoke passed: `fs.js patch --content-file` applied multiline replacement, and inline literal `\\n` content failed with the expected guard.
- `bun run generate-types && bun run generate-docs` passed from `packages/workspace`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): make fs patch multiline safe" --changed
bun run task:pr
bun run task:finish
```
