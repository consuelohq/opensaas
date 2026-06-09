# design code call tool

branch: `task/workspace-agents/design-code-call-tool`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/846/design-code-call-tool
github pr: https://github.com/consuelohq/opensaas/pull/846
started: 2026-06-08

## acceptance criteria


- [x] Add a first-class `code.call` workspace facade tool.
- [x] Support `language: "python" | "bun" | "bash"` with raw multiline `code` or staged `codeFile`.
- [x] Support `stdin` and `stdinFile` for runtime input data.
- [x] Support `mode: "read" | "verify"` and accept but block `mode: "edit"` in PR1.
- [x] Normalize common language aliases and diagnose shell-escaped runtime transport.
- [x] Run source through staged temp files instead of shell-inline command strings.
- [x] Resolve safe cwd from task worktree, repo root, or temp roots and reject cwd escape.
- [x] Detect file mutations in `read` and `verify` mode and report `filesChanged`.
- [x] Return structured output with stdout, stderr, exitCode, durationMs, runtime, cwd, truncation, and traceId.
- [x] Expose generated facade schema/docs/types for `workspace.code.call`.
- [x] Add focused runtime tests plus facade manifest/schema tests.
- [x] Validate with focused tests, generated docs/types, audit, review, and verify as appropriate.

## plan

1. Reuse the existing `task/workspace-agents/design-code-call-tool` task session from the handoff.
2. Keep `code.call` separate from `code.run`: `code.run` composes workspace tools; `code.call` executes short language-specific snippets.
3. Add a shared `scripts/lib/code-call` runtime used by both the facade internal tool and `scripts/code-call.ts` CLI.
4. Add tests first for validation, language execution, staged payloads, mutation detection, edit gating, truncation, timeout, and facade exposure.
5. Implement the runtime, facade internal dispatch, manifest/schema entries, script entrypoint, and package script.
6. Regenerate workspace docs/types and run focused validation.

## current status

- Recovered valid task session `tsk_4cb68744d4f2`.
- Required context and current source files were read.
- Implementation path chosen: new `code-call` runtime beside current codemode; share facade envelope helpers, but do not extend incomplete `code.run` internals.
- Writing focused tests next, then running them red.

## first-pass evidence

- `stream.context` trace `trc_5b9ff7587028`: PR 846 and local task worktree exist for `task/workspace-agents/design-code-call-tool`.
- `context.search code.call` trace `trc_078e1a09be74`: no prior `code.call` context hit.
- `explore` trace `trc_e7de37a9cbae`: relevant surface is `code.run`, facade schemas/executor, manifest/docs/types, and facade tests.
- `context.trace contains=python3` trace `trc_e3f824d48a78`: recent generic runtime usage appears through workspace tools, especially `mac.call`.
- `fs.list packages/workspace/scripts/lib/codemode` trace `trc_684c51bb1e8c`: current codemode directory only contains `executor.ts`; `code-run.ts` imports missing `types` and `tools` modules. This supports a separate `code-call` runtime for PR1.

## Test-first contract

Behavior under test:
- `code.call` validates language, mode, source, cwd, and transport-shaped mistakes with structured diagnostics.
- Python runs multiline code from a staged temp file and captures stdout/stderr/exitCode.
- Bun runs JavaScript/TypeScript snippets through Bun from a staged temp file.
- Bash runs through a staged `.sh` file with conservative strict-mode defaults.
- `codeFile` and `stdinFile` avoid heredoc/base64 transport for large payloads.
- Shell-escaped runtime wrappers such as `python3 -c` are rejected with actionable guidance.
- `read` and `verify` modes fail when tracked or untracked repo file state changes.
- `edit` mode is accepted by schema but blocked in PR1 with a clear message.
- Output truncation is deterministic and marked with `truncated: true`.
- Timeout is enforced and reported as `TIMEOUT` with `detectedMistakeClass: "timeout"`.
- Facade schema/manifest/generated surfaces expose `workspace.code.call` correctly.

Existing pattern to follow:
- `packages/workspace/scripts/code-run.ts` is the nearby code namespace script entrypoint.
- `packages/workspace/scripts/lib/facade/schemas.ts` owns input schemas and generated type signatures.
- `packages/workspace/tooling/tool-manifest.json` owns facade tool exposure.
- `packages/workspace/tests/facade/facade.test.ts` verifies manifest/schema exposure and internal facade behavior.
- `packages/workspace/tests/codemode.test.ts` is the nearest runtime test pattern for code execution.

