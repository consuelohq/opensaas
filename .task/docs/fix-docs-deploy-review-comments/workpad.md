# fix docs deploy review comments

branch: `task/docs/fix-docs-deploy-review-comments`
stream: `stream/docs`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1349/fix-docs-deploy-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1349
started: 2026-07-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/tests/deploy-wrappers.test.js`

## workspace-owned: files changed

- `packages/workspace/tests/deploy-wrappers.test.js`

## workspace-owned: activity log

- 2026-07-03 09:17:40 fs.write: `.task/docs/fix-docs-deploy-review-comments/workpad.md`
- 2026-07-03 09:17:53 fs.write: `packages/workspace/tests/deploy-wrappers.test.js`
- 2026-07-03 09:20:48 fs.write: `.task/docs/fix-docs-deploy-review-comments/workpad.md`

## workspace-owned: validation evidence

- 2026-07-03 09:20:34 `review.run`: passed — OK
- 2026-07-03 09:20:59 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(docs): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [ ] Fix valid CodeRabbit comments on PR #1341 without broad deploy-script rewrites.
- [ ] `docs-deploy.js` handles invalid flags through a clean non-stack-trace error path.
- [ ] `web-deploy.js` validates `--branch` has a following value before forwarding args.
- [ ] `web-deploy.js` gives child deploy scripts an explicit timeout while preserving stdout/stderr forwarding and non-zero exit behavior.
- [ ] Add focused regression coverage for the parser/error behavior.
- [ ] Push through task workflow into `stream/docs`, then re-check PR #1341 and merge to `main` when merge gates allow.

## test-first contract

Behavior under test:
- Invalid docs deploy flags fail with a clear message instead of an uncaught stack trace.
- Web deploy `--branch` without a value fails with a clear message before any child deploy script runs.
- Web deploy subprocess execution includes an explicit timeout guard.

Existing pattern to follow:
- `packages/workspace/tests/website-deploy.test.js` uses Vitest with `Bun.spawnSync` to exercise script behavior as a CLI.
- Deploy scripts use `writeStdout`/`writeStderr` and process exit codes for user-facing failures.

New or changed tests:
- Add focused tests for `packages/workspace/scripts/docs-deploy.js` and `packages/workspace/scripts/web-deploy.js`.

Focused red command:
- `bun --cwd packages/workspace test tests/deploy-wrappers.test.js`

Expected red failure before implementation:
- `docs-deploy.js --bogus` currently prints an uncaught stack trace.
- `web-deploy.js docs --branch` currently proceeds with an undefined forwarded arg / child invocation path instead of a parser error.
- Static source assertion for `timeout` in `web-deploy.js` currently fails.

## implementation plan

1. Add focused failing tests for the three review comments.
2. Make the smallest script changes to pass those tests.
3. Run focused tests plus syntax/static checks on touched scripts.
4. Inspect diff, run review/verify, push task branch, promote to `stream/docs`, inspect PR #1341 checks, then merge to main if allowed.

- 2026-07-03 09:17:40 append: `.task/docs/fix-docs-deploy-review-comments/workpad.md`

- 2026-07-03 09:17:53 write: `packages/workspace/tests/deploy-wrappers.test.js`

- 2026-07-03 09:18:57 apply-patch: `packages/workspace/scripts/docs-deploy.js`
- 2026-07-03 09:18:57 apply-patch: `packages/workspace/scripts/web-deploy.js`

## implementation update

- Added `packages/workspace/tests/deploy-wrappers.test.js` to cover the three CodeRabbit findings.
- Updated `docs-deploy.js` to catch argument parsing errors and print the parser message through the script's clean error path before exiting 1.
- Updated `web-deploy.js` to reject `--branch` without a value before child script execution.
- Added a 300000 ms timeout to the `web-deploy.js` child deploy script `spawnSync` call.

## validation evidence

- Red: `trc_60804c43212f` ran `bun --cwd packages/workspace test tests/deploy-wrappers.test.js` before implementation; all 3 new tests failed for the expected behaviors.
- Green: `trc_9591b296e5a5` ran `bun --cwd packages/workspace test tests/deploy-wrappers.test.js`; 1 file / 3 tests passed.
- Syntax: `trc_d0ce256fdbc0` ran `node --check` against the two touched scripts and new test file; all passed.
- Adjacent check note: `trc_53a61725a1af` ran the new focused test plus existing `website-deploy.test.js`; the new test passed, while existing `website-deploy.test.js` failed because it references the `Bun` global under Vitest's Node environment. That failure is unrelated to this PR's script changes and existed outside the CodeRabbit scope.
- Test selection: `trc_a64330e637b0` passed `bun packages/workspace/scripts/test-selection.js check --base origin/stream/docs --json`; zero suites selected with a warning, so the focused deploy wrapper test above is the explicit coverage for this change.
- Review: `trc_1838d1fbaf8e` passed `review.run --base origin/stream/docs` with 0 owned issues and 0 blocking issues.

- 2026-07-03 09:20:48 append: `.task/docs/fix-docs-deploy-review-comments/workpad.md`

## workspace-owned: test selection

- changed files: `.task/docs/fix-docs-deploy-review-comments/current.json`, `.task/docs/fix-docs-deploy-review-comments/session.json`, `.task/docs/fix-docs-deploy-review-comments/workpad.md`, `.task/tasks/docs/fix-docs-deploy-review-comments.json`, `packages/workspace/scripts/docs-deploy.js`, `packages/workspace/scripts/web-deploy.js`, `packages/workspace/tests/deploy-wrappers.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
