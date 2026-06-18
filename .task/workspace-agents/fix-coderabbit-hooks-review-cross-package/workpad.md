# fix coderabbit hooks review cross package

branch: `task/workspace-agents/fix-coderabbit-hooks-review-cross-package`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1112/fix-coderabbit-hooks-review-cross-package
github pr: https://github.com/consuelohq/opensaas/pull/1112
taskSession: `tsk_4c0b0452f05f`
started: 2026-06-17

## acceptance criteria

- [ ] Read every CodeRabbit comment on stream PR #1110.
- [ ] For each comment, identify the underlying bug, risk, or requested change.
- [ ] Determine whether the issue exists in `packages/workspace`.
- [ ] Determine whether the same issue exists in `packages/os`.
- [ ] Fix workspace only where the issue actually applies.
- [ ] Fix OS only where the issue actually applies.
- [ ] Keep OS and workspace aligned where the hooks architecture is intentionally shared.
- [ ] Preserve intentional package differences where the systems diverge.
- [ ] Add or update focused tests before production edits when behavior changes.
- [ ] Record not-applicable judgments explicitly in this workpad.
- [ ] Regenerate manifests/docs/types if manifest, schema, workflow, or generated surfaces change.
- [ ] Run focused workspace tests and OS tests for every touched surface.
- [ ] Run `review.run` against `origin/stream/workspace-agents`.
- [ ] Run `verify` against `origin/stream/workspace-agents` and require `publishValid: true`.
- [ ] Push and promote the task into stream PR #1110.
- [ ] Report the stream PR URL.

## Test-first contract

Behavior under test:
- Pending PR review comment discovery. Each CodeRabbit item will get a behavior contract before production edits.

Existing local pattern to follow:
- `packages/workspace/hooks/**`, `packages/workspace/scripts/*hook*`, `packages/workspace/tests/*hook*`, `packages/workspace/tests/workflow-intent.test.ts`.
- Analogous OS implementations and tests only where the same issue is real.

New or changed tests:
- Pending discovery from CodeRabbit comments.

Focused red command:
- Pending discovery from CodeRabbit comments.

Expected red failure:
- Pending discovery from CodeRabbit comments.

No-test waiver:
- None yet. If a comment is docs/generated-only or does not change behavior, record the waiver under that comment.

## plan

1. Fetch stream PR #1110 review comments through typed PR/GitHub review tooling.
2. Group CodeRabbit comments by underlying issue; do not treat duplicates as separate product bugs.
3. Inspect workspace implementation and tests for each issue.
4. Inspect analogous OS implementation and tests where architecture is shared.
5. Update this workpad with the issue matrix and test-first contracts before production edits.
6. Write or update focused tests, run red, implement, then run green.
7. Regenerate generated surfaces only when source manifest/schema/workflow changes.
8. Run focused validation for touched workspace and OS surfaces, then `review.run`, `verify`, `task.push`, and `task.pr`.

## current status

- Task started from `stream/workspace-agents`.
- Direct `stream.context` wrapper was blocked by the platform safety layer; equivalent stream context was fetched through approved `code.call` Bun read-mode workaround.
- Next: read PR #1110 CodeRabbit review comments.

## files changed

- `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`

## CodeRabbit issue matrix

Pending PR review comment discovery.

## workspace-owned: files changed

- `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`

## workspace-owned: activity log

- 2026-06-17 17:05:50 fs.write: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`
- 2026-06-17 17:09:57 fs.write: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`
- 2026-06-17 17:22:31 fs.write: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`
- 2026-06-17 17:24:31 fs.write: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`
- Task created via `task.start` from stream.
- Workpad initialized with acceptance criteria and test-first scaffold.

## workspace-owned: validation evidence

- 2026-06-17 17:23:41 `review.run`: passed — OK
- 2026-06-17 17:24:04 `verify`: passed — OK

## key decisions

