# update code call description

branch: `task/workspace-agents/update-code-call-description`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1126/update-code-call-description
github pr: https://github.com/consuelohq/opensaas/pull/1126
started: 2026-06-18

taskSession: `tsk_896bdd1fc7f3`

## acceptance criteria

- [ ] Update only `code.call` descriptions in workspace and OS source manifests to Ko's requested text.
- [ ] Regenerate generated full/core manifests and generated docs/types as needed.
- [ ] Confirm generated workspace and OS full/core manifests carry the exact text.
- [ ] Do not change `code.run` description or implementation in this task.
- [ ] Run focused red/green manifest tests, exact generated verification, review, verify, push, promote, cleanup.

## requested code.call description

`Run focused repo-scoped Python, Bun, or Bash programs where runtime output is the evidence: tests, package scripts, typechecks, syntax checks, exact CLI reproduction, small diagnostics, and bounded data shaping inside the active task worktree. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.`

## code.run discussion notes

- Cloudflare Code Mode converts tool schemas into a TypeScript API and exposes one code-execution tool to the model.
- The sandboxed code calls the typed API, which dispatches through the supervisor/RPC layer to real tools.
- This task does not modify `code.run`; only the `code.call` description is locked in.

## Test-first contract

Behavior under test:
- Workspace source/full/core manifests expose the exact requested `code.call` description.
- OS source/full/core manifests expose the exact requested `code.call` description.
- Existing `code.run` descriptions remain unchanged.

Existing local pattern:
- `packages/workspace/tests/tool-manifest.test.ts` and `packages/os/tests/tool-manifest.test.ts` already maintain Ko-owned expected descriptions for full/core manifests.
- `packages/*/tooling/*tool-manifest.json` are the source manifests; generated full/core manifests and docs are derived from them.

New/changed tests:
- Extend `expectedDescriptions` in both manifest test files with `code.call`.

Focused red command:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts`

Expected red failure:
- Current workspace source manifest still has the old short `code.call` description.
- Current OS source manifest still has the older OS-specific `code.call` description.

No-test waiver:
- None. Description propagation is already covered by focused manifest tests.


## red evidence

- Focused red tests failed as expected. Trace: `trc_a1343f00ccb9`.
- Workspace failed on old `code.call` description: `run short language-specific code through staged Python, Bun, or Bash backends`.
- OS failed on old `code.call` description: `preferred repo-scoped execution tool ...`.

## implementation notes

- Updated `code.call` description in source manifests only:
  - `packages/workspace/tooling/tool-manifest.json`
  - `packages/os/tooling/dev-tool-manifest.json`
- Regenerated workspace and OS generated tool manifests, core manifests, workflow bundles, docs, and type stubs.
- Regeneration trace: `trc_ae8e7e725c5c`.
- No `code.run` description or implementation was changed.

## green evidence

- Focused manifest tests passed. Trace: `trc_8f7daccfe488`.
  - Workspace manifest tests: 4 passed.
  - OS manifest tests: 12 passed.
- Exact description verification passed. Trace: `trc_e41e57952fd8`.
  - Workspace source/full/core `code.call` descriptions match the requested text.
  - OS source/full/core `code.call` descriptions match the requested text.
  - Workspace and OS `code.run` descriptions are unchanged.

## code.run inspection notes

- `packages/*/scripts/code-run.ts` executes code with `buildToolRegistry`, `execute`, operation tracking, result/console truncation, and blocked nested tools.
- `packages/*/scripts/lib/codemode/executor.ts` creates a runtime that can inject tool helpers into generated code. It uses `isolated-vm` when available outside Bun and falls back to a Bun-compatible function runtime inside Bun.
- `packages/*/scripts/lib/codemode/tools/index.ts` builds a `workspace` API from manifest entries and dispatches calls through the facade executor.
- Inspection traces: `trc_4ec64fca24d1`, `trc_a2634393e095`.

## acceptance criteria final before review

- [x] Update only `code.call` descriptions in workspace and OS source manifests.
- [x] Regenerate generated full/core manifests and generated docs/types as needed.
- [x] Confirm generated workspace and OS full/core manifests carry the exact text.
- [x] Do not change `code.run` description or implementation in this task.
- [x] Run focused red/green manifest tests and exact generated verification.
- [ ] Run review/verify.
- [ ] Push/promote/cleanup.

## workspace-owned: validation evidence

- 2026-06-18 04:08:07 `review.run`: passed — OK
- 2026-06-18 04:08:59 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/update-code-call-description.json`, `.task/workspace-agents/update-code-call-description/current.json`, `.task/workspace-agents/update-code-call-description/session.json`, `.task/workspace-agents/update-code-call-description/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none


## review and verify evidence

- `review.run` passed against `origin/stream/workspace-agents` with 0 issues and 0 pre-existing issues. Trace: `trc_7a0116678a94`.
- `verify` passed against `origin/stream/workspace-agents` with `publishValid: true`. Trace: `trc_5a26e59fcf97`.
- Verify-selected suites passed:
  - `workspace facade input contracts`: 125 tests passed.
  - `workspace audit tests`: 1 test passed.
- DB guard passed with 0 risks and 0 findings.

## acceptance criteria final before publish

- [x] Updated only `code.call` descriptions in workspace and OS source manifests.
- [x] Regenerated generated full/core manifests and generated docs/types as needed.
- [x] Confirmed generated workspace and OS full/core manifests carry the exact text.
- [x] Did not change `code.run` description or implementation.
- [x] Ran focused red/green manifest tests, exact generated verification, review, and verify.
- [ ] Push/promote/cleanup.
