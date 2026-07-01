# add task session selector and verify reports

branch: `task/os-skills/add-task-session-selector-and-verify-reports`
stream: `stream/os-skills`
taskSession: `tsk_c3ac05f2eb44`
task pr: https://app.graphite.com/github/pr/consuelohq/opensaas/798/add-task-session-selector-and-verify-reports
github pr: https://github.com/consuelohq/opensaas/pull/798

## acceptance criteria

- [x] Add raw CLI `task:push --task-session <id>` as a task selector only.
- [x] Preserve all verify, stamp, branch, sync, and approval checks.
- [x] Fix verify task-scoped report metadata behavior without weakening publish-valid semantics.
- [x] Add docs-check coverage to verify where appropriate while keeping repo-wide red failures red.
- [x] Inspect prior `task.push` traces and record failure patterns.
- [x] Add focused tests.

## trace evidence

Recent `task.push` traces show the facade already resolves top-level task sessions correctly. Repeated failures are missing scoped verify stamps after red full verify. Examples include `trc_803bdd220f82`, `trc_4742adffdc00`, and `trc_cfe130b65be9`. Some later pushes use explicit approval and emit `DANGEROUS PUSH BYPASS USED`. Other failures include local/remote branch sync mismatch, which remains a hard failure.

## implemented behavior

- `parseTaskSelectorPrefix` and task selection now understand `--task-session <id>`.
- `task.push` raw CLI help and parser now accept `--task-session <id>` as a selector only.
- `task.push` still calls `getVerifyStampMismatch` before pushing and passes active task metadata so scoped verify paths are checked.
- `verification.js` now resolves scoped verify paths: `.task/<area>/<task-slug>/verify.json`, with legacy root fallback for reads only.
- `verify` now runs docs checks when changed files include `packages/consuelo-docs/**` docs-like files.
- `verify` writes a task-scoped verify report whenever stamping is enabled and task metadata exists. The report has `result: pass` only when all gates pass; otherwise `result: fail` and `task.push` rejects it.
- Generated OS tool manifests and `TOOLS.md` were regenerated so `task.push` exposes `taskSession` forwarding to `--task-session`.

## files changed

- `.task/os-skills/add-task-session-selector-and-verify-reports/workpad.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/scripts/lib/task-meta.js`
- `packages/os/scripts/lib/task-selection.js`
- `packages/os/scripts/lib/verification.js`
- `packages/os/scripts/task-push.js`
- `packages/os/scripts/verify.js`
- `packages/os/tests/task-meta.test.js`
- `packages/os/tests/task-selection.test.js`
- `packages/os/tests/verification.test.js`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/TOOLS.md`

## test-first contract

Behavior under test:

- Raw `task:push --task-session <id>` resolves the same scoped task metadata as facade top-level `taskSession`, then uses the existing push path and existing verify enforcement.
- `verify` records task-scoped metadata/report information even when publish-valid remains false, but only writes a publish-valid stamp when all required gates pass.
- Docs checks can be represented in verify, but repo-wide red state still makes verify fail.

Focused red command:

```bash
bun --cwd packages/os test tests/task-selection.test.js tests/verification.test.js
```

Red result:

- `turn42`: 5 expected failures for missing task-session selection and root verify stamp paths.

## validation evidence

- `trc_9ab54be80a93` — focused green: `bun --cwd packages/os test tests/task-selection.test.js tests/verification.test.js`, 5 tests passed.
- `trc_68f7a5a69e11` — regenerated tool manifest: `bun packages/os/scripts/generate-tool-manifest.ts`.
- `trc_d05f71706f2b` — regenerated OS tool docs: `bun packages/os/scripts/generate-docs.ts`.
- `trc_56bff29b3ffe` — focused suite: `bun --cwd packages/os test tests/task-session.test.js tests/task-selection.test.js tests/verification.test.js tests/tool-manifest.test.ts`, 21 tests passed.
- `trc_aba8ccd162c3` and `trc_8c1bc3fb0b07` — `bun run --cwd packages/os typecheck`, workspace script syntax checks passed.
- `trc_de925cc88f2f` — `git diff --check` passed.
- `git.diff` inspected after edits; 15 changed files at last stat.

## current status

Implementation and focused validation are complete. Next: run `review.run` and `verify`. Verify is expected to remain red if repo-wide gates are red; the important new behavior is that it should write a scoped report with `result: fail`, not a publish-valid pass stamp.

## notes for Ko

This task does not make `verify` green when repo-wide gates are red, and it does not add a skip-check path. `--task-session` is selection/disambiguation only.

- 2026-06-05 08:26:17 write: `.task/os-skills/add-task-session-selector-and-verify-reports/workpad.md`

## workspace-owned: files changed

- `.task/os-skills/add-task-session-selector-and-verify-reports/workpad.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/scripts/lib/task-meta.js`
- `packages/os/scripts/lib/task-selection.js`
- `packages/os/scripts/lib/verification.js`
- `packages/os/scripts/task-push.js`
- `packages/os/scripts/verify.js`
- `packages/os/tests/task-meta.test.js`
- `packages/os/tests/task-selection.test.js`
- `packages/os/tests/verification.test.js`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/TOOLS.md`

