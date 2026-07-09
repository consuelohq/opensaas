# fix trace watch review summary bloat

branch: `task/workspace-agents/fix-trace-watch-review-summary-bloat`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/548/fix-trace-watch-review-summary-bloat
github pr: https://github.com/consuelohq/opensaas/pull/548
started: 2026-05-23

## acceptance criteria

- [ ] Reproduce or explain the reported `review.js rejected --summary-json` path.
- [ ] Diagnose why `trace:watch` still dumps huge review payloads and can exit nonzero.
- [ ] Keep `review.run` / `verify` useful while bounding trace-watch output.
- [ ] Preserve actual review/verify checks and full evidence retrieval.
- [ ] Fix any manifest/tool alias issue seen in the trace (`git.status` unknown tool) if in scope.
- [ ] Validate direct scripts, typed facade, trace analytics/watch behavior, audit, and verify gate.

## initial evidence from Ko

- Agent report: formal verify failed because `review.js` rejected `--summary-json`.
- Trace watch excerpt: `git.status` returned `NOT_FOUND unknown tool: git.status`.
- Trace watch excerpt: `review.run` returned OK but emitted ~707,560 output tokens on a dialer task despite summary schema.
- The captured `result_json` looked summary-shaped but still contained a huge typecheck payload in summary/detail fields.

## plan

1. Inspect shipped `review.js`, `verify.js`, manifest, and trace watch scripts on main.
2. Inspect recent trace storage for the specific high-token review.run record when possible.
3. Identify whether the bloated field is summary `sample`, full stderr, or trace renderer expansion.
4. Patch the smallest safe output summarization layer.
5. Add/validate compatibility for `git.status` if the intended tool is `status`.
6. Run focused validations and publish through stream.

## current status

- Task started. Investigation in progress.

## files changed

- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `scripts/operator/trace-watch.ts`

## validation evidence

- pending

- 2026-05-23 22:38:57 write: `.task/workspace-agents/fix-trace-watch-review-summary-bloat/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `scripts/operator/trace-watch.ts`

## workspace-owned: activity log

- 2026-05-23 22:38:57 fs.write: `.task/workspace-agents/fix-trace-watch-review-summary-bloat/workpad.md`
- 2026-05-23 22:39:51 write: `packages/workspace/scripts/review.js`
- 2026-05-23 22:39:51 fs.write: `packages/workspace/scripts/review.js`
- 2026-05-23 22:39:51 write: `scripts/operator/trace-watch.ts`
- 2026-05-23 22:39:51 fs.write: `scripts/operator/trace-watch.ts`
- 2026-05-23 22:41:37 write: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 22:41:37 fs.write: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 22:41:37 write: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-23 22:41:37 fs.write: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-23 22:42:36 write: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-23 22:42:36 fs.write: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-23 22:43:30 write: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-23 22:43:30 fs.write: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-23 22:48:06 fs.write: `scripts/operator/trace-watch.ts`
- 2026-05-23 22:49:03 fs.write: `.task/workspace-agents/fix-trace-watch-review-summary-bloat/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-05-23 22:38:57 write: `.task/workspace-agents/fix-trace-watch-review-summary-bloat/workpad.md`
- 2026-05-23 22:47:39 `review.run`: passed — OK
- 2026-05-23 22:47:52 `verify`: passed — OK
- 2026-05-23 22:48:06 write: `scripts/operator/trace-watch.ts`
- 2026-05-23 22:48:33 `audit`: passed — OK
- 2026-05-23 22:48:44 `verify`: passed — OK

## investigation findings

Confirmed shipped main contains `--summary-json` support in `review.js`, `verify.js`, and the manifest. The agent report `review.js rejected --summary-json` is best explained by mixed-version task worktrees: the restarted server manifest passed the new `--summary-json` flag into older task branches whose local `packages/workspace/scripts/review.js` did not yet know that flag.

Also confirmed the trace-watch bloat is real and separate:

- A dialer `review.run` trace row had `result_json_chars = 3,023,564` and `total_tokens = 707,570`.
- Prior `trace:watch --json` selected and printed the full raw `result_json`, so SQLite and the terminal could hang/fail before any renderer compaction happened.
- The review summary payload also kept full diagnostic text in finding samples, so even summary-shaped output could still be too large.
- `git.status` is not in the manifest; agents calling it get `NOT_FOUND unknown tool: git.status` even though `status` exists.

## implemented changes

- `packages/workspace/scripts/review.js`
  - Summary findings now store bounded message previews.
  - Added `messageChars` and `messageTruncated` so full-message size remains visible without injecting full diagnostics.

- `packages/workspace/scripts/lib/facade/executor.ts`
  - Added facade-level compaction for `review.run` data.
  - Added facade-level compaction for nested `verify.review.data`.
  - Compaction converts legacy full `review --json` arrays into `review.summary.v1` for agent output.
  - This lets `review.run` use old-compatible `--json` while still returning/logging bounded summary data.

- `packages/workspace/tooling/tool-manifest.json`
  - Changed `review.run` `jsonFlag` back to `--json` for stale task-worktree compatibility.
  - Added `git.status` alias to `status` to avoid `unknown tool: git.status` failures.

- `scripts/operator/trace-watch.ts`
  - `--json` is compact by default.
  - Added `--raw-json` as an explicit escape hatch for full database rows.
  - Default SQL query now selects bounded `substr(...)` snippets plus `result_json_chars` / `stderr_chars`, so huge rows do not hang SQLite or flood terminals.
  - Human output remains compact.

- `packages/workspace/tests/facade/facade.test.ts`
  - Added regression coverage for `review.run` full-json compaction.
  - Added regression coverage for nested `verify` review-data compaction.
  - Tests assert `review.run` passes `--json`, not `--summary-json`, while returning `review.summary.v1`.

## validation evidence

- `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern "review.run|verify"`: passed, 5 tests / 18 assertions.
- `bun run trace:watch --once --limit 1 --tool review.run --json`: passed; 1 line, 1,877 chars; no raw `result_json`; parsed `review.summary.v1` for recent compact row.
- `bun run trace:watch --once --limit 1 --tool review.run --branch task/dialer/fix-queue-call-target-resolution --json`: passed in 0.2s against the historical huge row; output 1,050 chars; no raw `result_json`; preserved `result_json_chars = 3,023,564` and `total_tokens = 707,570`.
- Manifest parse: passed; `review.run` jsonFlag is `--json`; `git.status` alias exists with method path `git.status`.
- `review.run --base origin/main --noTests`: passed on this task; returned `review.summary.v1`.
- `audit --scripts`: passed; 52 documented / 52 actual.
- `verify --base origin/main --noDb`: passed; review passed; verify stamp written.

## caveats

- The live server will need restart after this lands for the manifest alias and facade compaction to take effect.
- Existing historical trace rows still record large token counts, but `trace:watch` no longer has to select or print full payloads by default.

- 2026-05-23 22:49:03 append: `.task/workspace-agents/fix-trace-watch-review-summary-bloat/workpad.md`
