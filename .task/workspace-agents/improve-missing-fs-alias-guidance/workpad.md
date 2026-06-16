# improve missing fs alias guidance

branch: `task/workspace-agents/improve-missing-fs-alias-guidance`
stream: `stream/workspace-agents`
taskSession: `tsk_e816ee264251`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1077/improve-missing-fs-alias-guidance
github pr: https://github.com/consuelohq/opensaas/pull/1077
started: 2026-06-16

## objective

Improve the typed workspace facade error for stale `fs.patch` tool calls so agents are redirected to `fs.apply_patch` and receive the canonical manifest entry for that replacement tool.

## acceptance criteria

- [ ] `executeTool('fs.patch', ...)` returns a `NOT_FOUND` envelope with a targeted message that says `fs.patch` is not a workspace tool and names `fs.apply_patch` as the replacement.
- [ ] The error data includes the canonical `fs.apply_patch` manifest entry so the caller can recover without searching the manifest.
- [ ] Generic unknown tools keep the existing compact `unknown tool: <name>` behavior.
- [ ] CLI `bun packages/workspace/scripts/fs.js patch ...` behavior remains unchanged.

## test-first contract

Behavior under test:
- A stale facade call to `fs.patch` should produce targeted recovery guidance for `fs.apply_patch`, including the replacement manifest entry.
- A generic unknown tool should remain generic.

Existing pattern to follow:
- `packages/workspace/tests/facade/facade.test.ts` already tests typed facade envelopes through `executeTool`.
- `packages/workspace/tests/fs-apply-patch.test.ts` asserts `fs.patch` stays out of generated tool surfaces and `fs.apply_patch` is canonical.

Focused red command:
`bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern "fs.patch facade guidance"`

Expected red failure:
The new test fails because `executeTool('fs.patch', ...)` currently returns only `unknown tool: fs.patch` with no replacement manifest entry.

No-test waiver:
Not applicable. This is agent-facing facade behavior.

- 2026-06-16 04:34:31 write: `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 04:34:31 fs.write: `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`
- 2026-06-16 04:34:52 apply-patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-06-16 04:35:32 fs.write: `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`
- 2026-06-16 04:41:43 fs.write: `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-16 04:35:19 `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern fs.patch facade guidance`: failed exit 1 trace: `trc_78980d760f1a`
  - output: ^ error: expect(received).toContain(expected) Expected to contain: "fs.patch is not a workspace tool" Received: "unknown tool: fs.patch" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-workspace-agents-improve-missing-fs-alias-guidance/packages/workspace/tests/facade/facade.test.ts:236:28) (fail) typed facade executor > provides fs.patch facade guidance with the fs.apply_patch manifest entry [2.48ms] 0 pass 564 filtered out 1 fail 3 expect() calls Ran 1 test across 1 file. [158.00ms] error: script "task:exec" exited with code 1

## red evidence

- `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern "fs.patch facade guidance"` failed as expected.
- Failure: message was only `unknown tool: fs.patch`; expected targeted `fs.apply_patch` guidance and manifest data.

- 2026-06-16 04:35:32 append: `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`

- 2026-06-16 04:35:50 apply-patch: `packages/workspace/scripts/lib/facade/executor.ts`

## workspace-owned: TDD green evidence

- 2026-06-16 04:35:55 `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern fs.patch facade guidance`: passed exit 0 trace: `trc_5cc78a0adcf7`
  - output: as-workspace-agents-improve-missing-fs-alias-guidance-e816ee26 packages/workspace/tests/facade/facade.test.ts: {"level":"error","tool":"fs.patch","command":"workspace fs.patch","durationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"NOT_FOUND","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-16T04:35:55.780Z"} (pass) typed facade executor > provides fs.patch facade guidance with the fs.apply_patch manifest entry [2.17ms] 1 pass 564 filtered out 0 fail 9 expect() calls Ran 1 test across 1 file. [149.00ms]

## workspace-owned: files read

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/facade/facade.test.ts`

## workspace-owned: validation evidence

- 2026-06-16 04:40:01 `checkFiles`: passed — OK
- 2026-06-16 04:40:52 `review.run`: passed — OK
- 2026-06-16 04:41:14 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/improve-missing-fs-alias-guidance.json`, `.task/workspace-agents/improve-missing-fs-alias-guidance/current.json`, `.task/workspace-agents/improve-missing-fs-alias-guidance/evidence-log.json`, `.task/workspace-agents/improve-missing-fs-alias-guidance/read-log.json`, `.task/workspace-agents/improve-missing-fs-alias-guidance/session.json`, `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/tests/facade/facade.test.ts`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## implementation

- Added targeted guidance for the removed filesystem patch alias in `packages/workspace/scripts/lib/facade/executor.ts`.
- The special-case error keeps `code: NOT_FOUND`, names `fs.apply_patch` as the replacement, and returns `data.manifestEntry` for the canonical replacement manifest row.
- Generic unknown tools still return `unknown tool: <name>` with `data: null`.
- Updated `packages/workspace/SCRIPTS.md` tips to point agents to `fs.apply_patch` / `bun run fs -- apply-patch`.

## validation evidence

- Red targeted facade test failed before implementation with only the old generic unknown-tool message.
- Green targeted facade guidance test passed.
- Generic unknown-tool guard passed.
- Full facade test passed: 565 tests, 0 failures.
- Canonical apply-patch suite passed: 12 tests.
- Audit docs test passed: 1 test.
- Syntax check passed for the executor and facade test files.
- Review passed with 0 issues.
- Verify passed and wrote a publish-valid stamp.

- 2026-06-16 04:41:43 append: `.task/workspace-agents/improve-missing-fs-alias-guidance/workpad.md`