## workspace-owned: activity log

- 2026-06-05 08:26:17 fs.write: `.task/os-skills/add-task-session-selector-and-verify-reports/workpad.md`
- 2026-06-05 08:28:09 fs.write: `packages/os/tests/task-meta.test.js`
- 2026-06-05 08:32:59 fs.write: `packages/os/tests/verification.test.js`
- 2026-06-05 08:34:29 fs.write: `packages/os/tests/task-meta.test.js`
- 2026-06-05 08:36:19 fs.patch: `packages/os/scripts/lib/task-meta.js`
- 2026-06-05 08:46:01 fs.patch: `packages/os/scripts/lib/task-meta.js`
- 2026-06-05 08:46:57 fs.patch: `packages/os/scripts/lib/task-meta.js`

## workspace-owned: validation evidence

- `trc_9ab54be80a93` — focused green: `bun --cwd packages/os test tests/task-selection.test.js tests/verification.test.js`, 5 tests passed.
- `trc_68f7a5a69e11` — regenerated tool manifest: `bun packages/os/scripts/generate-tool-manifest.ts`.
- `trc_d05f71706f2b` — regenerated OS tool docs: `bun packages/os/scripts/generate-docs.ts`.
- `trc_56bff29b3ffe` — focused suite: `bun --cwd packages/os test tests/task-session.test.js tests/task-selection.test.js tests/verification.test.js tests/tool-manifest.test.ts`, 21 tests passed.
- `trc_aba8ccd162c3` and `trc_8c1bc3fb0b07` — `bun run --cwd packages/os typecheck`, workspace script syntax checks passed.
- `trc_de925cc88f2f` — `git diff --check` passed.
- `git.diff` inspected after edits; 15 changed files at last stat.
- 2026-06-05 08:26:53 `review.run`: passed — OK
- 2026-06-05 08:49:06 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/scripts/lib/task-meta.js`
- `packages/os/scripts/lib/task-selection.js`
- `packages/os/tests/verification.test.js`
- `packages/workspace/scripts/lib/verification.js`

## workspace-owned: TDD red evidence

- 2026-06-05 08:28:32 `bun --cwd packages/os test tests/task-meta.test.js`: failed exit 1 trace: `trc_05758ffc2744`
  - output: ale": false, } [31m+ Received:[39m null [36m [2m❯[22m tests/task-meta.test.js:[2m35:18[22m[39m [90m 33| [39m const result = findTaskMeta(repoRoot, { currentBranch: 'task/os-skil… [90m 34| [39m [90m 35| [39m [34mexpect[39m(result)[33m.[39m[34mtoMatchObject[39m({ [90m | [39m [31m^[39m [90m 36| [39m path[33m:[39m taskPath[33m,[39m [90m 37| [39m dir[33m:[39m repoRoot[33m,[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-05 08:32:59 write: `packages/os/tests/verification.test.js`

- 2026-06-05 08:34:29 write: `packages/os/tests/task-meta.test.js`

- 2026-06-05 08:36:19 patch lines 81-86: `packages/os/scripts/lib/task-meta.js`

- 2026-06-05 08:46:01 patch lines 166-210: `packages/os/scripts/lib/task-meta.js`

- 2026-06-05 08:46:57 patch lines 217-218: `packages/os/scripts/lib/task-meta.js`

## workspace-owned: test selection

- changed files: `.task/os-skills/add-task-session-selector-and-verify-reports/current.json`, `.task/os-skills/add-task-session-selector-and-verify-reports/evidence-log.json`, `.task/os-skills/add-task-session-selector-and-verify-reports/read-log.json`, `.task/os-skills/add-task-session-selector-and-verify-reports/session.json`, `.task/os-skills/add-task-session-selector-and-verify-reports/verify.json`, `.task/os-skills/add-task-session-selector-and-verify-reports/workpad.md`, `.task/tasks/os-skills/add-task-session-selector-and-verify-reports.json`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/lib/task-meta.js`, `packages/os/scripts/lib/task-selection.js`, `packages/os/scripts/lib/verification.js`, `packages/os/scripts/task-push.js`, `packages/os/scripts/verify.js`, `packages/os/tests/task-meta.test.js`, `packages/os/tests/task-selection.test.js`, `packages/os/tests/verification.test.js`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
