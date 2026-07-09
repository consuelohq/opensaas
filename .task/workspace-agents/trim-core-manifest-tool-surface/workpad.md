# trim core manifest tool surface

branch: `task/workspace-agents/trim-core-manifest-tool-surface`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1116/trim-core-manifest-tool-surface
github pr: https://github.com/consuelohq/opensaas/pull/1116
started: 2026-06-18

## acceptance criteria

- [ ] Remove only Ko's requested tools from the generated core manifests for both `packages/workspace` and `packages/os`.
- [ ] Keep all other existing core tools, including `fs.apply_patch`, `fs.trash`, `github`, `review.run`, `verify`, `checkFiles`, `explore`, `context.search`, `context.get`, `context.find`, `context.save`, `context.trace`, `stream.*`, `code.*`, `intent`, `tmp`, and `tools.search`.
- [ ] Preserve removed tools in the full manifests where they already exist.
- [ ] Update focused tests first and confirm red against current config.
- [ ] Regenerate workspace and OS manifests/docs/types from source config.
- [ ] Verify the final core lists exactly match the intended removal set.
- [ ] Run focused tests, review, verify, then push/promote to stream.

## requested removal set

- `fs.list`
- `fs.write`
- `gh`
- `decideNext`
- `exploit`
- `confidenceScore`
- `confirm`
- `context.list`
- `context.categories`
- `audit`
- `doctor`
- `status`
- `mac.read`
- `mac.write`
- `mac.search`
- `mac.list`
- `mac.port`
- `mac.process`

## Test-first contract

Behavior under test:
- Workspace and OS core manifests exclude exactly Ko's removal set while preserving the rest of the prior core surface.
- Removed tools remain present in full manifests when they are defined there.

Existing local pattern to follow:
- `packages/workspace/tests/tool-manifest.test.ts` asserts core membership against OS-equivalent core config.
- `packages/os/tests/tool-manifest.test.ts` asserts generated core membership and public execution surface.
- `packages/*/manifests/manifest.config.json` controls core inclusion/exclusion.

New or changed tests:
- Add explicit `removedCoreToolNames` assertions in both workspace and OS manifest tests.
- Update existing OS expectations that currently assert `gh`, `mac.read`, `status`, `doctor`, `context.list`, and `context.categories` are core.
- Add positive assertions for intentionally retained core tools so the removal is narrow.

Focused red command:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts`

Expected red failure:
- Current core manifests still include Ko's removal set, so the new `not.toContain` assertions fail before config changes.

No-test waiver:
- None. This is generated manifest/tool-surface behavior and has existing focused tests.

## plan

1. Update tests first with Ko's exact removal set and retained-tool assertions.
2. Run focused tests and record red.
3. Update workspace and OS core manifest config to exclude only the requested names/prefixes.
4. Regenerate manifests/docs/types.
5. Run focused tests, explicit core-list verification, review, verify, push, and promote.

## current status

- Task started from stream.
- Source configs/tests read.
- Tests next.

## files changed

- none yet

## validation evidence

- pending

## issues and recovery

- First `task.start` retry: facade accepts `startFrom: "stream"`, not the literal branch name.
- First `fs.read` attempts used stale schemas; switched to task-scoped `code.call` for multi-file read evidence.
- First `fs.write` failed because existing workpad needed force/append; retried with `force`.

- 2026-06-18 00:28:43 write: `.task/workspace-agents/trim-core-manifest-tool-surface/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-18 00:28:43 fs.write: `.task/workspace-agents/trim-core-manifest-tool-surface/workpad.md`


## implementation notes

Changed source config:
- `packages/workspace/manifests/manifest.config.json`
- `packages/os/manifests/manifest.config.json`

Config behavior:
- Removed explicit core names: `audit`, `confidenceScore`, `confirm`, `decideNext`, `doctor`, `exploit`, `gh`, `status`.
- Removed `mac.` from core include prefixes and added `mac.` to exclude prefixes.
- Added exact exclude names for Ko's requested removal set so `context.` and `fs.` can remain included while `context.list`, `context.categories`, `fs.list`, and `fs.write` are removed.

Generated surfaces:
- Regenerated workspace full/core/workflow manifests, generated types, and docs.
- Regenerated OS full/core/workflow manifests, generated types, and docs.
- Generated core count is now 24 tools in both packages.

Red evidence:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts` failed as expected before implementation: core still included `fs.list`.
- `bun --cwd packages/os test tests/tool-manifest.test.ts` failed as expected before implementation: core still included `fs.list`.
- Trace: `trc_836160bde76c`.

Green evidence:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts` passed: 4 tests.
- `bun --cwd packages/os test tests/tool-manifest.test.ts` passed: 12 tests.
- Trace: `trc_72ec32ebc49b`.

Generated manifest verification:
- Workspace core has 24 tools.
- OS core has 24 tools.
- No requested removed tool remains in either core manifest.
- All intended retained tools remain in both core manifests.
- Removed tools remain in full manifests.
- Trace: `trc_e65d1bb1e2e2`.

Diff notes:
- Working-tree diff has 10 package files changed plus task metadata.
- Core manifest shrink is expected: both generated core manifests drop from 42 to 24 tools.
- Direct working-tree `git.diff` wrapper was blocked; bounded bash diff summary succeeded. Trace: `trc_ebe657757ead`.

## files changed update

Source/config/test:
- `packages/workspace/manifests/manifest.config.json`
- `packages/os/manifests/manifest.config.json`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

Generated:
- `packages/workspace/manifests/core-manifest.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/manifests/workflow-bundles.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`

## workspace-owned: validation evidence

- pending
- 2026-06-18 00:32:10 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/trim-core-manifest-tool-surface.json`, `.task/workspace-agents/trim-core-manifest-tool-surface/current.json`, `.task/workspace-agents/trim-core-manifest-tool-surface/session.json`, `.task/workspace-agents/trim-core-manifest-tool-surface/workpad.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/tests/tool-manifest.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


## final validation evidence

- Focused tests passed:
  - `bun --cwd packages/workspace test tests/tool-manifest.test.ts`: 4 tests passed.
  - `bun --cwd packages/os test tests/tool-manifest.test.ts`: 12 tests passed.
  - Trace: `trc_72ec32ebc49b`.
- Explicit manifest verification passed:
  - Workspace core count: 24.
  - OS core count: 24.
  - Requested removed tools present in core: none.
  - Intended retained tools missing from core: none.
  - Removed tools missing from full manifests: none.
  - Trace: `trc_e65d1bb1e2e2`.
- Fallback review command passed after direct `review.run` wrapper block:
  - `bun run --cwd packages/workspace review -- --base origin/stream/workspace-agents --json`.
  - Trace: `trc_6514c7ac6ce4`.
- `verify` passed with `publishValid: true` against `origin/stream/workspace-agents`.
  - Trace: `trc_d99c1ad48cad`.
  - Note: verify registry selected zero suites for this generated/config/test-only change; focused manifest tests were run manually and are recorded above.

## acceptance criteria status

- [x] Remove only Ko's requested tools from generated core manifests for workspace and OS.
- [x] Keep all other prior core tools requested to remain.
- [x] Preserve removed tools in full manifests.
- [x] Update focused tests first and confirm red.
- [x] Regenerate workspace and OS manifests/docs/types.
- [x] Verify final core lists exactly match intended removal set.
- [x] Run focused tests, review, and verify.
- [ ] Push and promote to stream.
