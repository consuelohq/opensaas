# add os code call core tool

branch: `task/workspace-agents/add-os-code-call-core-tool`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/859/add-os-code-call-core-tool
github pr: https://github.com/consuelohq/opensaas/pull/859
started: 2026-06-09

## acceptance criteria

- [ ] Add OS `code.call` runtime and CLI entrypoint adapted from Workspace PR #846.
- [ ] Wire `code.call` through the OS facade/tool-runner schema, types, executor, and manifests.
- [ ] Mark `code.call` as a core OS tool so it appears in full/core manifests and default steering/materialization.
- [ ] Add OS tests adapted from Workspace `code-call.test.ts` without weakening edge-case coverage.
- [ ] Add parity/drift prevention coverage between Workspace and OS `code.call` behavior/tests.
- [ ] Prove installed OS materialization creates the dotted tool wrapper and tool metadata, or document the harness limitation.
- [ ] Regenerate generated OS docs/types/manifests where applicable.
- [ ] Validate with focused OS tests, manifest/install/steering tests, syntax checks, review, verify, push, and promote to the stream review PR.

## plan

1. Confirm PR #846 source files and OS package patterns before editing.
2. Fill the test-first contract from the real Workspace tests and OS harness shape.
3. Copy/adapt the Workspace runtime and tests into `packages/os` with only necessary OS path/import changes.
4. Wire the OS facade, schemas, types, package scripts, manifests, core config, generated surfaces, and docs.
5. Run focused red tests, implement, rerun green tests, run broader OS validation, inspect diff, push, and promote to `stream/workspace-agents`.

## Test-first contract

behavior under test:
- OS exposes a core `code.call` tool with Workspace PR #846 behavior parity across language execution, staged code transport, read/verify mutation protection, edit gating, cwd validation, truncation/logging, timeout, structured errors, facade/tool-runner invocation, core manifest visibility, steering visibility, and installed wrapper materialization.

existing local pattern to follow:
- Workspace PR #846 code-call runtime, CLI, tests, facade/schema/manifest/docs integration.
- OS manifest/install/steering tests and facade tests under `packages/os/tests/**`.

new or changed tests:
- `packages/os/tests/code-call.test.ts` adapted from Workspace.
- `packages/os/tests/code-call-parity.test.ts` for drift prevention.
- Existing OS facade/manifest/install/steering tests updated where `code.call` must appear as a core tool.

focused red command:
- `bun --cwd packages/os test tests/code-call.test.ts tests/code-call-parity.test.ts`

expected red failure:
- Tests fail initially because OS does not yet have `scripts/code-call.ts`, `scripts/lib/code-call/*`, schema entries, facade dispatch, manifest entries, or core materialization for `code.call`.

no-test waiver:
- None. This is behavior/tooling work and requires focused tests.

## current status

- Task started from `stream/workspace-agents` because `task.start` accepts only `main` or `stream`; PR #846 source will be read explicitly from `origin/task/workspace-agents/design-code-call-tool`.
- Initial stream context confirms PR #846 is open on `task/workspace-agents/design-code-call-tool`.
- Investigating source files and OS patterns before production edits.

## files changed

- `.task/workspace-agents/add-os-code-call-core-tool/workpad.md`
- `packages/os/tests/code-call-parity.test.ts`
- `packages/os/tests/code-call.test.ts`

## validation evidence

- none yet

## key decisions

- Use `stream/workspace-agents` because the handoff explicitly identifies that as the base stream and PR #846 is in the same area.
- Preserve Workspace PR #846 behavior by adapting its runtime/tests rather than redesigning the tool.

## issues and recovery

- `task.start` rejected a task-branch `startFrom` with `VALIDATION_ERROR`; recovered by starting from `stream` and using explicit PR source reads.

- 2026-06-09 03:57:20 write: `.task/workspace-agents/add-os-code-call-core-tool/workpad.md`

## workspace-owned: files changed

- `.task/workspace-agents/add-os-code-call-core-tool/workpad.md`
- `packages/os/tests/code-call-parity.test.ts`
- `packages/os/tests/code-call.test.ts`

## workspace-owned: activity log

