# collapse context tools into canonical facade

branch: `task/workspace-agents/collapse-context-tools-into-canonical-facade`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1119/collapse-context-tools-into-canonical-facade
github pr: https://github.com/consuelohq/opensaas/pull/1119
started: 2026-06-18

taskSession: `tsk_ff9b3a004eb6`

## acceptance criteria

- [ ] Replace multiple core context tools with one canonical `context` facade tool in both workspace and OS.
- [ ] Preserve context operations as manifest flags/arguments under the canonical tool, using an `operation` field like the `github` tool.
- [ ] Keep existing context CLI behavior working through the canonical manifest command.
- [ ] Remove old `context.find`, `context.get`, `context.save`, `context.search`, and `context.trace` from core in both packages.
- [ ] Decide whether the implementation needs an Effect runtime rewrite after reading existing context script and fs read Effect pattern.
- [ ] Add tests before production edits and confirm red.
- [ ] Regenerate full/core/workflow manifests, docs, and generated types.
- [ ] Validate workspace and OS manifests, facade execution, review, verify, push, promote, and cleanup.

## exploration notes

- `context.search` memory search found no durable prior decision for canonical context tools.
- `explore` returned mostly unrelated React Effect files for the broad query; it was not useful evidence for this facade change.
- Existing context runtime is already a single CLI script: `packages/workspace/scripts/context.js` with subcommands `search`, `find`, `get`, `list`, `save`, `categories`, and `trace`.
- OS has the same facade architecture and context script surface to cross-update.
- The `github` tool pattern is a single manifest entry with an `operation` positional argument and many optional flags.
- The Effect pattern in `packages/os/scripts/lib/fs/read.ts` is a dedicated runtime module with typed Effect functions and CLI helpers. A full context rewrite into Effect is larger than this surface-collapse task because context currently mixes Supabase memory operations, trace SQLite operations, CLI parsing, and help rendering in one JS script.

## design decision

Use one canonical manifest/facade tool named `context` with an `operation` field that maps to the existing context CLI subcommand. Keep the existing runtime script for this task. This removes core bloat and aligns with the GitHub-style canonical tool pattern without introducing a second context runtime path.

Effect rewrite boundary:
- defer runtime rewrite unless tests show the existing CLI cannot support canonical operation dispatch.
- if rewritten later, create a dedicated runtime module and have both script and facade delegate to it, following the `fs/read.ts` split.

## test-first contract

Behavior under test:
- Workspace and OS full manifests include canonical `context` with `inputSchema: ContextInput`.
- Workspace and OS core manifests include `context` and exclude the old context leaf tools.
- Full manifests no longer expose old context leaf tools after collapse.
- `executeTool("context", { operation: "search", keyword: "workspace", limit: 1 })` plans/runs the existing context script as `context search workspace --limit 1 --json`.
- `executeTool("context", { operation: "trace", status: "error", limit: 1 })` plans/runs `context trace --status error --limit 1 --json`.
- `ContextInput` rejects missing or unsupported operations.

Existing local pattern:
- `github` manifest entry for canonical operation + flags.
- `packages/*/tests/tool-manifest.test.ts` for full/core manifest assertions.
- `packages/*/tests/facade/facade.test.ts` for executor command planning and schema behavior.

