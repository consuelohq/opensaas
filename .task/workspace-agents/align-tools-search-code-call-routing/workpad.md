# align tools.search code.call routing

branch: `task/workspace-agents/align-tools-search-code-call-routing`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1133/align-tools-search-code-call-routing
github pr: https://github.com/consuelohq/opensaas/pull/1133
started: 2026-06-18

taskSession: `tsk_b9baff19f60b`

## acceptance criteria

- [x] `tools.search` routes programmable repo runtime work to `code.call` in both workspace and OS.
- [x] `code.call` routing only displaces generic `fs.search`, `fs.read`, `fs.list`, and generic `fs.write` when the query contains runtime/programmatic/structured-transformation intent.
- [x] Task and stream workflow tools remain preferred for task lifecycle queries.
- [x] `fs.apply_patch` remains preferred for anchored patch/apply/hunk queries.
- [x] Literal file operations still route to `fs.read`, `fs.search`, and `fs.list`.
- [x] Workspace and OS implementations stay aligned.
- [ ] Focused tests, review, verify, push, promote, and cleanup complete.

## Test-first contract

Behavior under test:
- Runtime/package/check queries such as `run bun package command`, `run tests package script`, `syntax typecheck package scripts`, and `exact cli reproduction` recommend `code.call`.
- Structured programmable file-work queries such as `structured file rewrite python`, `multi file transformation`, `inspect many files and summarize`, and `generate files with bun script` recommend `code.call`.
- Task workflow queries such as `task push changed files`, `task current existing branch worktree`, `merge git task branch conflict`, `finish completed task branch`, and `stream sync branch` recommend task/stream tools, not `code.call`.
- Literal file queries such as `read file lines`, `grep file contents for pattern`, `search codebase with rg`, and `list directory files` keep routing to fs tools.
- Patch queries such as `apply anchored patch` and `write patch file contents` prefer `fs.apply_patch`, with `fs.write` allowed as a secondary match.

Existing local pattern:
- `packages/workspace/tests/tools-search-v2.test.ts` runs the workspace script with embeddings disabled and asserts recommended tool/ranked names.
- `packages/workspace/scripts/tools-search.ts` and `packages/os/scripts/tools-search.ts` each define local alias maps and `INTENT_PACKS` arrays.
- OS has `packages/os/scripts/tools-search.ts` but no existing `packages/os/tests/tools-search-v2.test.ts`; this task should add equivalent OS coverage if the package test runner handles it.

New/changed tests:
- Extend workspace `tools-search-v2` tests with the code.call routing matrix and explicit workflow/fs/patch guardrails.
- Add OS `tools-search-v2` coverage mirroring the workspace routing expectations.

Focused red command:
- `bun --cwd packages/workspace test tests/tools-search-v2.test.ts`
- `bun --cwd packages/os test tests/tools-search-v2.test.ts`

Expected red failure:
- Current implementation has no `code.call` intent pack, so code.call does not reliably outrank generic fs tools for programmable runtime/structured transformation queries.
- Current task-cleanup intent may overfire for task/worktree words without cleanup intent.
- OS lacks the matching tools-search-v2 test file.

No-test waiver:
- None. This is behavior in tool discovery/ranking.

## exploration notes

- `context.search` for `tools.search code.call routing` returned no durable memory entries. Trace: `trc_1363cd30878b`.
- `explore` confirmed the relevant source owner is `packages/workspace/scripts/tools-search.ts`, with tests at `packages/workspace/tests/tools-search-v2.test.ts`, and a parallel OS implementation at `packages/os/scripts/tools-search.ts`. Trace: `trc_f978d71ca7aa`.
- Task-scoped read confirmed workspace has `tests/tools-search-v2.test.ts`; OS has `scripts/tools-search.ts` but no sibling `tests/tools-search-v2.test.ts`. Trace: `trc_45fac1526239`.

## implementation notes

