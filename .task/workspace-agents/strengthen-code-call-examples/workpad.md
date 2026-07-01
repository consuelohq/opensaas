# strengthen code.call examples

branch: `task/workspace-agents/strengthen-code-call-examples`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/1134
started: 2026-06-18

taskSession: `tsk_699522c27fd5`

## acceptance criteria

- [x] Identify why the previous manifest diff showed escaped multiline source blobs.
- [x] Replace the weak generated docs/types example with a stronger non-repo-specific repository impact analysis packet.
- [x] Preserve the handoff's exact stronger examples for focused tests, exact verification, repo comparison, and structured task writes.
- [x] Add another Python example and keep the AST/string-heavy Python edit example visible.
- [x] Make long examples use `codeFile` so generated JSON diffs stay compact.
- [x] Regenerate manifests and run focused tests.
- [ ] Review and verify complete; push, promote, and cleanup pending.

## root cause

The weird GitHub diff lines were not a `code.call` runtime pipe issue. They came from storing long multiline programs in JSON `input.code` strings. JSON must escape newlines, so generated manifest diffs show large `\n` string blobs. The fix is to keep long programs as repo files and point examples at them with `codeFile`.

## validation evidence

- Red focused manifest tests failed as expected after tightening assertions: trace `trc_fd9203d59540`; old manifests still used the generated docs/types label and inline code strings.
- Regenerated workspace and OS tool/core/workflow manifests plus docs/types: trace `trc_63b7548016b7`.
- Focused manifest tests passed for workspace and OS after codeFile migration: trace `trc_db86e8001468`.
- Example syntax checks passed for Bun and Python example files with bytecode redirected outside the repo: trace `trc_13366c838109`.
- Exact manifest surface assertion passed across workspace and OS source/full/core/workflow surfaces: trace `trc_b8fab22831a9`.
- Diff inspection found escaped inline-code blobs only on removed lines, not added lines: trace `trc_5de06be0a941`.

## files changed

- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/manifests/core-manifest.json`
- `packages/workspace/manifests/workflow-bundles.json`
- `packages/workspace/TOOLS.md`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/TOOLS.md`
- `packages/os/tests/tool-manifest.test.ts`
- `scripts/code-call-examples/*`

## workspace-owned: validation evidence

- Red focused manifest tests failed as expected after tightening assertions: trace `trc_fd9203d59540`; old manifests still used the generated docs/types label and inline code strings.
- Regenerated workspace and OS tool/core/workflow manifests plus docs/types: trace `trc_63b7548016b7`.
- Focused manifest tests passed for workspace and OS after codeFile migration: trace `trc_db86e8001468`.
- Example syntax checks passed for Bun and Python example files with bytecode redirected outside the repo: trace `trc_13366c838109`.
- Exact manifest surface assertion passed across workspace and OS source/full/core/workflow surfaces: trace `trc_b8fab22831a9`.
- Diff inspection found escaped inline-code blobs only on removed lines, not added lines: trace `trc_5de06be0a941`.
- 2026-06-18 06:06:04 `review.run`: passed — OK
- 2026-06-18 06:12:33 `review.run`: passed — OK
- 2026-06-18 06:12:46 `verify`: passed — OK

## trace-watch follow-up

Ko pointed out that synthetic `code.call step` rows looked like a function/tool and showed `0 tokens`, and failed test packets showed generic `COMMAND_FAILED`.

Findings:
- The facade/runtime still correctly uses generic `COMMAND_FAILED` for non-zero process exits.
- The nested `0 tokens` display came from `trace-watch` constructing synthetic child rows with token fields explicitly set to zero.
- The child row is not a separate tool/function call; it is a command result extracted from a `code.call` stdout `results[]` packet.

Changes:
- Rename synthetic child rows from `code.call step` to `code.call cmd`.
- Preserve nested token counts when result packets include `inputTokens`, `outputTokens`, or `totalTokens`.
- Avoid inventing `0 tokens` for nested command results with no token fields.
- Render failed Bun/Jest/Vitest test command packets as `TESTS_FAILED` / `tests failed` in trace-watch, while leaving the underlying facade envelope generic.

Validation:
- Trace-watch tests passed with 8 tests: trace `trc_4eb73a930820`.
- Focused watcher + manifest packet passed: trace `trc_4e61fc90b398`.

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/strengthen-code-call-examples.json`, `.task/workspace-agents/strengthen-code-call-examples/current.json`, `.task/workspace-agents/strengthen-code-call-examples/session.json`, `.task/workspace-agents/strengthen-code-call-examples/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/trace-watch.test.ts`, `packages/workspace/tooling/tool-manifest.json`, `scripts/code-call-examples/exact-manifest-description-verification.ts`, `scripts/code-call-examples/multi-package-focused-tests.ts`, `scripts/code-call-examples/python-semantic-test-mutation.py`, `scripts/code-call-examples/python-test-assertion-audit.py`, `scripts/code-call-examples/repository-impact-analysis.ts`, `scripts/code-call-examples/structured-repo-read-compare.ts`, `scripts/code-call-examples/structured-snippet-read.ts`, `scripts/code-call-examples/task-scoped-structured-file-rewrite.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `workspace-facade`, `trace-watch`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `trace watch build`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `trace watch build` passed, `workspace audit tests` passed
- failed suites: none

## final validation

- Review passed with 0 own issues and 0 pre-existing issues: trace `trc_07af8135dd9f`.
- Verify passed with `publishValid: true`: trace `trc_4ed393d8494d`.
- Verify-selected suites passed: workspace facade input contracts, trace watch build, workspace audit tests.