- Start from stream because this task is a direct review-fix follow-up to PR #1110.
- Use PR comments as source of truth for review resolution.
- Avoid `context.search` as the first discovery path per handoff; use PR review comments, local file reads, `explore`, and targeted repo searches.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Direct `stream.context` returned an OpenAI safety wrapper block. Used the exact Bun `code.call` workaround from the handoff and fetched stream context successfully.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): address hooks review feedback" --changed
bun run task:pr
```

- 2026-06-17 17:05:50 write: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/task-start.js`
- `packages/os/tests/tool-manifest.test.ts`

## CodeRabbit issue matrix — verified against current code

1. `packages/workspace/hooks/task/guidance.js` default timeout unit mismatch: valid in workspace and OS. `defaultTimeoutForTool()` returns `300000` for long-running tools and `120` for the default in both packages. Fix both to milliseconds.
2. `packages/workspace/hooks/task/workflow.js` `changedFiles.join()` without an array guard: valid in workspace and OS. Malformed event state can throw before hook guidance returns. Fix both with an `Array.isArray` guard.
3. `packages/workspace/scripts/generate-tool-manifest.ts` workflow `sourceManifest` ignores an overridden `fullOutputPath` unless `workflowsOutputPath` is also set: valid in workspace and OS. Fix both generators to use the actual `fullOutputPath`.
4. `packages/workspace/scripts/intent.js` unknown action falls through to `start`: valid in workspace and OS. Fix both CLI parsers to reject any action other than `start` or `dispatch`.
5. `packages/workspace/scripts/task-start.js` post-start hook guidance can fail an already-successful `task:start`: valid in workspace and OS. Fix both by making hook dispatch/render best-effort for non-JSON callers.
6. `packages/workspace/tests/task-hook-dispatcher.test.ts` `spawnSync` calls lack subprocess timeouts: valid in workspace and OS tests. Fix both test files with bounded timeouts.
7. `packages/workspace/tests/tool-manifest.test.ts` override-output test lets workflows write to the default manifest path: valid in workspace and OS tests. Fix both tests to put workflow output under the fixture and assert sourceManifest follows overridden full output.
8. `packages/workspace/server.py` `get_steering` docstring still says tool manifest although `_read_steering()` appends the core manifest: valid in workspace only. OS `get_steering` already has its own accurate docstring and different steering composition.

## Test-first contract — CodeRabbit review fixes

Behavior under test:
- Hook guidance action timeouts are consistently milliseconds in workspace and OS.
- Task workflow validation guidance tolerates malformed `changedFiles` state and falls back to `<unknown>`.
- Manifest generators use overridden full manifest paths as workflow bundle `sourceManifest`, and override-output tests do not write workflow bundles to package manifests.
- Intent CLI rejects unknown actions instead of executing `start`.
- `task:start` source keeps post-start hook guidance best-effort after successful side effects.
- CLI subprocess tests are bounded to avoid indefinite hangs.
- Workspace steering docstring names the core manifest behavior.

Existing local pattern to follow:
- Workspace and OS hook tests are intentionally parallel except for `workspace.call` vs `os.call`, area names, manifest file names, and bundle kind names.
- Manifest generator tests already use fixture directories for override outputs.
- Dispatcher tests already inspect the task-start script source for hook guidance wiring.

New or changed tests:
- `packages/workspace/tests/task-hooks.test.ts`
- `packages/os/tests/task-hooks.test.ts`
- `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- `packages/os/tests/task-hook-workflow-contract.test.ts`
- `packages/workspace/tests/workflow-intent.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/workspace/tests/task-hook-dispatcher.test.ts`
- `packages/os/tests/task-hook-dispatcher.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

Focused red commands:
- `bun --cwd packages/workspace test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts`

Expected red failure:
- New assertions fail on timeout values, malformed changedFiles handling, unknown intent action rejection, task-start best-effort source guard, workflow sourceManifest override behavior, and missing workflow fixture output override.

No-test waiver:
- Workspace `server.py` docstring is metadata/docs-only. Validation replacement: Python compile and existing workspace server tests if touched validation scope requires it.