- 2026-06-09 03:57:20 fs.write: `.task/workspace-agents/add-os-code-call-core-tool/workpad.md`
- 2026-06-09 04:00:50 fs.write: `packages/os/tests/code-call.test.ts`
- 2026-06-09 04:01:00 fs.write: `packages/os/tests/code-call-parity.test.ts`

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/manifest.config.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`

## workspace-owned: TDD red evidence

- 2026-06-09 04:01:20 `bun --cwd packages/os test tests/code-call.test.ts`: failed exit 1 trace: `trc_6040622ce795`
  - output: [2m9:1[22m[39m [90m 7| [39m[35mimport[39m { describe[33m,[39m expect[33m,[39m it } [35mfrom[39m [32m'vitest'[39m[33m;[39m [90m 8| [39m [90m 9| [39m[35mimport[39m { executeCodeCall } [35mfrom[39m [32m'../scripts/lib/code-call/runtime'[39m[33m;[39m [90m | [39m[31m^[39m [90m 10| [39m [90m 11| [39m[35mconst[39m [33mTEST_UUID[39m [33m=[39m [32m'abc123def4567890abc123def4567890'[39m[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-09 04:01:24 `bun --cwd packages/os test tests/code-call-parity.test.ts`: failed exit 1 trace: `trc_ff3cbe0af261`
  - output: arity.test.ts:[2m39:10[22m[39m [90m 37| [39m [90m 38| [39m[35mfunction[39m [34mreadOsSource[39m(relativePath[33m:[39m string)[33m:[39m string { [90m 39| [39m [35mreturn[39m [34mreadFileSync[39m([34mjoin[39m(osRoot[33m,[39m relativePath)[33m,[39m [32m'utf8'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 40| [39m} [90m 41| [39m [90m [2m❯[22m tests/code-call-parity.test.ts:[2m51:27[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-09 04:03:25 `bun --cwd packages/os test tests/code-call.test.ts`: passed exit 0 trace: `trc_e47a204d635f`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e $ vitest run tests/code-call.test.ts
- 2026-06-09 04:03:37 `bun --cwd packages/os test tests/code-call-parity.test.ts`: passed exit 0 trace: `trc_10c0586584cd`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e $ vitest run tests/code-call-parity.test.ts
- 2026-06-09 04:06:18 `bun --cwd packages/os test tests/code-call.test.ts tests/code-call-parity.test.ts`: passed exit 0 trace: `trc_b7c33ec59517`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e $ vitest run tests/code-call.test.ts tests/code-call-parity.test.ts
- 2026-06-09 04:06:28 `bun --cwd packages/os test tests/install-state.test.ts`: passed exit 0 trace: `trc_b92869cf8309`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e $ vitest run tests/install-state.test.ts
- 2026-06-09 04:06:54 `bun --cwd packages/os test tests/tool-manifest.test.ts`: passed exit 0 trace: `trc_a4610493dc7f`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e $ vitest run tests/tool-manifest.test.ts

## workspace-owned: TDD post evidence

  - output: {"ok":true,"exitCode":0,"language":"python","runtime":"python3","mode":"read","cwd":"/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-workspace-agents-add-os-code-call-core-tool/packages/os","durationMs":413,"stdout":"hello\n","stderr":"","filesChanged":[],"truncated":false,"traceId":"trc_a621b835a2b2"}
- 2026-06-09 04:07:01 `bun --cwd packages/os ./scripts/tool-runner.ts code.call {"language":"python","mode":"read","code":"print(\"hello\")"}`: passed exit 0 trace: `trc_8804f4f8de90`
  - output: {"ok":true,"exitCode":0,"language":"python","runtime":"python3","mode":"read","cwd":"/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-workspace-agents-add-os-code-call-core-tool","durationMs":378,"stdout":"hello\n","stderr":"","filesChanged":[],"truncated":false,"traceId":"trc_8804f4f8de90"}
- 2026-06-09 04:07:02 `bun --cwd packages/os ./scripts/os.ts get-steering`: passed exit 0 trace: `trc_f8db3cb0861a`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e
- 2026-06-09 04:07:03 `node packages/os/scripts/check-syntax.js`: passed exit 0 trace: `trc_3d933bffaaed`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e
- 2026-06-09 04:07:17 `node packages/os/scripts/check-syntax.js`: passed exit 0 trace: `trc_553e0eee7941`
  - output: → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e
- 2026-06-09 04:07:18 `python3 -c import subprocess
out=subprocess.check_output(['bun','--cwd','packages/os','./scripts/os.ts','get-steering'], text=True)
print('code.call' in out)
print(out[out.find('code.call')-120:out.find('code.call')+220] if 'code.call' in out else 'missing')`: passed exit 0 trace: `trc_625e68bcf250`
  - output: out=subprocess.check_output(['bun','--cwd','packages/os','./scripts/os.ts','get-steering'], text=True) print('code.call' in out) print(out[out.find('code.call')-120:out.find('code.call')+220] if 'code.call' in out else 'missing')" → tmux: opensaas-workspace-agents-add-os-code-call-core-tool-5cee096e out=subprocess.check_output(['bun','--cwd','packages/os','./scripts/os.ts','get-steering'], text=True) print('code.call' in out) print(out[out.find('code.call')-120:out.find('code.call')+220] if 'code.call' in out else 'missing')

## workspace-owned: validation evidence

- 2026-06-09 04:08:18 `review.run`: passed — OK
- 2026-06-09 04:08:29 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/add-os-code-call-core-tool.json`, `.task/workspace-agents/add-os-code-call-core-tool/current.json`, `.task/workspace-agents/add-os-code-call-core-tool/evidence-log.json`, `.task/workspace-agents/add-os-code-call-core-tool/read-log.json`, `.task/workspace-agents/add-os-code-call-core-tool/session.json`, `.task/workspace-agents/add-os-code-call-core-tool/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/package.json`, `packages/os/scripts/code-call.ts`, `packages/os/scripts/lib/code-call/runtime.ts`, `packages/os/scripts/lib/code-call/types.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/code-call-parity.test.ts`, `packages/os/tests/code-call.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
