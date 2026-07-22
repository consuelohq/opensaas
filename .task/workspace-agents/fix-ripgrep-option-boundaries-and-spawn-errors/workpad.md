# fix ripgrep option boundaries and spawn errors

branch: `task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors`
stream: `stream/workspace-agents`
taskSession: `tsk_61c04ed00a11`
source PR: https://diffs.consuelohq.com/consuelohq/opensaas/pull/1106
started: 2026-06-17

## acceptance criteria

- Verify CodeRabbit findings against current code before editing.
- Add ripgrep argument boundaries in workspace and OS `fs.search`: `-e` before the user pattern and `--` before targets.
- Propagate `spawnSync` transport errors instead of treating `status: null` as success in workspace and OS `fs.search`.
- Normalize `fs.search` `path` alias to canonical `paths` without retaining `path` in workspace and OS facade executors.
- Treat the duplicate executor comment as one issue and skip the duplicate with a brief reason.
- Keep changes minimal and validate with focused red/green tests.

## verification of findings against current code

- Workspace `packages/workspace/scripts/lib/fs/search.ts` still pushes `input.pattern` directly and then spreads targets directly into ripgrep args. Valid issue.
- OS `packages/os/scripts/lib/fs/search.ts` has the same direct pattern/targets construction. Valid issue.
- Workspace and OS `runRipgrepEffect` both return `{ status: proc.status ?? 0, ... }` without checking `proc.error`. Valid issue.
- Workspace and OS `normalizeInput` both return `{ ...input, paths: [input.path] }`, preserving the original `path` field alongside canonical `paths`. Valid issue.
- The repeated executor comment is a duplicate of the same normalization issue. It will be fixed once per package.

## Test-first contract

Behavior under test:
- `fs.search` treats patterns beginning with `-` as literals, not ripgrep options.
- `fs.search` treats target paths beginning with `-` as paths, not ripgrep options.
- `fs.search` fails when ripgrep cannot be launched instead of returning a successful empty result.
- Facade `fs.search` path alias normalization serializes only canonical `paths`, not both `path` and `paths`.

Existing local pattern to follow:
- `packages/workspace/tests/fs-search.test.ts` and `packages/os/tests/fs-search.test.ts` run the CLI against temporary fixtures.
- `packages/workspace/tests/facade/facade.test.ts` and `packages/os/tests/facade/facade.test.ts` inspect planned facade CLI args.

New or changed tests:
- Update workspace and OS fs-search tests with dash-leading pattern, dash-leading path, and ripgrep transport error cases.
- Update workspace and OS facade tests so path alias planning proves only one target path is serialized.

Focused red commands:
- `bun --cwd packages/workspace test tests/fs-search.test.ts tests/facade/facade.test.ts --test-name-pattern "dash-leading|ripgrep transport|fs.search path alias"`
- `bun --cwd packages/os test tests/fs-search.test.ts tests/facade/facade.test.ts --test-name-pattern "dash-leading|ripgrep transport|fs.search path alias"`

Expected red failure:
- Dash-leading pattern/path tests fail because `rg` parses user input as flags.
- Ripgrep transport test fails because missing `rg` is coerced to status 0 with empty results.
- Facade alias test fails because both `path` and normalized `paths` produce duplicate target serialization.

## implementation plan

1. Add focused tests first in workspace and OS copies.
2. Run focused red commands and record failure evidence.
3. Patch both `fs.search` modules and both facade executors with minimal changes.
4. Rerun focused green commands, inspect diff, and run static/review/verify gates against `origin/stream/workspace-agents`.
5. Push task branch and promote into the stream review PR.

## files changed

- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`

## validation

- Pending red run.

- 2026-06-17 04:17:15 write: `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`

## workspace-owned: files changed

- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`

## workspace-owned: activity log

- 2026-06-17 04:17:15 fs.write: `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`
- 2026-06-17 04:22:07 fs.write: `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- 2026-06-17 04:25:34 fs.write: `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`
- 2026-06-17 04:26:35 fs.write: `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`

## workspace-owned: files read

- `packages/os/manifests/tool.manifest.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/fs/search.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/scripts/lib/fs/search.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-06-17 04:23:25 apply-patch: `packages/workspace/tests/fs-search.test.ts`
- 2026-06-17 04:23:44 apply-patch: `packages/os/tests/fs-search.test.ts`

## workspace-owned: validation evidence

- 2026-06-17 04:25:06 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-17 04:26:09 `review.run`: passed — OK
- 2026-06-17 04:26:23 `verify`: passed — OK

## TDD red evidence

- Focused red command covering workspace and OS selected tests failed as expected before implementation.
- Workspace failures covered dash-leading pattern, dash-leading path, ripgrep transport handling, and canonical `fs.search` path alias normalization.
- OS failures covered the same selected behaviors.
- The red test run also caused unrelated snapshot churn in verify mode; restored the snapshot from `HEAD` before implementation and reran later with `CI=1`.

## implementation

- Added `-e` before the user pattern and `--` before targets in both `packages/workspace/scripts/lib/fs/search.ts` and `packages/os/scripts/lib/fs/search.ts`.
- Checked `proc.error` and `proc.status === null` before constructing the ripgrep result in both fs search modules.
- Changed both facade executors so `fs.search` `path` alias destructures out the original `path` and returns only canonical `paths`.
- Treated the repeated executor comment as a duplicate; fixed once per package.

## validation evidence

- Focused green: `bun --cwd packages/workspace test tests/fs-search.test.ts tests/facade/facade.test.ts --test-name-pattern "dash-leading|ripgrep transport|fs.search path alias"` passed: 5 selected tests.
- Focused green: `bun --cwd packages/os test tests/fs-search.test.ts tests/facade/facade.test.ts --test-name-pattern "dash-leading|ripgrep transport|fs.search path alias"` passed: 5 selected tests.
- Full search suites: `bun --cwd packages/workspace test tests/fs-search.test.ts` passed: 8 tests.
- Full search suites: `bun --cwd packages/os test tests/fs-search.test.ts` passed: 8 tests.
- `checkFiles` could not run because the current package script path still reports `Script not found "task:exec"`; focused tests above are the validation source for these files.

- 2026-06-17 04:25:34 append: `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors.json`, `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/current.json`, `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/evidence-log.json`, `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/read-log.json`, `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/session.json`, `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/fs/search.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/fs-search.test.ts`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/fs/search.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-search.test.ts`
- matched rules: `workspace-facade`
- selected suites: `workspace facade input contracts`
- run results: `workspace facade input contracts` passed
- failed suites: none

## publish gate evidence

- `review.run --base origin/stream/workspace-agents` passed: static rules, eslint, typecheck, and spec compliance; 0 issues.
- `verify --base origin/stream/workspace-agents` passed with `publishValid: true` and wrote `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/verify.json`.
- Verify selected workspace facade input contracts and passed 129 filtered tests.

## files changed

- `packages/workspace/scripts/lib/fs/search.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/fs-search.test.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/os/scripts/lib/fs/search.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/fs-search.test.ts`
- `packages/os/tests/facade/facade.test.ts`

- 2026-06-17 04:26:35 append: `.task/workspace-agents/fix-ripgrep-option-boundaries-and-spawn-errors/workpad.md`