Intended tests:
- Add `packages/workspace/tests/code-call.test.ts` for runtime and CLI behavior.
- Extend `packages/workspace/tests/facade/facade.test.ts` for manifest/schema exposure.

Focused red command:
- `bun --cwd packages/workspace test tests/code-call.test.ts tests/facade/facade.test.ts --reporter=dot`

Expected red failure:
- `tests/code-call.test.ts` fails to resolve the not-yet-created `scripts/lib/code-call/runtime` module or missing `code.call` facade entry.

No-test waiver:
- None. This is a behavior/tooling change and needs focused tests.

## OS alignment

- Relevant files inspected: `packages/os/skills/task/SKILL.md` and `packages/os/TASK-WORKFLOW.md`.
- OS should not be modified in PR1 unless current workspace implementation proves a shared runtime is ready and ownership is clear.
- Recommended future contract: mirror `code.call` through OS only after workspace runtime semantics and mutation detection are proven.
- Reason OS is excluded from PR1: current typed facade, trace evidence, `code.run`, and generated workspace surfaces live in `packages/workspace`; adding OS would broaden scope before the core runtime is validated.

## files changed

- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/codemode/types.ts`


## workspace-owned: files changed

- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/code-call.ts`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/generate-types.ts`
- `packages/workspace/scripts/lib/code-call/runtime.ts`
- `packages/workspace/scripts/lib/code-call/types.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: activity log

- 2026-06-08 23:38:56 fs.write: `.task/workspace-agents/design-code-call-tool/workpad.md`
- 2026-06-08 23:39:35 fs.write: `packages/workspace/tests/code-call.test.ts`
- 2026-06-08 23:39:58 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-06-08 23:40:23 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-06-08 23:41:00 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-06-08 23:42:24 fs.write: `packages/workspace/scripts/lib/code-call/types.ts`
- 2026-06-08 23:44:02 fs.write: `packages/workspace/scripts/lib/code-call/runtime.ts`
- 2026-06-08 23:47:59 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:48:05 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:48:23 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:48:45 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:48:51 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:49:07 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:49:15 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:49:37 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:49:52 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-06-08 23:49:57 fs.patch: `packages/workspace/scripts/lib/facade/types.ts`
- 2026-06-08 23:50:11 fs.patch: `packages/workspace/scripts/lib/facade/types.ts`
- 2026-06-08 23:50:32 fs.patch: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-06-08 23:50:36 fs.patch: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-06-08 23:50:42 fs.patch: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-06-08 23:51:22 fs.patch: `packages/workspace/tooling/tool-manifest.json`
- 2026-06-08 23:51:23 fs.patch: `packages/workspace/package.json`
- 2026-06-08 23:51:24 fs.patch: `packages/workspace/scripts/generate-types.ts`
- 2026-06-08 23:51:25 fs.patch: `packages/workspace/scripts/generate-docs.ts`
- 2026-06-08 23:51:42 fs.patch: `packages/workspace/scripts/generate-types.ts`
- 2026-06-08 23:52:28 fs.write: `packages/workspace/scripts/code-call.ts`
- 2026-06-08 23:53:00 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-08 23:54:38 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-06-08 23:55:53 fs.patch: `packages/workspace/tests/code-call.test.ts`
- 2026-06-08 23:58:12 fs.patch: `.task/workspace-agents/design-code-call-tool/workpad.md`
- 2026-06-08 23:58:31 fs.patch: `.task/workspace-agents/design-code-call-tool/workpad.md`
- 2026-06-08 23:58:46 fs.write: `.task/workspace-agents/design-code-call-tool/workpad.md`
- Read stream context, prior context hits, trace evidence, repo rules, OS task workflow docs, workspace scripts docs, facade schemas/executor/types, manifest/docs/types snippets, and nearby tests.
- Recovered the task session from the handoff.

## workspace-owned: validation evidence

- 2026-06-08 23:55:05 `audit`: passed — OK
- 2026-06-08 23:55:29 `review.run`: passed — OK
- 2026-06-08 23:57:00 `review.run`: passed — OK
- 2026-06-08 23:57:13 `verify`: passed — OK

