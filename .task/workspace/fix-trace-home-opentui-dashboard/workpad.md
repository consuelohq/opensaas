# fix trace home opentui dashboard

branch: `task/workspace/fix-trace-home-opentui-dashboard`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/689/fix-trace-home-opentui-dashboard
github pr: https://github.com/consuelohq/opensaas/pull/689
started: 2026-06-02

## objective

Replace the first-pass `trace:home` print-loop dashboard with an actual terminal homebase that matches Ko's screenshot contract closely enough to use as the live trace operator surface.

## acceptance criteria

- [x] Read Ko's local OpenTUI skill before implementation.
- [x] Try the requested OpenTUI dependency path and record any install blocker.
- [x] Add/update tests before implementation for model population, sanitization, command classification, tree context, renderer frame output, and terminal lifecycle sequences.
- [x] Render `trace:home` as a full-screen TUI in live TTY mode using the alternate screen buffer and in-place redraw.
- [x] Preserve deterministic non-interactive `--once --limit 40 --no-color` output.
- [x] Show header, live table, sidebar summary, top tools, raw shell quality, key hints, inspect pane, tree pane, and JSON pane.
- [x] Implement keys for quit, pause, movement, open, search, failed filter, branch/tool filter, group, refresh, copy, help, and escape/back.
- [x] Sanitize wrapper internals such as `execFileSync('gh', args` from default table/inspect/json output.
- [x] Classify both `task.call` and `task.exec` command shapes as good/suspect/bad.
- [x] Update `packages/workspace/SCRIPTS.md` for changed command behavior.

## Test-first contract

Focused tests in `packages/workspace/tests/trace-home.test.ts` cover:

- dashboard model sections from fixture traces;
- GitHub wrapper sanitization and compact default JSON;
- `task.call` and `task.exec` command quality;
- `batch` and `code.run` tree children with selected context;
- deterministic fixed-size renderer output;
- alternate-screen enter/exit lifecycle sequences;
- trace DB path resolution.

The red run failed before implementation because `sanitizeDefaultText` was not exported yet.

## plan

1. Read current first-pass implementation, tests, script docs, OpenTUI skill/docs, and prior workpad.
2. Add stricter fixture-driven tests that encode the screenshot contract and current broken cases.
3. Attempt `bun add @opentui/core`; use raw alternate-screen TUI if dependency installation is blocked.
4. Replace the static print loop with a stateful alternate-screen renderer and keyboard loop.
5. Validate with focused tests, build, and once-mode smoke.
6. Review diff, run review/verify, and publish to a main-targeted PR.

## current status

- Implementation complete locally on the task branch.
- OpenTUI install was attempted but blocked by workspace lockfile/workspace resolution in the sparse task worktree. The implementation therefore uses the permitted fallback: a dependency-free alternate-screen raw-mode TUI.
- The PR was initially created by task tooling against `stream/workspace`; it still needs to be retargeted to `main` before final delivery because Ko explicitly asked for a main-targeted PR.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/tests/trace-home.test.ts`
- `scripts/operator/trace-home.ts`

## validation evidence

- red: `bun test packages/workspace/tests/trace-home.test.ts` failed because `sanitizeDefaultText` was not exported.
- green: `bun test packages/workspace/tests/trace-home.test.ts` passed, 7 tests, 40 expects.
- build: `bun build scripts/operator/trace-home.ts --target=bun` passed.
- smoke: `bun run trace:home -- --once --limit 40 --no-color` passed and rendered one deterministic frame.

## key decisions

- Did not add `@opentui/core` after `bun add @opentui/core@latest` failed with `UnsupportedYarnLockfileVersion` and missing workspace package errors.
- Used an alternate-screen raw-mode TUI because the task prompt allowed this fallback when OpenTUI was risky.
- Kept default JSON compact and sanitized; raw-like content remains available through `--raw-json`.
- Marked timing as unavailable/derived instead of fabricating provider/emit timing.

## notes for ko

- `trace:home` now exits non-TTY mode after one frame instead of starting an infinite print loop. Live TTY mode enters the alternate screen and redraws in place.
- `task.exec` is now included in raw-shell quality counts with the same classification logic as `task.call`.

## issues and recovery

- Dependency install blocker: `bun add @opentui/core@latest` failed because Bun could not migrate the Yarn lockfile and could not resolve sparse-worktree packages. Recovery was the accepted fallback TUI implementation without new dependency.

---

## publish checklist

```bash
bun run review
bun run verify
bun run task:push -- --message "feat(workspace): make trace home an interactive tui" --changed
# Retarget PR #689 to main or recreate a main-targeted PR before final handoff.
```

- 2026-06-02 02:48:12 write: `.task/workspace/fix-trace-home-opentui-dashboard/workpad.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/tests/trace-home.test.ts`
- `scripts/operator/trace-home.ts`

## workspace-owned: activity log

- 2026-06-02 02:48:12 fs.write: `.task/workspace/fix-trace-home-opentui-dashboard/workpad.md`

## workspace-owned: validation evidence

- red: `bun test packages/workspace/tests/trace-home.test.ts` failed because `sanitizeDefaultText` was not exported.
- green: `bun test packages/workspace/tests/trace-home.test.ts` passed, 7 tests, 40 expects.
- build: `bun build scripts/operator/trace-home.ts --target=bun` passed.
- smoke: `bun run trace:home -- --once --limit 40 --no-color` passed and rendered one deterministic frame.
- 2026-06-02 02:48:45 `review.run`: passed — OK
- 2026-06-02 02:48:59 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace/fix-trace-home-opentui-dashboard.json`, `.task/workspace/fix-trace-home-opentui-dashboard/current.json`, `.task/workspace/fix-trace-home-opentui-dashboard/evidence-log.json`, `.task/workspace/fix-trace-home-opentui-dashboard/read-log.json`, `.task/workspace/fix-trace-home-opentui-dashboard/session.json`, `.task/workspace/fix-trace-home-opentui-dashboard/workpad.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/tests/trace-home.test.ts`, `scripts/operator/trace-home.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none