Focused red commands:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts tests/facade/facade.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts tests/facade/facade.test.ts`

Expected red:
- `context` is missing from full/core manifests.
- old context leaf tools remain in full/core manifests.
- `ContextInput` is missing.
- `executeTool("context", ...)` returns `NOT_FOUND`.

No-test waiver:
- none.

## validation evidence

- red contract run: `trc_294359643a1c` showed expected failures before implementation: missing canonical context, old context leaves present, canonical facade returned NOT_FOUND. It also touched a snapshot during filtered Vitest execution, later restored.
- generation: `trc_4b3a7984b5ed` regenerated workspace and OS tool manifests, core manifests, docs, and generated types. Workspace full now 125 tools/core 13; OS full now 128 tools/core 13.
- focused green syntax + tests: `trc_254c67db09e6` passed node syntax checks for both context scripts, workspace tool-manifest tests (4), OS tool-manifest tests (12), and canonical context facade tests in workspace and OS.
- exact core/full assertion: `trc_0d9a73893681` confirmed both core manifests are exactly [batch, code.call, code.run, context, explore, fs.apply_patch, fs.trash, github, intent, review.run, stream.context, stream.sync, tools.search], old context leaves are absent from full and core, and context uses ContextInput with operation/flag arguments.
- snapshot refresh: `trc_8fe3e5d75cdc` refreshed only facade success/failure snapshots; `trc_1d43f6e29790` confirmed the snapshot subset passes without update mode; `trc_83ece44aadee` confirmed zero obsolete context.* snapshot keys and two canonical context snapshot keys per package.

- review gate: `trc_927115d7e5ec` passed with 0 issues in this change; 9 pre-existing OS context.js error-handling findings remained classified pre-existing.
- verify gate: `trc_717337bea1bf` passed with `publishValid: true`; selected workspace facade input contracts and workspace audit tests passed.

## implementation notes

- Did not rewrite context runtime to Effect in this task. Existing `context.js` already provides a single subcommand runtime. The implemented surface is a canonical manifest/facade entry over that runtime, matching the github operation pattern.
- Added `ContextInput` to both schema registries and generated type signatures.
- Kept old leaf schemas in code for compatibility, but removed old context leaf tools from both source and generated manifests.
- Used `contextTaskSession` for the trace task-session filter so it does not collide with the facade-level `taskSession` field.
- Updated `context list` to accept `--category` as well as positional category so canonical flag routing works.

- 2026-06-18 01:39:33 write: `.task/workspace-agents/collapse-context-tools-into-canonical-facade/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-18 01:39:33 fs.write: `.task/workspace-agents/collapse-context-tools-into-canonical-facade/workpad.md`

- 2026-06-18 01:44:45 apply-patch: `packages/workspace/manifests/manifest.config.json`
- 2026-06-18 01:44:45 apply-patch: `packages/os/manifests/manifest.config.json`
- 2026-06-18 01:45:06 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-18 01:45:06 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-06-18 01:45:16 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-18 01:45:16 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-06-18 01:50:20 apply-patch: `packages/workspace/SCRIPTS.md`

## workspace-owned: validation evidence

- red contract run: `trc_294359643a1c` showed expected failures before implementation: missing canonical context, old context leaves present, canonical facade returned NOT_FOUND. It also touched a snapshot during filtered Vitest execution, later restored.
- generation: `trc_4b3a7984b5ed` regenerated workspace and OS tool manifests, core manifests, docs, and generated types. Workspace full now 125 tools/core 13; OS full now 128 tools/core 13.
- focused green syntax + tests: `trc_254c67db09e6` passed node syntax checks for both context scripts, workspace tool-manifest tests (4), OS tool-manifest tests (12), and canonical context facade tests in workspace and OS.
- exact core/full assertion: `trc_0d9a73893681` confirmed both core manifests are exactly [batch, code.call, code.run, context, explore, fs.apply_patch, fs.trash, github, intent, review.run, stream.context, stream.sync, tools.search], old context leaves are absent from full and core, and context uses ContextInput with operation/flag arguments.
- snapshot refresh: `trc_8fe3e5d75cdc` refreshed only facade success/failure snapshots; `trc_1d43f6e29790` confirmed the snapshot subset passes without update mode; `trc_83ece44aadee` confirmed zero obsolete context.* snapshot keys and two canonical context snapshot keys per package.
- 2026-06-18 01:55:58 `review.run`: passed — OK
- 2026-06-18 01:57:22 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/collapse-context-tools-into-canonical-facade.json`, `.task/workspace-agents/collapse-context-tools-into-canonical-facade/current.json`, `.task/workspace-agents/collapse-context-tools-into-canonical-facade/evidence-log.json`, `.task/workspace-agents/collapse-context-tools-into-canonical-facade/read-log.json`, `.task/workspace-agents/collapse-context-tools-into-canonical-facade/session.json`, `.task/workspace-agents/collapse-context-tools-into-canonical-facade/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/context.js`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/scripts/context.js`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
