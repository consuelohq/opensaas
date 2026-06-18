# fix intent wiring and code call descriptions

branch: `task/workspace-agents/fix-intent-wiring-and-code-call-descriptions`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1127/fix-intent-wiring-and-code-call-descriptions
github pr: https://github.com/consuelohq/opensaas/pull/1127
started: 2026-06-18

taskSession: `tsk_749a44a6bfcb`

## acceptance criteria

- [x] Root workspace facade can run `intent` through the repo-level package script without `Script not found "intent"`.
- [x] Workspace and OS intent manifest entries point at the correct runtime surface: `workspace intent` for workspace, `os intent` for OS.
- [x] `intent start --workflow task` returns the task workflow manifest bundle and first hook result from the correct package runtime.
- [x] `code.call` description is updated exactly in workspace and OS source manifests, generated full manifests, generated core manifests, docs, and generated type surfaces where applicable.
- [x] `code.call` example inputs in core/generated surfaces show the intended compact packet pattern rather than stale raw dumps.
- [x] Generated manifests/docs/types are regenerated after source manifest edits.
- [x] Focused red/green tests, review, and verify complete.
- [ ] Push, promote, and cleanup complete.

## requested code.call description

Run focused repo-scoped Python, Bun, or Bash programs where runtime output is the evidence: tests, package scripts, typechecks, syntax checks, exact CLI reproduction, small diagnostics, and bounded data shaping inside the active task worktree. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.

## exploration notes

- `stream.sync` after Ko merged prior changes passed, trace `trc_20fa3bf83318`.
- Task started from synced `stream/workspace-agents`, trace `trc_fc8fb513732f`, PR #1127.
- Reproduction: `bun run intent -- --help` fails at repo root with `Script not found "intent"`, trace `trc_f0497f77b11e`.
- Existing intent/hook unit tests pass, so the first bug is executable/package-script wiring rather than the runtime itself.
- Root `package.json` has no `intent` script. `packages/workspace/package.json` and `packages/os/package.json` already have package-local `intent` scripts.
- Workspace source manifest has `intent` underlying `workspace intent`; OS source manifest currently says `workspace intent`, which is incorrect for OS.
- `code.call` is a core tool in both packages, so changing its source description requires regenerating both full and core manifests, plus docs/types that include generated tool descriptions and examples.

## Test-first contract

Behavior under test:
- Root package scripts expose `intent` to `packages/workspace/scripts/intent.js` so the active workspace facade command resolves.
- `bun run intent -- --help` succeeds at repo root.
- `bun run intent -- start --workflow task --area workspace-agents --title <...> --json` succeeds and returns a task workflow bundle with `task.start`.
- Workspace manifest generation carries the exact requested `code.call` description into source/full/core and keeps workspace intent underlying as `workspace intent`.
- OS manifest generation carries the exact requested `code.call` description into source/full/core and fixes OS intent underlying to `os intent`.
- Generated docs/core manifests/examples update from source rather than hand edits.

Existing local pattern:
- `packages/workspace/tests/workflow-intent.test.ts` already tests package-local intent runtime and CLI behavior.
- `packages/workspace/tests/tool-manifest.test.ts` and `packages/os/tests/tool-manifest.test.ts` already assert core descriptions from source/full/core generated surfaces.
- `packages/os/tests/tool-manifest.test.ts` already has code.call public-surface expectations.

New/changed tests:
- Add root-level package script + root CLI smoke coverage to workspace workflow intent tests.
- Add exact `code.call` description assertions to workspace and OS expected core description maps.
- Add OS intent underlying assertion.
- Update OS public execution surface assertions to the new requested description and compact-packet example contract.

Focused red command:
- `bun --cwd packages/workspace test tests/workflow-intent.test.ts tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts`

Expected red failure:
- Root intent script is missing.
- `code.call` descriptions are stale in workspace and OS.
- OS intent underlying still says `workspace intent`.

No-test waiver:
- None. This changes runtime tool routing and core generated surfaces.

## implementation notes

- Added the repo-root `intent` script to route active workspace usage to `packages/workspace/scripts/intent.js`.
- Kept package-local intent scripts in both workspace and OS.
- Fixed OS intent source manifest runtime label from `workspace intent` to `os intent`.
- Updated `code.call` source descriptions in both workspace and OS to Ko's requested wording.
- Updated `code.call` examples in both packages to emit compact packets with `path`, `lineSpans`, and `snippets` rather than a raw dump / stale hello-world example.
- Regenerated workspace and OS tool manifests, core manifests, workflow bundles, docs, and generated type surfaces.
- Fixed an in-scope facade test helper path for `tools.search`; it incorrectly invoked `packages/workspace/scripts/tools-search.ts` from the package cwd, producing `packages/workspace/packages/workspace/...`.

## validation evidence

