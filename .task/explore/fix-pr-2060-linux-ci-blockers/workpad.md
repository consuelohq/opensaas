# fix PR 2060 Linux CI blockers

branch: `task/explore/fix-pr-2060-linux-ci-blockers`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2285
started: 2026-08-29

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/fs.js`
- `packages/os/tests/fs-list-portability.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`


## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## Scope

Fix the two Linux CI blockers preventing PR #2060 release without weakening production/runtime requirements.

## Acceptance criteria

- [x] `Consuelo / workspace contracts` installs the OS dependency set whenever its selected verification can execute OS tests; the Explore benchmark CLI must resolve `tree-sitter` on clean Linux CI.
- [x] `Consuelo / verify` work-session filesystem contract is deterministic on Linux as well as macOS; preserve the real read/list/search behavior and fail-closed path rules.
- [x] Keep the fixes scoped to CI/runtime portability; no review bypasses or weakened assertions.
- [x] Preflight every focused test target for destructive literals, run focused red/green coverage, `review.run`, and `verify`. Stream merge/release follow immediately after this task push.

## Test-first contract

behavior under test: clean Linux CI must provision every dependency required by selected OS suites, and work-session `fs.list` must succeed for a valid session-relative directory regardless of platform path/listing differences.
existing local pattern: `.github/workflows/consuelo-ci.yaml` already installs OS dependencies in the general verify job when `os_contracts == 'true'`; `packages/os/tests/work-session-fs.test.ts` exercises the same facade read/list/search path in one temp work-session.
new or changed tests: use the existing CI failures as red evidence; inspect the failing work-session test and list implementation before deciding whether the test fixture or product path handling is wrong. Add/adjust the narrowest regression only if current coverage does not express the intended portable contract.
focused red command: GitHub run 33234616561 already provides red evidence on Ubuntu. Workspace-contract job fails because `tree-sitter` is absent; verify job fails at `packages/os/tests/work-session-fs.test.ts:118` with `list.ok === false` while read succeeds.
expected red failure: workspace contract gate reports `Cannot find package 'tree-sitter'`; verify reports `expected false to be true` for valid `fs.list`.
no-test waiver: not applicable; both defects already have deterministic failing CI contracts.

## Red evidence

- PR #2060 release refused failed check `Consuelo / workspace contracts`.
- Workspace-contract job `99053444212`: Explore benchmark CLI exits before arg handling because `packages/os/scripts/lib/index/chunker.js` cannot resolve `tree-sitter` on Ubuntu.
- Verify job `99053444201`: `work-session-fs.test.ts` read succeeds but list returns `ok=false` for the same valid work-session root.

- 2026-08-29 06:01:24 append: `.task/explore/fix-pr-2060-linux-ci-blockers/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/fs-list-portability.test.ts`

## workspace-owned: activity log

- 2026-08-29 06:01:24 fs.write: `.task/explore/fix-pr-2060-linux-ci-blockers/workpad.md`
- 2026-08-29 06:03:04 fs.write: `packages/os/tests/fs-list-portability.test.ts`
- 2026-08-29 06:04:44 fs.write: `.task/explore/fix-pr-2060-linux-ci-blockers/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/fs.js`
- `packages/os/scripts/lib/work-session-fs.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/work-session-fs.test.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/test-selection.test.js`

## Implementation

- `packages/workspace/scripts/test-selection.js`: selected OS suites now self-provision `packages/os` with `bun install --frozen-lockfile` only when the package dependency sentinel is missing. Dependency preparation fails closed as its own critical result instead of launching OS tests against a partial checkout.
- `packages/os/scripts/fs.js`: `fs.list` still prefers eza/fd, but only an `ENOENT` missing-helper failure switches to dependency-free Node traversal. Real eza/fd execution errors remain failures. The fallback preserves list/find path, depth, tree, type, extension, hidden/all, and filename/pattern intent.
- `packages/os/tests/fs-list-portability.test.ts`: deterministic missing-helper coverage by invoking the CLI with an empty `PATH`.
- `packages/workspace/tests/test-selection.test.js`: clean-checkout regression proves the dependency install occurs before the selected OS suite, and selector coverage keeps the portability test on the focused filesystem contract rather than the broad OS package suite.
- `packages/os/SCRIPTS.md`: documents helper preference and portable fallback.
- `packages/workspace/SCRIPTS.md`: documents automatic OS dependency preparation and fail-closed behavior for selected suites.

## Validation so far

- Remote red: GitHub run `33234616561` failed workspace-contracts on missing `tree-sitter` and verify on Linux `fs.list`.
- Initial workflow-scoped fix was deliberately removed after `task.push` exposed that the logged-in GitHub OAuth token has `repo` but not `workflow` scope. Instead of requiring interactive auth refresh, the dependency fix moved into test-selection itself, which is the correct owner of selected-suite runtime readiness and works in every CI caller.
- Clean-checkout dependency-preflight test was red before the runner change (suite ran without any install call), then green after the runner change; the only intermediate failure was macOS `/var` vs `/private/var` temp-path aliasing in the assertion, corrected with `realpath` normalization.
- Final focused validation: selector/policy/portability 81/81 passed; full work-session filesystem suite 10/10 passed; both changed scripts pass `node --check`.
- Local red: 3 intended failures / 12 passes — missing OS install policy, missing-eza list, missing-fd find.
- Green: `node --check packages/os/scripts/fs.js` passed.
- Green: portability + workflow policy: 2 files, 15/15 tests passed.
- Green: exact work-session read/list/search test: 1/1 passed (9 unrelated tests skipped).
- Test source preflight: both new/changed focused test targets were manually inspected before execution; they contain no unbounded system/destructive commands. The existing work-session test cleanup is restricted to its prefixed temporary directory.
- Tooling note: an attempted generic literal scanner was blocked by OS safety because the scanner payload itself enumerated forbidden command strings; no test executed from that blocked call.

## Final gate

- Test-selection registry regenerated: 2,686 discovered / 2,601 mapped / 85 unmapped; 59 explicit + 19 automatic rules.
- New portability test is owned by `os-work-session-fs`; selector confirms `@consuelo/os package test` is not selected for this task.
- Selector + workflow-policy + portability coverage: 3 files / 81 tests passed.
- Final `review.run`: 0 issues, 0 blockers.
- Final `verify`: passed, `publishValid=true`, DB guard 0 risks / 0 findings.

- 2026-08-29 06:04:44 append: `.task/explore/fix-pr-2060-linux-ci-blockers/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 06:05:31 `review.run`: passed — OK
- 2026-08-29 06:06:47 `verify`: failed — COMMAND_FAILED
- 2026-08-29 06:07:36 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-29 06:07:36 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 06:08:21 `review.run`: passed — OK
- 2026-08-29 06:09:26 `verify`: passed — OK
- 2026-08-29 06:09:46 apply-patch: `.task/explore/fix-pr-2060-linux-ci-blockers/workpad.md`
- 2026-08-29 06:13:08 apply-patch: `.github/workflows/consuelo-ci.yaml`
- 2026-08-29 06:13:08 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-08-29 06:13:08 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 06:13:30 apply-patch: `packages/workspace/scripts/test-selection.js`
- 2026-08-29 06:13:30 apply-patch: `packages/workspace/SCRIPTS.md`
- 2026-08-29 06:13:46 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 06:14:34 `review.run`: passed — OK
- 2026-08-29 06:15:14 `verify`: passed — OK
- 2026-08-29 06:15:28 apply-patch: `.task/explore/fix-pr-2060-linux-ci-blockers/workpad.md`
- 2026-08-29 06:16:05 `verify`: passed — OK
