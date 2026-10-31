# Fix task cleanup merge detection and restore live tool trace analytics

branch: `task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2758
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/tests/task-cleanup-merged-targets.test.ts`
- `packages/os/tests/trace-analytics-live-db.test.ts`
- `scripts/operator/trace-analytics-db.ts`

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## User-approved maintenance context — October 31, 2026
- Root cause: both OS/workspace `task-cleanup.js` call `isBranchMerged(repoRoot, branch)` without required `into`; `--merged` silently finds zero.
- Conservative local cleanup removed 731 GitHub-backed unregistered local branches, preserved all agent worktrees. Additional 66-day inactive worktree safely evicted with recovery, measured free-volume increase ~0.46 GiB. Existing live agents (4+) untouched.
- Root `trace:analytics` exists but points to July 29 obsolete OpenWorkspace DB. Canonical current store is `~/.consuelo/node/db/traces.db` (>6800 entries today).
- `monitor.errors` fails due missing resolution of monitor:errors package script; separate follow-up for tools.

## Test-first contract
1. Test merged detection for task branch owning stream, main fallback, non-merged and missing references; RED before implementation, GREEN after.
2. Preserve registered active/evicted task branches and checked-out worktrees in implicit --merged, leave --stale-days archive-safe behavior unchanged; protect unverified local-only commits.
3. Prefer canonical OS trace DB for root trace:analytics with legacy fallback and explicit override intact; test fixture or exact DB smoke and no raw personal data emitted.
4. Strict review, verify, task.push and task.pr to stream/os only; no main merge or deployment.

- 2026-10-31 07:45:45 append: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/task-cleanup-merged-targets.test.ts`
- `packages/os/tests/trace-analytics-live-db.test.ts`
- `scripts/operator/trace-analytics-db.ts`

## workspace-owned: activity log

- 2026-10-31 07:45:45 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:46:14 write: `packages/os/tests/task-cleanup-merged-targets.test.ts`
- 2026-10-31 07:46:14 fs.write: `packages/os/tests/task-cleanup-merged-targets.test.ts`
- 2026-10-31 07:46:28 append: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:46:28 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:47:05 write: `packages/os/tests/trace-analytics-live-db.test.ts`
- 2026-10-31 07:47:05 fs.write: `packages/os/tests/trace-analytics-live-db.test.ts`
- 2026-10-31 07:47:18 write: `scripts/operator/trace-analytics-db.ts`
- 2026-10-31 07:47:18 fs.write: `scripts/operator/trace-analytics-db.ts`
- 2026-10-31 07:49:37 append: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:49:37 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:54:03 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:55:28 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 07:55:58 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- 2026-10-31 08:01:31 fs.write: `.task/os/fix-task-cleanup-merge-detection-and-restore-live-tool-trace-analytics/workpad.md`
- Both Git helper variants now infer owning origin/stream/<area> and origin/main, fail closed on absent refs and preserve explicit target semantics.
- bun run trace:analytics from source succeeded against live 2 GB canonical trace DB (484,688 historical rows); previous sqlite3 process-per-query method failed with database is locked.
- Exact suite `bunx vitest run packages/os/tests/task-cleanup-merged-targets.test.ts --reporter=dot` before product edits: 6 FAILED / 2 passed; owning stream/main implicit target checks fail for both git helpers, both implicit --merged safety guard assertions fail. Explicit target/unmerged checks already pass.
- Implicit task:cleanup --merged now refuses registered active/recoverable tasks and checked-out worktrees. --stale-days recovery path untouched.
- No changes to global main checkout or concurrent agent work. Next: formal strict review and verify, publish stream/os only.
- Product files unmodified at red checkpoint; no actual cleanup invoked by tests.
- Root trace:analytics prefers current OS node/db/traces.db, preserves env/flag override and retired legacy fallback, and uses a single read-only Bun SQLite connection with bounded busy timeout.
- Test RED: cleanup 6 fail/2 pass, trace DB test failed to import absent helper. Test GREEN: 12/12 across three suites. Syntax and git diff whitespace checked.

## workspace-owned: validation evidence

- 2026-10-31 07:49:52 `review.run`: passed — OK
- 2026-10-31 07:51:21 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:54:15 `review.run`: passed — OK
- 2026-10-31 07:56:14 `verify`: failed — COMMAND_FAILED
- 2026-10-31 08:02:47 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