- Added `code-call-runtime` and `code-call-structured-file-work` intent packs to both workspace and OS `tools-search.ts`.
- Added code.call-specific aliases for Bun/Python/Bash runtime, typecheck, codegen, structured packets, and codemod/rewrite language.
- Tightened `task-cleanup` so branch/worktree wording alone no longer recommends cleanup.
- Added `task-current` and `stream-sync` packs so lifecycle/workflow queries keep using task/stream tools.
- Narrowed `task-pr-create` so `stream` alone no longer recommends `task.pr`.
- Strengthened `fs-search` for `rg`/ripgrep/codebase search while demoting `tools.search` for that file-search intent.
- Strengthened `fs-write-patch` so patch/apply/anchor/hunk queries prefer `fs.apply_patch`; `fs.write` remains available for whole-file write/append/overwrite.
- Fixed the workspace `tools-search-v2` test harness to resolve the script and manifest relative to the package root.
- Added OS `tools-search-v2` coverage using exported `runToolSearch`.

## validation evidence

- Initial red was blocked by a pre-existing workspace test harness path bug; `bun --cwd packages/workspace test tests/tools-search-v2.test.ts` could not find `packages/workspace/scripts/tools-search.ts`. Trace: `trc_4c27a933b944`.
- After fixing the harness, meaningful red failed as expected: `run bun package command` recommended `office.run`, `task current existing branch worktree` recommended `task.cleanup`, and `search codebase with rg` recommended `tools.search`. Trace: `trc_acade2730f36`.
- First implementation pass fixed code.call and fs routing but still let `stream sync branch` recommend `task.pr`. Trace: `trc_f0f1694a5718`.
- Focused green passed: workspace `tools-search-v2` 10/10 and OS `tools-search-v2` 3/3. Trace: `trc_3ed344575d06`.
- Final focused packet passed: workspace `tools-search-v2` 10/10, OS `tools-search-v2` 3/3, and OS `tool-manifest` 14/14. Trace: `trc_c86deee16523`.

## files changed

- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/tests/tools-search-v2.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-18 05:49:10 fs.write: `.task/workspace-agents/align-tools-search-code-call-routing/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/tools-search.ts`
- `packages/workspace/scripts/tools-search.ts`

## workspace-owned: validation evidence

- Initial red was blocked by a pre-existing workspace test harness path bug; `bun --cwd packages/workspace test tests/tools-search-v2.test.ts` could not find `packages/workspace/scripts/tools-search.ts`. Trace: `trc_4c27a933b944`.
- After fixing the harness, meaningful red failed as expected: `run bun package command` recommended `office.run`, `task current existing branch worktree` recommended `task.cleanup`, and `search codebase with rg` recommended `tools.search`. Trace: `trc_acade2730f36`.
- First implementation pass fixed code.call and fs routing but still let `stream sync branch` recommend `task.pr`. Trace: `trc_f0f1694a5718`.
- Focused green passed: workspace `tools-search-v2` 10/10 and OS `tools-search-v2` 3/3. Trace: `trc_3ed344575d06`.
- Final focused packet passed: workspace `tools-search-v2` 10/10, OS `tools-search-v2` 3/3, and OS `tool-manifest` 14/14. Trace: `trc_c86deee16523`.
- 2026-06-18 06:02:10 `review.run`: passed — OK
- 2026-06-18 06:02:57 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/align-tools-search-code-call-routing.json`, `.task/workspace-agents/align-tools-search-code-call-routing/current.json`, `.task/workspace-agents/align-tools-search-code-call-routing/evidence-log.json`, `.task/workspace-agents/align-tools-search-code-call-routing/read-log.json`, `.task/workspace-agents/align-tools-search-code-call-routing/session.json`, `.task/workspace-agents/align-tools-search-code-call-routing/workpad.md`, `packages/os/scripts/tools-search.ts`, `packages/os/tests/tools-search-v2.test.ts`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/tests/tools-search-v2.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


## review and verify evidence

- `review.run` passed with 0 issues across the scoped workspace and OS files. Trace: `trc_306dda9645bd`.
- `verify` passed with `publishValid: true`. Trace: `trc_f7dc2b1b714b`.
- Verify selected zero suites, so manual focused tests are the test evidence for this task: `trc_c86deee16523`.
