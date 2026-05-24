# show verify reason in trace watch

branch: `task/workspace-agents/show-verify-reason-in-trace-watch`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/585/show-verify-reason-in-trace-watch
github pr: https://github.com/consuelohq/opensaas/pull/585
taskSession: `tsk_43d1c01be9fa`
started: 2026-05-24

## objective

Make `verify` explain why its test selection passed or failed, and make `trace:watch` show that full explanation for verify rows while keeping the rest of the trace compact.

## Ko-approved direction

- Keep trace output compact generally.
- Special-case `verify` so the full "because" explanation is visible in `trace:watch`.
- This should support the planned test-selection registry/policy work by making selected suites, zero-suite reasons, and DB/review/stamp phases visible.

## acceptance criteria

- [ ] `verify` JSON includes a compact `because` section explaining review, tests, DB, and stamp phases.
- [ ] `trace:watch` renders full `because` lines for `verify` rows.
- [ ] Non-verify trace rows remain compact.
- [ ] No raw review/verify payload dumping is reintroduced.
- [ ] Add focused tests or smoke validation for verify and trace-watch behavior.
- [ ] Run audit and formal verify before publish.

## plan

1. Inspect current verify output shape and trace-watch renderer.
2. Add a `because` object/array to verify output using current available review/test/DB/stamp data.
3. Extend trace-watch compact renderer to preserve/show full verify `because` content.
4. Validate with direct verify JSON smoke and trace-watch smoke.
5. Push/promote/ship if clean.

- 2026-05-24 08:34:23 write: `.task/workspace-agents/show-verify-reason-in-trace-watch/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-24 08:34:23 fs.write: `.task/workspace-agents/show-verify-reason-in-trace-watch/workpad.md`
- 2026-05-24 08:39:55 fs.write: `.task/workspace-agents/show-verify-reason-in-trace-watch/workpad.md`

## workspace-owned: validation evidence

- 2026-05-24 08:37:04 `verify`: passed — OK
- 2026-05-24 08:39:10 `audit`: passed — OK
- 2026-05-24 08:39:42 `verify`: passed — OK

## implementation update

Implemented the approved trace visibility requirement:

- `verify` now builds a `because` section with full explanation lines for review, test selection, DB guard, and stamp status.
- Human `verify` output prints the same `because` lines.
- Structured `verify --json` includes `because` near the top-level result.
- `trace:watch` now special-cases `verify` compact rows so compact JSON preserves `result.because`.
- Human `trace:watch` now prints the full `because` section for verify rows while keeping other row detail compact.

Validation evidence:

- `node --check packages/workspace/scripts/verify.js`: passed.
- `bun build scripts/operator/trace-watch.ts --target=bun --outfile=/tmp/trace-watch-verify-because.js`: passed.
- Direct `bun run verify -- --base origin/main --json --no-stamp` in task worktree produced top-level `because.lines` with review/test/db/stamp explanations.
- Synthetic trace DB smoke passed: `trace:watch --tool verify` printed full `because` lines in human output and preserved `result.because.lines` in compact JSON.
- `audit --scripts`: passed.
- `git.diff`: inspected.
- Formal typed `verify` passed and wrote a publish-valid stamp. The currently running server does not show `because` in the typed response until this task ships/restarts, but the task-worktree script output and trace renderer are validated.

- 2026-05-24 08:39:55 append: `.task/workspace-agents/show-verify-reason-in-trace-watch/workpad.md`