- 2026-06-17 17:09:57 append: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`

- 2026-06-17 17:10:35 apply-patch: `packages/workspace/tests/task-hooks.test.ts`
- 2026-06-17 17:10:56 apply-patch: `packages/os/tests/task-hooks.test.ts`
- 2026-06-17 17:12:20 apply-patch: `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- 2026-06-17 17:12:26 apply-patch: `packages/os/tests/task-hook-workflow-contract.test.ts`
- 2026-06-17 17:12:48 apply-patch: `packages/workspace/tests/workflow-intent.test.ts`
- 2026-06-17 17:13:00 apply-patch: `packages/os/tests/workflow-intent.test.ts`
- 2026-06-17 17:13:34 apply-patch: `packages/workspace/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:14:07 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:14:11 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:14:20 apply-patch: `packages/workspace/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:14:25 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:14:51 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-06-17 17:15:16 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-06-17 17:16:08 apply-patch: `packages/workspace/hooks/task/guidance.js`
- 2026-06-17 17:16:21 apply-patch: `packages/os/hooks/task/guidance.js`
- 2026-06-17 17:16:42 apply-patch: `packages/workspace/scripts/generate-tool-manifest.ts`
- 2026-06-17 17:17:16 apply-patch: `packages/os/scripts/generate-tool-manifest.ts`
- 2026-06-17 17:17:32 apply-patch: `packages/workspace/hooks/task/workflow.js`
- 2026-06-17 17:18:01 apply-patch: `packages/os/hooks/task/workflow.js`
- 2026-06-17 17:18:23 apply-patch: `packages/workspace/scripts/intent.js`
- 2026-06-17 17:18:23 apply-patch: `packages/os/scripts/intent.js`
- 2026-06-17 17:19:02 apply-patch: `packages/workspace/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:19:02 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-06-17 17:19:42 apply-patch: `packages/workspace/scripts/task-start.js`
- 2026-06-17 17:20:04 apply-patch: `packages/os/scripts/task-start.js`
- 2026-06-17 17:20:26 apply-patch: `packages/workspace/server.py`
## review resolution summary

Resolved CodeRabbit issue matrix:

1. Timeout units: workspace and OS fixed. Default hook guidance timeout now returns `120000` ms; long-running tool timeout remains `300000` ms.
2. `changedFiles` guard: workspace and OS fixed. Validation hook now uses `Array.isArray(state.changedFiles)` and falls back to `<unknown>`.
3. Workflow source manifest override: workspace and OS fixed. Workflow bundles now use the actual `fullOutputPath` as `sourceManifest`.
4. Unknown intent action: workspace and OS fixed. CLI rejects non-`start`/`dispatch` actions with `unknown action: ...`.
5. Post-start hook guidance failure: workspace and OS fixed. Non-JSON task-start hook guidance is best-effort; failures warn and do not fail successful task-start side effects.
6. Test subprocess timeouts: workspace and OS fixed. Dispatcher CLI subprocess calls have `timeout: 10_000`.
7. Manifest override test side effect: workspace and OS fixed. Override tests write workflow bundles into fixture paths and assert overridden sourceManifest.
8. Workspace steering docstring: workspace-only fix. OS not applicable because its `get_steering` docstring already accurately describes a different OS steering payload.

Red evidence:

- `bun --cwd packages/workspace test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts` failed before production edits as expected: 5 failing tests covering timeout units, malformed changedFiles, workflow sourceManifest override, unknown intent action, and task-start best-effort source guard.
- `bun --cwd packages/os test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts` failed before production edits as expected: 5 failing tests covering the same shared issues.

Green evidence:

- `bun --cwd packages/workspace test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts` passed: 5 files, 25 tests.
- `bun --cwd packages/os test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts` passed: 5 files, 32 tests.
- `bun run --cwd packages/workspace generate-tool-manifest` passed: wrote 130 full tools, 52 core tools, 2 workflow bundles.
- `bun run --cwd packages/os generate-tool-manifest` passed: wrote 133 full tools, 52 core tools, 2 workflow bundles.
- `python3 -m py_compile packages/workspace/server.py` passed.

## current status update

- All CodeRabbit comments read and mapped.
- Shared workspace/OS issues fixed in both packages.
- Workspace-only steering docstring fixed only in workspace.
- Focused tests and generation are green.
- Next: run review and verify against `origin/stream/workspace-agents`, then push/promote.

## files changed update

Workspace:
- `packages/workspace/hooks/task/guidance.js`
- `packages/workspace/hooks/task/workflow.js`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/intent.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/server.py`
- `packages/workspace/tests/task-hook-dispatcher.test.ts`
- `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- `packages/workspace/tests/task-hooks.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tests/workflow-intent.test.ts`

OS:
- `packages/os/hooks/task/guidance.js`
- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/intent.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-hook-dispatcher.test.ts`
- `packages/os/tests/task-hook-workflow-contract.test.ts`
- `packages/os/tests/task-hooks.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/workflow-intent.test.ts`

