# guide stale fs patch calls

branch: `task/os/guide-stale-fs-patch-calls`
stream: `stream/os`
taskSession: `tsk_4abb35b87491`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1081/guide-stale-fs-patch-calls
github pr: https://github.com/consuelohq/opensaas/pull/1081
started: 2026-06-16

## objective

Port the workspace stale `fs.patch` recovery behavior into the OS package/facade so OS agents get a targeted replacement message and the canonical `fs.apply_patch` manifest entry.

## acceptance criteria

- [ ] `executeTool('fs.patch', ...)` in `packages/os` returns a `NOT_FOUND` envelope that says `fs.patch` is not an OS tool and names `fs.apply_patch` as replacement.
- [ ] The error data includes the canonical `fs.apply_patch` manifest entry so callers can recover without separately searching the manifest.
- [ ] Generic unknown tools keep the existing compact `unknown tool: <name>` behavior.
- [ ] OS CLI `bun packages/os/scripts/fs.js patch ...` behavior remains unchanged.
- [ ] OS docs no longer teach stale `patch --from/--to` line-edit semantics and point to `fs.apply_patch` / `bun run fs -- apply-patch`.

## test-first contract

Behavior under test:
- Stale facade calls to `fs.patch` should return targeted `fs.apply_patch` recovery guidance with the canonical manifest entry.
- Generic missing tool calls should remain generic.

Existing pattern:
- `packages/os/tests/facade/facade.test.ts` already tests typed facade envelopes through `executeTool`.
- `packages/os/tests/tool-manifest.test.ts` asserts `fs.patch` stays out of generated surfaces and `fs.apply_patch` is canonical.

Focused red command:
- `bun --cwd packages/os test tests/facade/facade.test.ts -t 'fs.patch facade guidance'`

Expected red failure:
- The new test fails because OS `executeTool('fs.patch')` currently returns only `unknown tool: fs.patch` with no replacement manifest entry.

- 2026-06-16 07:56:06 write: `.task/os/guide-stale-fs-patch-calls/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 07:56:06 fs.write: `.task/os/guide-stale-fs-patch-calls/workpad.md`
- 2026-06-16 07:56:17 apply-patch: `packages/os/tests/facade/facade.test.ts`
- 2026-06-16 07:57:00 fs.write: `.task/os/guide-stale-fs-patch-calls/workpad.md`
- 2026-06-16 07:59:36 fs.write: `.task/os/guide-stale-fs-patch-calls/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-16 07:56:37 `bun --cwd packages/os test tests/facade/facade.test.ts -t fs.patch facade guidance`: failed exit 1 trace: `trc_40d789599412`
  - output: m [34mexpect[39m(result[33m.[39mcode)[33m.[39m[34mtoBe[39m([32m'NOT_FOUND'[39m)[33m;[39m [90m115|[39m [34mexpect[39m(result[33m.[39mmessage)[33m.[39m[34mtoContain[39m([32m'fs.patch is not an OS tool'[39m)[33m;[39m [90m |[39m [31m^[39m [90m116|[39m [34mexpect[39m(result[33m.[39mmessage)[33m.[39m[34mtoContain[39m([32m'fs.apply_patch'[39m)[33m;[39m [90m117|[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## red evidence

- `bun --cwd packages/os test tests/facade/facade.test.ts -t 'fs.patch facade guidance'` failed as expected.
- Failure: OS facade returned only `unknown tool: fs.patch`; expected targeted `fs.apply_patch` guidance and replacement manifest data.

- 2026-06-16 07:57:00 append: `.task/os/guide-stale-fs-patch-calls/workpad.md`

- 2026-06-16 07:57:13 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-06-16 07:57:26 apply-patch: `packages/os/SCRIPTS.md`

## workspace-owned: TDD green evidence

- 2026-06-16 07:57:32 `bun --cwd packages/os test tests/facade/facade.test.ts -t fs.patch facade guidance`: passed exit 0 trace: `trc_352fc8ac511e`
  - output: → tmux: opensaas-os-guide-stale-fs-patch-calls-4abb35b8 $ vitest run tests/facade/facade.test.ts -t "fs.patch facade guidance" {"level":"error","tool":"fs.patch","command":"workspace fs.patch","durationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"NOT_FOUND","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-16T07:57:32.329Z"}

## workspace-owned: validation evidence

- 2026-06-16 07:57:51 `checkFiles`: passed — OK
- 2026-06-16 07:58:49 `review.run`: passed — OK
- 2026-06-16 07:59:27 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/facade/facade.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/guide-stale-fs-patch-calls/current.json`, `.task/os/guide-stale-fs-patch-calls/evidence-log.json`, `.task/os/guide-stale-fs-patch-calls/read-log.json`, `.task/os/guide-stale-fs-patch-calls/session.json`, `.task/os/guide-stale-fs-patch-calls/workpad.md`, `.task/tasks/os/guide-stale-fs-patch-calls.json`, `packages/os/SCRIPTS.md`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/tests/facade/facade.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## implementation

- Added targeted `fs.patch` unknown-tool guidance in `packages/os/scripts/lib/facade/executor.ts`.
- The special-case error keeps `code: NOT_FOUND`, says `fs.patch` is not an OS tool, points to `fs.apply_patch`, and returns `data.manifestEntry` for the canonical `fs.apply_patch` manifest row.
- Generic unknown tools still return `unknown tool: <name>` with `data: null`.
- Updated `packages/os/SCRIPTS.md` tips and task:fs examples away from stale `patch --from/--to` line-edit semantics toward `fs.apply_patch` / `bun run fs -- apply-patch`.

## validation evidence

- Red: `bun --cwd packages/os test tests/facade/facade.test.ts -t 'fs.patch facade guidance'` failed before implementation with only `unknown tool: fs.patch`.
- Green targeted: `bun --cwd packages/os test tests/facade/facade.test.ts -t 'fs.patch facade guidance'` passed.
- Generic guard: `bun --cwd packages/os test tests/facade/facade.test.ts -t 'unknown tool messages'` passed.
- Full facade: `bun --cwd packages/os test tests/facade/facade.test.ts` passed: 551 tests.
- Tool manifest: `bun --cwd packages/os test tests/tool-manifest.test.ts` passed: 10 tests.
- FS read: `bun --cwd packages/os test tests/fs-read.test.ts` passed: 12 tests.
- Syntax: `checkFiles` passed for `packages/os/scripts/lib/facade/executor.ts` and `packages/os/tests/facade/facade.test.ts`.
- Review: `review.run --base origin/stream/os --no-tests` passed with 0 issues.
- Verify: `verify --base origin/stream/os` passed and wrote a publish-valid stamp.

- 2026-06-16 07:59:36 append: `.task/os/guide-stale-fs-patch-calls/workpad.md`
