# Hotfix worker drain continuity to main

branch: `task/os/hotfix-worker-drain-continuity-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2134/hotfix-worker-drain-continuity-to-main
github pr: https://github.com/consuelohq/opensaas/pull/2134
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 06:09:36 fs.write: `.task/os/hotfix-worker-drain-continuity-to-main/workpad.md`
- 2026-08-16 06:13:03 fs.write: `.task/os/hotfix-worker-drain-continuity-to-main/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:12:36 `review.run`: passed — OK
- 2026-08-16 06:12:51 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: current `main` must preserve an in-flight MCP response while a supervised Bun worker drains and exits during a rolling update.
existing local pattern: worker drain marks `/ready` unavailable, uses the worker runtime request counter, and exits through `runDrainAndExit`; the already-verified stream fix moves graceful listener stop after handler idle plus a bounded response-flush window.
new or changed tests: port the verified `health-readiness.test.ts` ordering, real child-Bun 2 MB response, and timeout fallback coverage only if current main lacks it.
focused red command: run the current-main health-readiness drain-order/child-process regression before production edit.
expected red failure: current main either calls graceful server stop while an application request is active or truncates the real child-Bun response when the worker exits.
no-test waiver: none.

## Hotfix scope

This task starts from `main` specifically because `stream/os` is blocked by unrelated unresolved Device Authority product conflicts in another agent's shared worktree. It will carry only the verified worker-drain continuity product changes from #2132, validate against `origin/main`, and use the repository's prior task/os -> main hotfix precedent (#2034). It must not modify or resolve the shared stream conflicts.

- 2026-08-16 06:09:36 append: `.task/os/hotfix-worker-drain-continuity-to-main/workpad.md`

- 2026-08-16 06:10:05 apply-patch: `packages/os/tests/health-readiness.test.ts`
- 2026-08-16 06:10:17 apply-patch: `packages/os/tests/health-readiness.test.ts`
- 2026-08-16 06:10:47 apply-patch: `packages/os/scripts/server/main.ts`
- 2026-08-16 06:11:16 apply-patch: `packages/os/SCRIPTS.md`

## Validation and publish decision

- RED on current main: drain-order regression failed because graceful stop had already been called while the application request was active (`trc_0a6a638641b9`).
- GREEN: focused health-readiness 8/8 (`trc_4d47f59e261c`).
- Main-based critical lifecycle gate: 19 files / 204 tests passed (`trc_158207e43959`).
- Current-main selection integrity: 43/43 passed (`trc_3ffe11134b9f`).
- Syntax: passed (`trc_f79a03dee602`).
- Strict review: 0 blockers (`trc_c78a9955ad8a`).
- Formal verify: passed, `publishValid=true` (`trc_8d62c6a22249`).
- Diff is exactly three product files: SCRIPTS.md, server/main.ts, health-readiness.test.ts. No Device Authority or stream-conflict files are included.
- Publish path: push this main-started task branch, then retarget its PR to `main` using the repository's prior direct-hotfix precedent (#2034). Do not merge or modify the blocked shared `stream/os` worktree.

- 2026-08-16 06:13:03 append: `.task/os/hotfix-worker-drain-continuity-to-main/workpad.md`