- 2026-06-17 17:22:31 append: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-coderabbit-hooks-review-cross-package.json`, `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/current.json`, `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/evidence-log.json`, `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/read-log.json`, `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/session.json`, `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`, `packages/os/hooks/task/guidance.js`, `packages/os/hooks/task/workflow.js`, `packages/os/scripts/generate-tool-manifest.ts`, `packages/os/scripts/intent.js`, `packages/os/scripts/task-start.js`, `packages/os/tests/task-hook-dispatcher.test.ts`, `packages/os/tests/task-hook-workflow-contract.test.ts`, `packages/os/tests/task-hooks.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tests/workflow-intent.test.ts`, `packages/workspace/hooks/task/guidance.js`, `packages/workspace/hooks/task/workflow.js`, `packages/workspace/scripts/generate-tool-manifest.ts`, `packages/workspace/scripts/intent.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/server.py`, `packages/workspace/tests/task-hook-dispatcher.test.ts`, `packages/workspace/tests/task-hook-workflow-contract.test.ts`, `packages/workspace/tests/task-hooks.test.ts`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/workflow-intent.test.ts`
- matched rules: `workspace-task-session`
- selected suites: `workspace task session tests`
- run results: `workspace task session tests` passed
- failed suites: none

## final validation evidence

- `review.run` against `origin/stream/workspace-agents` passed.
  - Checks: static rules, eslint, typecheck, spec compliance.
  - My changes: 0 issues.
  - Pre-existing: 1 `ERROR_HANDLING` finding in `packages/os/scripts/task-start.js` line 267, reported as pre-existing by review.
- `verify` against `origin/stream/workspace-agents` passed with `publishValid: true`.
  - Review passed.
  - DB guard passed with 0 risks and 0 findings.
  - Selected registry suite passed: `bun test packages/workspace/tests/task-session.test.js packages/workspace/tests/task-meta.test.ts` — 12 tests passed.

## acceptance criteria status

- [x] Read every CodeRabbit comment on stream PR #1110.
- [x] Identified each underlying issue.
- [x] Checked workspace and OS applicability for each issue.
- [x] Fixed workspace where applicable.
- [x] Fixed OS where applicable.
- [x] Preserved OS/workspace differences where intentional.
- [x] Added/updated focused tests before production edits for behavior changes.
- [x] Recorded not-applicable judgment for workspace-only steering docstring.
- [x] Regenerated manifest outputs where generator behavior changed.
- [x] Ran focused workspace and OS tests.
- [x] Ran `review.run` against `origin/stream/workspace-agents`.
- [x] Ran `verify` against `origin/stream/workspace-agents` with `publishValid: true`.
- [ ] Push and promote into stream PR #1110.
- [ ] Report stream PR URL.

- 2026-06-17 17:24:31 append: `.task/workspace-agents/fix-coderabbit-hooks-review-cross-package/workpad.md`
