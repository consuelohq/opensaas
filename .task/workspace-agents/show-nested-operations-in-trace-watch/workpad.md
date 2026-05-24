# show nested operations in trace watch

branch: `task/workspace-agents/show-nested-operations-in-trace-watch`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/567/show-nested-operations-in-trace-watch
github pr: https://github.com/consuelohq/opensaas/pull/567
started: 2026-05-24

## acceptance criteria

- [ ] Keep existing trace:watch parent row format unchanged for ordinary tools.
- [ ] Show compact child lines for nested operations under `code.run` rows.
- [ ] Show compact child lines for `batch` rows by pairing batch input steps with result entries.
- [ ] Avoid bloating normal trace rows; do not fetch full result_json globally.
- [ ] Support disabling/capping nested output.
- [ ] Keep JSON/raw JSON behavior predictable.
- [ ] Add focused validation or script smoke that proves formatter behavior.

## plan

1. Refactor trace-watch formatter minimally to expose/test nested extraction and rendering.
2. Extend SQL select with small JSON-extracted nested columns for code.run and batch.
3. Add CLI flags: `--no-nested`, `--nested-limit <n>`.
4. Render child lines only for `code.run` and `batch`, before the divider.
5. Add focused formatter tests if practical; otherwise use CLI `--once` smokes.
6. Validate with syntax checks, focused tests/smokes, diff inspection, verify.

## current evidence

- `scripts/operator/trace-watch.ts` owns the watch CLI.
- `renderRow` currently prints one parent line, optional error detail, then divider.
- `code.run` already returns `data.operations`; execution changes should not be needed.
- `batch` returns `data.results`; renderer can pair those with input `steps`.
- Current SQL truncates normal `result_json` to 4000 chars, so nested data should be extracted explicitly rather than relying on the truncated payload.

## files changed

- `scripts/operator/trace-watch.ts`

## validation evidence

- `bun scripts/operator/trace-watch.ts --help`: passed; new `--no-nested` and `--nested-limit <n>` flags appear.
- Fixture SQLite smoke passed: normal rows still render one parent line; `code.run` renders `context.trace` and `mac.exec` child lines; `batch` renders `fs.read` and `github` child lines; ordinary `status` row does not expand.
- `--no-nested` fixture smoke passed; no child glyphs are emitted.
- `--nested-limit 1` fixture smoke passed; overflow line shows `… 1 more nested operation`.
- `--json` fixture smoke passed; compact JSON includes `nested_operations` for `code.run`.
- Live trace smoke passed: `bun run trace:watch -- --once --limit 1 --tool code.run --no-color --nested-limit 4` shows nested `fs.list` / `fs.read` child rows from a real persisted `code.run` trace.
- `bun build scripts/operator/trace-watch.ts --target=bun --outfile=/tmp/trace-watch-build.js`: passed.
- `git diff -- scripts/operator/trace-watch.ts`: inspected.

## issues and recovery

- Initial `fs.write` workpad write failed on multiline `--content` shell quoting; recovered with scoped `task.exec` Python write.
- Initial fixture shape used `$.data.operations`; live persisted traces wrap tool output one level deeper at `$.data.data.operations`. Updated extractors and SQL JSON paths to support both.
- `review.run` and `verify` both timed out; direct verify spawned long-running repo-wide eslint over `packages/twenty-front`/`packages/twenty-server`. Killed the runaway lint processes after collecting evidence. Formal publish gate remains the only unresolved blocker.

## workspace-owned: validation evidence

- pending
- 2026-05-24 06:05:33 `review.run`: passed — OK
- 2026-05-24 06:05:52 `verify`: passed — OK
- 2026-05-24 06:05:52 `verify`: passed — OK
- 2026-05-24 06:05:52 `verify`: passed — OK
- 2026-05-24 06:05:52 `verify`: passed — OK
- 2026-05-24 06:06:07 `review.run`: passed — OK
- 2026-05-24 06:07:57 `review.run`: passed — OK

## publish blocker

- `task.push` blocked as expected because full `verify` did not complete and no publish-valid `.task/workspace-agents/show-nested-operations-in-trace-watch/verify.json` stamp exists.
- `task.push` stderr: publish-valid verify required before task:push; dangerous bypass requires explicit Ko approval.
- Do not use dangerous bypass unless Ko explicitly approves.