## key decisions

- Implement `code.call` as a new language-execution runtime, not as an extension of current `code.run` internals.
- Use an internal facade tool path for `code.call` so raw multiline source is not transported as shell argv.
- Keep the user-runnable `code-call` script and facade internal tool on the same runtime function.
- Block `edit` in PR1.

## notes for ko

- The existing `code.run` branch state appears incomplete in this task worktree. This task will not depend on those missing codemode modules.

## improvements noticed

- `code.run` currently special-cases task worktree cwd in the facade executor; `code.call` should receive the same cwd treatment.

## issues and recovery

- Attempted to read `packages/workspace/scripts/lib/codemode/types.ts` from the handoff; the file does not exist in this task worktree. The current directory listing supports treating that as a stale handoff path and continuing with the separate `code-call` path.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): add code call tool" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/TASK-WORKFLOW.md`
- `packages/os/skills/task/SKILL.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/code-call.ts`
- `packages/workspace/scripts/code-run.ts`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/generate-types.ts`
- `packages/workspace/scripts/lib/code-call/runtime.ts`
- `packages/workspace/scripts/lib/code-call/types.ts`
- `packages/workspace/scripts/lib/codemode/executor.ts`
- `packages/workspace/scripts/lib/facade/errors.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/scripts/tmp.js`
- `packages/workspace/scripts/tool-runner.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/scripts/workspace.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/tests/codemode.test.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: TDD red evidence

