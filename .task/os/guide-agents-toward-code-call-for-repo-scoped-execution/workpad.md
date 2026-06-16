# guide agents toward code.call for repo-scoped execution

branch: `task/os/guide-agents-toward-code-call-for-repo-scoped-execution`
stream: `stream/os`
taskSession: `tsk_81e24e7a3795`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1096/guide-agents-toward-code-call-for-repo-scoped-execution
github pr: https://github.com/consuelohq/opensaas/pull/1096
started: 2026-06-16

## acceptance criteria

- [ ] OS-only guidance/metadata change; no code.call runtime rewrite.
- [ ] Make `code.call` clearly the preferred tool for repo-scoped tests, package scripts, syntax checks, and short Python/Bun/Bash execution when a task branch/session exists.
- [ ] Make `mac.call` clearly an emergency/non-repo host escape hatch, not normal repo execution.
- [ ] Reduce agent incentives to call `mac.call` with `bash -lc 'bun test ...'` when task-scoped `code.call` can run the command with bounded output and changed-file detection.
- [ ] Update generated tool docs/types/manifests through existing generation scripts if source metadata changes.
- [ ] Add tests that lock the guidance so it does not regress.
- [ ] Promote to `stream/os` and report the stream review PR.

## current diagnosis

Ko observed repeated `mac.call` calls like `bash -lc 'bun test packages/workspace/tests/facade/facade.test.ts'` from an agent that already had a task branch. That is the wrong tool choice because it runs unscoped/no-branch and can blow context/token budgets.

Current public OS tool is already `code.call`; the legacy-ish `code-call` name is implementation/CLI path only. `code.call` supports Python, Bun, and Bash, has `read|edit|verify` modes, task-worktree gating, output truncation/log paths, transport-mistake detection, and changed-file detection. `mac.call` remains useful as an unscoped fail-safe for non-repo host commands or recovery when task state is broken, but it should not be a core/normal repo execution primitive.

## plan

1. Inspect current OS tool metadata, manifests, generated docs/types, steering prompt, and tests around tool descriptions/core manifests.
2. Write focused red tests asserting `code.call` guidance and `mac.call` emergency-only wording / core exposure policy.
3. Update source metadata/steering/prompt definitions, not runtime code.
4. Regenerate OS manifests/docs/types as required.
5. Run focused tests, generation checks, review, verify, push, promote, finish.

## test-first contract

Behavior under test:

- `code.call` tool metadata describes it as the preferred repo-scoped execution path for tests, package scripts, typechecks, syntax checks, and short Python/Bun/Bash programs when a taskSession/task worktree exists.
- `code.call` examples show repo-scoped task usage rather than only `print("hello")`.
- `mac.call` metadata/description does not compete with `code.call`; it is described as non-repo host escape hatch/emergency recovery only.
- If OS core manifest/core tool selection currently includes `mac.call`, either remove it from core or explicitly test the chosen policy.
- Steering/system prompt instructs agents not to use `mac.call` for repo tests when `code.call` or validation tools can run the command.

Expected red failure:

- Existing metadata describes `code.call` generically and does not mention preferred repo-scoped tests/package scripts.
- Existing `mac.call` description says "run a non-repo shell command on the Mac" but may not mark it emergency/escape-hatch strongly enough.
- Existing examples for `code.call` show a trivial Python print, not task-scoped repo validation.

## scope notes

- Do not rewrite `packages/os/scripts/lib/code-call/runtime.ts` in this task.
- Do not move implementation paths in this task.
- Do not remove the `mac.call` runtime; at most change OS core exposure/metadata if existing manifest generation supports it safely.
- Do not touch workspace-agents unless generation forces parity; record follow-up instead.

## validation evidence

- pending

- 2026-06-16 21:50:28 write: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 21:50:28 fs.write: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`
- 2026-06-16 21:55:37 fs.write: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`
- 2026-06-16 21:56:44 fs.write: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`

## workspace-owned: files read

- `packages/os/tests/tool-manifest.test.ts`

- 2026-06-16 21:51:38 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-06-16 21:54:14 apply-patch: `packages/os/tests/tool-manifest.test.ts`
## evidence so far

- Stream context: `trc_20604edfd54e`.
- Task start: `trc_897cf9880c66`.
- Discovery confirmed `code.call` is already the public tool name; `code-call` is the CLI/runtime implementation path.
- Discovery confirmed `mac.call` and `mac.exec` were in OS core because `manifest.config.json` included prefix `mac.` without excluding the execution aliases.
- Red focused test: `bun --cwd packages/os test tests/tool-manifest.test.ts --testNamePattern 'core|public execution surface'` failed because core still contained `mac.call`; trace `trc_810bb447c8da`.
- Implementation updated dev-tool metadata, core manifest config exclusions, generated manifests/docs/types, and OS steering guidance.
- Green focused test: same focused tool-manifest pattern passed 5 tests; trace `trc_d06ee3afc0b3`.
- Broader manifest suite: `tests/tool-manifest.test.ts` plus `tests/task-manifest-workflow-roles.test.ts` passed 14 tests; trace `trc_012e5a34b37b`.
- Generation/typecheck: generate tool manifest/types/docs and OS typecheck passed; trace `trc_4e6eec11ca93`.

## implementation details

- `code.call` description now states it is the preferred repo-scoped execution tool for focused tests, package scripts, typechecks, syntax checks, and short Python/Bun/Bash programs when taskSession/task worktree exists.
- `code.call` example now demonstrates a focused OS test command with `language: "bash"` and `mode: "verify"` rather than a trivial Python print.
- `mac.call` and `mac.exec` descriptions now mark them as emergency host escape hatches and explicitly say not to use `mac.call` for repo-scoped tests/package scripts/builds/typechecks/syntax checks/validation.
- `manifest.config.json` now excludes `mac.call` and `mac.exec` from OS core while preserving non-exec mac utilities such as `mac.read`.
- Steering adds explicit `code.call` versus `mac.call` guidance.

## notes / follow-up

- `code.call` edit mode appears to require explicit task-worktree enforcement that is still gated; generation was run through `code.run` edit mode instead. This is a separate runtime ergonomics follow-up, not part of this metadata/guidance task.

- 2026-06-16 21:55:37 append: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-06-16 21:50:28 write: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`
- 2026-06-16 21:56:19 `review.run`: passed — OK
- 2026-06-16 21:56:35 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/current.json`, `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/evidence-log.json`, `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/read-log.json`, `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/session.json`, `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`, `.task/tasks/os/guide-agents-toward-code-call-for-repo-scoped-execution.json`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/steering/system_prompt.md`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation evidence

- Review: `review.run` against `origin/stream/os` passed with zero own issues, zero pre-existing issues, zero failed suites, zero blocking issues; trace `trc_7bd7446d2f1e`.
- Verify: `verify` against `origin/stream/os` passed and wrote publish-valid stamp; trace `trc_d3f51f868bbd`.
- Verify selected zero suites, so explicit focused test traces remain behavior proof: red `trc_810bb447c8da`, green `trc_d06ee3afc0b3`, broader manifest `trc_012e5a34b37b`.

- 2026-06-16 21:56:44 append: `.task/os/guide-agents-toward-code-call-for-repo-scoped-execution/workpad.md`
