# make review run resumable for verify

## acceptance criteria

- Add guidance so agents treat `review.run` or `verify` transport timeouts as unknown completion state, not review failure.
- Make the underlying review runner durable/resumable enough that both `workspace review.run` and `verify` inherit safe same-branch/base/diff behavior.
- Preserve `verify` semantics: review summary JSON contract, DB guardrails, and publish-valid stamp behavior.
- Do not add a new user-facing wait/status tool unless absolutely required.
- Validate review and verify paths with focused workspace tests/smokes.

## implementation

- Added `packages/workspace/scripts/lib/review-run-state.js` for durable structured review state keyed by repo/worktree, branch, base, head SHA, tracked-change hash, and structured review flags.
- Updated `packages/workspace/scripts/review.js` so structured review output (`--json` / `--summary-json`) records stdout/stderr/exit code and replays equivalent completed runs instead of launching duplicate review gates.
- Kept replay/attach notices on stderr, preserving stdout JSON for `verify` parsing.
- Left non-structured human review output uncached so interactive output and AI-review kickoff behavior remain unchanged.
- Added tests in `packages/workspace/tests/review-run-state.test.js` for completed replay, stale lock orphan recovery, and output-contract-specific identity keys.
- Updated `packages/workspace/STEERING.md` to require agents to treat `review.run` / `verify` transport timeouts as unknown state and avoid push/promotion/retry until existing state is known.
- Updated `packages/workspace/SCRIPTS.md` to document the shared review state that `verify` inherits.

## validation evidence

- `node --check packages/workspace/scripts/review.js` passed.
- `node --check packages/workspace/scripts/lib/review-run-state.js` passed.
- `node --check packages/workspace/tests/review-run-state.test.js` passed.
- `cd packages/workspace && bun run test tests/review-run-state.test.js` passed: 3 tests.
- Review replay smoke passed: two identical `bun run review -- --base origin/stream/workspace-agents --summary-json --quiet --no-tests` runs produced identical JSON stdout and the second run reported reuse on stderr.
- Verify parsing smoke passed: `verify --base origin/stream/workspace-agents --no-stamp --json` consumed review summary JSON cleanly and reported `publishValid=true`.
- `workspace review.run` passed with 0 blocking issues.
- `workspace verify` passed full mode and wrote a publish-valid stamp to `.task/workspace-agents/make-review-run-resumable-for-verify/verify.json`.
- `workspace audit --scripts` passed: documented scripts match actual scripts.

## notes

- No new user-facing wait/status tool was added.
- Review state is stored via `git rev-parse --git-path opensaas-review-runs`, so it is local git metadata and does not add `.task` or PR diff noise.

- 2026-05-26 18:02:17 write: `.task/workspace-agents/make-review-run-resumable-for-verify/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-26 18:02:17 fs.write: `.task/workspace-agents/make-review-run-resumable-for-verify/workpad.md`
