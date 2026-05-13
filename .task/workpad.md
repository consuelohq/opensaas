# fix pr 389 research ingest review findings

branch: `task/workspace-agents/fix-pr-389-research-ingest-review-findings`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/390
started: 2026-05-13

## accepted review findings

- [x] CodeRabbit inline comment on `packages/workspace/scripts/research-ingest.js`: `textAtPath` rejected short valid string values such as `"auto"` by using `isUsableText`.
- [x] Apply the same non-empty string behavior to the similar direct text candidate check in `findText`.

## acceptance criteria

- [x] Preserve explicit short extracted tokens instead of falling back to raw JSON.
- [x] Keep metadata branch skipping (`input`, `env`, `metrics`, `diagnostics`, `prompt`) so the earlier `input.markdown = "readability"` bug stays fixed.
- [x] Add regression coverage for a short extracted token.
- [x] Rerun focused test and a real Dirac ingest smoke.
- [x] Promote the fix back into the stream review PR.

## plan

1. Start a dedicated review-fix task from `stream/workspace-agents`.
2. Read standards and the target file/test.
3. Replace config-value filtering with plain non-empty string checks in ordered path extraction and direct text candidate selection.
4. Add a regression for `extracted.content = "auto"`.
5. Validate syntax, focused tests, real ingest smoke, audit, review, and verify.
6. Push, merge into stream, then ship the stream PR to main.

## files changed

- `packages/workspace/scripts/research-ingest.js`
- `packages/workspace/tests/research-ingest.test.js`

## key decisions

- Removed the config-value blacklist entirely. The parser now accepts any non-empty string candidate in the ordered content paths.
- Kept branch skipping for metadata/config containers. This keeps `input.markdown = "readability"` from winning while still allowing legitimate `extracted.content = "auto"`.

## validation

- `checkFiles` for `packages/workspace/scripts/research-ingest.js` and `packages/workspace/tests/research-ingest.test.js` passed.
- `cd packages/workspace && bun run test tests/research-ingest.test.js` passed: 2 tests.
- Real ingest smoke: `bun run research:ingest -- https://github.com/dirac-run/dirac --out-dir <tmp> --no-context-save --json` wrote `extracted.md` length 24,963 and `hasReadabilityOnly: false`.
- `workspace audit { scripts: true }` passed: 48 documented scripts, 48 actual scripts, no drift.
- `workspace review.run { base: "origin/stream/workspace-agents", noTests: true }` passed.
- `workspace verify { base: "origin/stream/workspace-agents", noDb: true }` passed.
- Diff inspected for changed code and test files.

## notes for ko

- This task is scoped to the CodeRabbit finding on PR #389.
- `stream.sync` failed before task start because an existing stream worktree owns the local `stream/workspace-agents` branch. I continued from the existing stream branch and will handle final main merge through the stream PR.
- The first `pr.review` tool named by the qudo skill was not available in this workspace instance; the review source was the supplied CodeRabbit inline comment.

## publish checklist

```bash
bun run task:push -- --message "fix(workspace-agents): address pr 389 review findings" --changed
bun run task:pr
```

- 2026-05-13 06:07:51 write: `.task/workpad.md`