- 2026-06-08 23:41:19 `bun --cwd packages/workspace test tests/code-call.test.ts tests/facade/facade.test.ts --reporter=dot`: failed exit 1 trace: `trc_4c966edf15f9`
  - output: |[39m })[33m;[39m [90m977|[39m [90m978|[39m [34mexpect[39m(run[33m.[39mstatus)[33m.[39m[34mtoBe[39m([34m0[39m)[33m;[39m [90m |[39m [31m^[39m [90m979|[39m [35mconst[39m result [33m=[39m [33mJSON[39m[33m.[39m[34mparse[39m(run[33m.[39mstdout)[33m;[39m [90m980|[39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-08 23:42:24 write: `packages/workspace/scripts/lib/code-call/types.ts`

- 2026-06-08 23:44:02 write: `packages/workspace/scripts/lib/code-call/runtime.ts`

- 2026-06-08 23:47:59 patch lines 1088-1088: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:48:05 patch lines 996-996: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:48:23 patch lines 995-998: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:48:45 patch lines 994-999: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:48:51 patch lines 891-891: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:49:07 patch lines 891-893: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:49:15 patch lines 112-112: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:49:37 patch lines 110-142: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:49:52 patch lines 142-142: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-06-08 23:49:57 patch lines 1-11: `packages/workspace/scripts/lib/facade/types.ts`

- 2026-06-08 23:50:11 patch lines 13-14: `packages/workspace/scripts/lib/facade/types.ts`

- 2026-06-08 23:50:32 patch lines 975-975: `packages/workspace/scripts/lib/facade/executor.ts`

- 2026-06-08 23:50:36 patch lines 589-589: `packages/workspace/scripts/lib/facade/executor.ts`

- 2026-06-08 23:50:42 patch lines 12-13: `packages/workspace/scripts/lib/facade/executor.ts`

- 2026-06-08 23:51:22 patch lines 934-934: `packages/workspace/tooling/tool-manifest.json`

- 2026-06-08 23:51:23 patch lines 44-44: `packages/workspace/package.json`

- 2026-06-08 23:51:24 patch lines 55-65: `packages/workspace/scripts/generate-types.ts`

- 2026-06-08 23:51:25 patch lines 212-212: `packages/workspace/scripts/generate-docs.ts`

- 2026-06-08 23:51:42 patch lines 55-55: `packages/workspace/scripts/generate-types.ts`

- 2026-06-08 23:52:28 write: `packages/workspace/scripts/code-call.ts`

- 2026-06-08 23:53:00 patch lines 1066-1066: `packages/workspace/SCRIPTS.md`

## workspace-owned: TDD green evidence

- 2026-06-08 23:54:06 `bun x vitest run packages/workspace/tests/code-call.test.ts packages/workspace/tests/facade/facade.test.ts --reporter=dot`: failed exit 1 trace: `trc_d84824aa14bd`
  - output: .[39m [36m [2m❯[22m packages/workspace/tests/facade/facade.test.ts:[2m187:3[22m[39m [90m185| [39m })[33m;[39m [90m186| [39m [90m187| [39m it('tools.search ranks intent keywords and returns usage guidance', … [90m | [39m [31m^[39m [90m188| [39m [35mconst[39m runSearch [33m=[39m (query[33m:[39m string[33m,[39m limit [33m=[39m [34m5[39m) [33m=>[39m { [90m189| [39m const result = spawnSync('bun', ['packages/workspace/scripts/too… [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1
- 2026-06-08 23:54:19 `bun x vitest run packages/workspace/tests/code-call.test.ts --reporter=dot`: passed exit 0 trace: `trc_6abed1a15654`
  - output: → tmux: opensaas-workspace-agents-design-code-call-tool-4cb68744
- 2026-06-08 23:54:38 patch lines 223-223: `packages/workspace/tests/facade/facade.test.ts`
- 2026-06-08 23:54:55 `bun x vitest run packages/workspace/tests/code-call.test.ts packages/workspace/tests/facade/facade.test.ts --reporter=dot`: passed exit 0 trace: `trc_78b6b915cae1`
  - output: --json --dry-run","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-08T23:54:55.189Z"} {"level":"info","tool":"mac.exec","branch":"","command":"workspace mac.exec '{\"command\":\"pwd\"}'","implementationCommand":"bun run mac -- exec pwd --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-08T23:54:55.192Z"}
- 2026-06-08 23:55:53 patch lines 79-79: `packages/workspace/tests/code-call.test.ts`
- 2026-06-08 23:56:08 `bun x vitest run packages/workspace/tests/code-call.test.ts packages/workspace/tests/facade/facade.test.ts --reporter=dot`: passed exit 0 trace: `trc_a7aeb9fd9020`
  - output: --json --dry-run","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-08T23:56:08.624Z"} {"level":"info","tool":"mac.exec","branch":"","command":"workspace mac.exec '{\"command\":\"pwd\"}'","implementationCommand":"bun run mac -- exec pwd --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-08T23:56:08.626Z"}

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/design-code-call-tool.json`, `.task/workspace-agents/design-code-call-tool/current.json`, `.task/workspace-agents/design-code-call-tool/evidence-log.json`, `.task/workspace-agents/design-code-call-tool/read-log.json`, `.task/workspace-agents/design-code-call-tool/session.json`, `.task/workspace-agents/design-code-call-tool/workpad.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/package.json`, `packages/workspace/scripts/code-call.ts`, `packages/workspace/scripts/generate-docs.ts`, `packages/workspace/scripts/generate-types.ts`, `packages/workspace/scripts/lib/code-call/runtime.ts`, `packages/workspace/scripts/lib/code-call/types.ts`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/facade/types.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/code-call.test.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## workspace-owned: TDD post evidence

- 2026-06-08 23:57:37 `git status --short`: passed exit 0 trace: `trc_fd93e8b45075`
  - output: → tmux: opensaas-workspace-agents-design-code-call-tool-4cb68744

- 2026-06-08 23:58:12 patch lines 10-22: `.task/workspace-agents/design-code-call-tool/workpad.md`

- 2026-06-08 23:58:31 patch lines 10-10: `.task/workspace-agents/design-code-call-tool/workpad.md`

## final validation summary

- `bun run --cwd packages/workspace generate-types`: passed trace `trc_e86b2de5f322`.
- `bun x vitest run packages/workspace/tests/code-call.test.ts --reporter=dot`: passed trace `trc_6abed1a15654`.
- `bun x vitest run packages/workspace/tests/code-call.test.ts packages/workspace/tests/facade/facade.test.ts --reporter=dot`: passed trace `trc_a7aeb9fd9020`.
- `audit --scripts`: passed trace `trc_68da368ac07b`.
- `review.run --base origin/stream/workspace-agents`: passed trace `trc_518ff1b66208`.
- `verify --base origin/stream/workspace-agents`: passed and publish-valid trace `trc_676a0763808f`.
- `git status --short` in task worktree: passed trace `trc_fd93e8b45075`.

- 2026-06-08 23:58:46 append: `.task/workspace-agents/design-code-call-tool/workpad.md`
