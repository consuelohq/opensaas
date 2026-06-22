# fix intent core manifest description

branch: `task/workspace-agents/fix-intent-core-manifest-description`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1113/fix-intent-core-manifest-description
github pr: https://github.com/consuelohq/opensaas/pull/1113
started: 2026-06-17

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

- 2026-06-17 22:18:49 fs.write: `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`
- 2026-06-17 22:20:28 fs.write: `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`
- 2026-06-17 22:21:28 fs.write: `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`

## workspace-owned: validation evidence

- 2026-06-17 22:21:06 `review.run`: passed — OK
- 2026-06-17 22:21:19 `verify`: passed — OK

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

## acceptance criteria update

- [ ] Replace the `intent` manifest description in both `packages/workspace` and `packages/os` source manifests with Ko's requested wording.
- [ ] Remove task lifecycle tools from the generated core manifests for both packages.
- [ ] Preserve task lifecycle tools in the full manifests so workflow/action resolution can still use them where appropriate.
- [ ] Update focused tests first so they fail against the current core-manifest behavior.
- [ ] Regenerate full/core/workflow manifests and any generated docs/types affected by source manifest changes.
- [ ] Verify core manifests contain no `task.*` tools and still expose `intent`.
- [ ] Publish through the task → stream flow.

## Test-first contract

Behavior under test:
- Workspace and OS core manifests exclude task lifecycle tools (`task.*`) while keeping non-task core tools such as `intent`, `stream.context`, `fs.read`, `code.call`, and `tools.search`.
- Workspace and OS full manifests still contain task lifecycle tools.
- Workspace and OS `intent` tool descriptions use Ko's requested wording in the source and generated manifests.

Existing local pattern to follow:
- `packages/workspace/tests/tool-manifest.test.ts` already checks core manifest membership from config.
- `packages/os/tests/tool-manifest.test.ts` already checks core/full manifest membership and public generated surfaces.
- `packages/*/manifests/manifest.config.json` controls core inclusion via include/exclude prefixes.

New or changed tests:
- Update workspace and OS tool-manifest tests to assert no generated core tool name starts with `task.`.
- Update workspace and OS tool-manifest tests to assert `intent` description matches the requested wording.

Focused red command:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts`

Expected red failure:
- Current core config includes `task.` prefix, so tests expecting no `task.*` in core fail.
- Current `intent` description is the old generic workflow bundle copy, so description assertion fails.

No-test waiver:
- None. This is generated manifest/tool-surface behavior and has existing focused tests.

- 2026-06-17 22:18:49 append: `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`

- 2026-06-17 22:19:05 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-06-17 22:19:05 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-06-17 22:19:27 apply-patch: `packages/workspace/manifests/manifest.config.json`
- 2026-06-17 22:19:27 apply-patch: `packages/os/manifests/manifest.config.json`
- 2026-06-17 22:19:27 apply-patch: `packages/workspace/tooling/tool-manifest.json`
- 2026-06-17 22:19:27 apply-patch: `packages/os/tooling/dev-tool-manifest.json`
## implementation notes

Changed source of truth:
- `packages/workspace/tooling/tool-manifest.json`: updated `intent.description` to Ko's requested wording.
- `packages/os/tooling/dev-tool-manifest.json`: updated `intent.description` to the same wording.
- `packages/workspace/manifests/manifest.config.json`: removed `task.` from core include prefixes and added it to core exclude prefixes.
- `packages/os/manifests/manifest.config.json`: removed `task.` from core include prefixes and added it to core exclude prefixes.

Generated surfaces:
- Regenerated workspace full/core/workflow manifests, `TOOLS.md`, and generated types.
- Regenerated OS full/core/workflow manifests, `TOOLS.md`, and generated types.

Red evidence:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts` failed as expected before implementation: core still had `task.*`; `intent` still used the old description.
- `bun --cwd packages/os test tests/tool-manifest.test.ts` failed as expected before implementation: core still had `task.*`; `intent` still used the old description.
- Trace: `trc_ba5527a30dd4`.

Green evidence:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts` passed: 4 tests.
- `bun --cwd packages/os test tests/tool-manifest.test.ts` passed: 12 tests.
- Trace: `trc_3999243f1958`.

Generated manifest verification:
- Workspace core manifest has 42 tools, includes `intent`, and contains zero `task.*` tools.
- OS core manifest has 42 tools, includes `intent`, and contains zero `task.*` tools.
- Workspace and OS full manifests still include task lifecycle tools.
- All `intent` generated descriptions match Ko's requested wording.
- Trace: `trc_83b499a1daae`.

Diff notes:
- Working tree diff shows 18 changed files, including source configs/manifests, generated manifests/docs, focused tests, and scoped task metadata.
- `git.diff` trace: `trc_36967817dd53`.

- 2026-06-17 22:20:28 append: `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-intent-core-manifest-description.json`, `.task/workspace-agents/fix-intent-core-manifest-description/current.json`, `.task/workspace-agents/fix-intent-core-manifest-description/session.json`, `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## final validation evidence

- `review.run` against `origin/main` passed with 0 issues and 0 pre-existing issues. Trace: `trc_ffe98a8f697b`.
- `verify` against `origin/main` passed with `publishValid: true`. Trace: `trc_eb60bcc60be8`.
- Verify-selected suites passed:
  - `workspace facade input contracts`: 130 tests passed.
  - `workspace audit tests`: 1 test passed.
- DB guard passed with 0 risks and 0 findings.

## acceptance criteria status

- [x] Replace the `intent` manifest description in both `packages/workspace` and `packages/os` source manifests with Ko's requested wording.
- [x] Remove task lifecycle tools from the generated core manifests for both packages.
- [x] Preserve task lifecycle tools in the full manifests.
- [x] Update focused tests first and run red.
- [x] Regenerate full/core/workflow manifests and generated docs/types where applicable.
- [x] Verify core manifests contain no `task.*` tools and still expose `intent`.
- [x] Run focused tests, review, and verify.
- [ ] Push and promote through task → stream.

## files changed final

Source/config/test:
- `packages/workspace/tooling/tool-manifest.json`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/manifests/manifest.config.json`
- `packages/os/manifests/manifest.config.json`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

Generated:
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/manifests/core-manifest.json`
- `packages/workspace/manifests/workflow-bundles.json`
- `packages/workspace/TOOLS.md`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/TOOLS.md`

- 2026-06-17 22:21:28 append: `.task/workspace-agents/fix-intent-core-manifest-description/workpad.md`