- Initial reproduction failed as expected: root `bun run intent -- --help` returned `Script not found "intent"`; existing package-local intent/hook tests passed. Trace: `trc_f0497f77b11e`.
- Focused red failed as expected after adding tests: missing root intent script, stale workspace `code.call` description/example. Trace: `trc_2df014a7211d`.
- Generated surfaces after source manifest edits. Trace: `trc_80a1deecc339`.
- Focused green passed: workspace workflow intent + tool manifest tests, OS tool manifest tests. Trace: `trc_5892143f8456`.
- Workspace root intent smoke passed in the task worktree: `bun run intent -- start --workflow task --area workspace-agents --title root intent smoke --json`, workflow `task`, includes `task.start`. Trace: `trc_6604bd564534`.
- OS package-local intent smoke passed: `bun run --cwd packages/os intent -- start --workflow task --area os --title os intent smoke --json`, workflow `task`, includes `task.start`. Trace: `trc_7dfbdf1a9031`.
- Exact surface assertion passed: workspace + OS source/full/core/docs descriptions match Ko's requested `code.call` text; examples include `lineSpans` and `snippets`; root intent script and intent underlying labels are correct. Trace: `trc_6c5ef72cc7ff`.
- In-scope facade regression fixed and passed: `tools.search ranks intent keywords...` plus `code.call` facade slice. Trace: `trc_d0cf2bedb2a8`.
- `review.run` passed with 0 issues and 0 pre-existing issues. Trace: `trc_c4bb0648ee6b`.
- `verify` passed with `publishValid: true`; selected workspace facade input contracts and workspace audit tests passed. Trace: `trc_96baba88fc70`.

## files changed

- `package.json`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/manifests/core-manifest.json`
- `packages/workspace/manifests/workflow-bundles.json`
- `packages/workspace/TOOLS.md`
- `packages/workspace/tests/workflow-intent.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/TOOLS.md`
- `packages/os/tests/tool-manifest.test.ts`
- `.task/workspace-agents/fix-intent-wiring-and-code-call-descriptions/workpad.md`

## key decisions

- Keep the repo-level `intent` command wired to workspace because the active connected app is workspace. Keep package-local OS `intent` available inside `packages/os` and label its manifest underlying as `os intent`.

## notes for Ko

- Yes, the core manifests need updates because `code.call` is in core for both workspace and OS, and the generated core manifests copy descriptions/examples from source.

## issues and recovery

- First post-generation validation hit a transient connector 503 before workspace execution; retried once and got normal test output.
- Live `workspace.call({ tool: "intent" })` still failed from the main checkout before this task was promoted, because the repo-root script change only existed in the task worktree at that point. Trace: `trc_8884ada73af9`. The task-worktree runtime smoke passed.
- The facade `tools.search` intent test exposed an adjacent cwd-sensitive test helper bug. Fixed by resolving the script path from `import.meta.dirname` and using package root as cwd.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): wire intent and code call docs" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: validation evidence

- Initial reproduction failed as expected: root `bun run intent -- --help` returned `Script not found "intent"`; existing package-local intent/hook tests passed. Trace: `trc_f0497f77b11e`.
- Focused red failed as expected after adding tests: missing root intent script, stale workspace `code.call` description/example. Trace: `trc_2df014a7211d`.
- Generated surfaces after source manifest edits. Trace: `trc_80a1deecc339`.
- Focused green passed: workspace workflow intent + tool manifest tests, OS tool manifest tests. Trace: `trc_5892143f8456`.
- Workspace root intent smoke passed in the task worktree: `bun run intent -- start --workflow task --area workspace-agents --title root intent smoke --json`, workflow `task`, includes `task.start`. Trace: `trc_6604bd564534`.
- OS package-local intent smoke passed: `bun run --cwd packages/os intent -- start --workflow task --area os --title os intent smoke --json`, workflow `task`, includes `task.start`. Trace: `trc_7dfbdf1a9031`.
- Exact surface assertion passed: workspace + OS source/full/core/docs descriptions match Ko's requested `code.call` text; examples include `lineSpans` and `snippets`; root intent script and intent underlying labels are correct. Trace: `trc_6c5ef72cc7ff`.
- In-scope facade regression fixed and passed: `tools.search ranks intent keywords...` plus `code.call` facade slice. Trace: `trc_d0cf2bedb2a8`.
- 2026-06-18 04:22:54 `review.run`: passed — OK
- 2026-06-18 04:23:22 `verify`: passed — OK
- 2026-06-18 04:29:19 `review.run`: passed — OK
- 2026-06-18 04:29:31 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-intent-wiring-and-code-call-descriptions.json`, `.task/workspace-agents/fix-intent-wiring-and-code-call-descriptions/current.json`, `.task/workspace-agents/fix-intent-wiring-and-code-call-descriptions/session.json`, `.task/workspace-agents/fix-intent-wiring-and-code-call-descriptions/verify.json`, `.task/workspace-agents/fix-intent-wiring-and-code-call-descriptions/workpad.md`, `package.json`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/workflow-intent.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
