# unblock workspace-agents release after main sync

branch: `task/workspace-agents/unblock-workspace-agents-release-after-main-sync`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2237/unblock-workspace-agents-release-after-main-sync
github pr: https://github.com/consuelohq/opensaas/pull/2237
started: 2026-08-27

## acceptance criteria

- [x] Runtime-owned `session.start` remains resolvable from the installed OS package.
- [x] `session.start({ kind: "task" })` delegates `task-start.js` with the configured project checkout as cwd so task creation can resolve the target Git repository.
- [x] `session.start({ kind: "work" })` behavior remains unchanged.
- [x] OS/workspace session-start compatibility remains green.
- [x] Script-parity classifications cover the complete current stream inventory, including the three newly OS-owned Google scripts.
- [x] Strict review and canonical verify pass; task PR #2237 is ready to promote to `stream/workspace-agents`.

## plan

1. Reproduce the Codex task-cwd regression and current script-parity drift with focused tests.
2. Preserve runtime script resolution while handing the configured project cwd into task creation; keep the workspace parity copy aligned.
3. Classify only the missing OS-only scripts with explicit reasons.
4. Run focused green tests, inspect the diff, then run strict review and canonical verify.
5. Promote this task to the stream, reconcile the stream with current `main`, and retry release PR #2193.

## current status

- Focused implementation is complete and green. Preparing strict review/verify before stream promotion.

## files changed

- `packages/os/scripts/session-start.ts` — pass the configured project cwd into delegated task creation while retaining runtime-owned script resolution; use URL-based script directory resolution.
- `packages/workspace/scripts/session-start.ts` — mirror the session-start compatibility behavior.
- `packages/os/tests/session-start-foundation.test.ts` — regression for task cwd handoff from runtime `session.start`.
- `packages/os/tests/audit/fixtures/script-parity-classifications.json` — explicitly classify `google.ts`, `google-workspace-auth.ts`, and `managed-gog.ts` as intentional OS-only runtime scripts.

## workspace-owned: files changed

- Same production/test files above plus task metadata and this workpad.

## workspace-owned: activity log

- 2026-08-27 00:49:13 fs.write: `.task/workspace-agents/unblock-workspace-agents-release-after-main-sync/workpad.md`

## workspace-owned: validation evidence

- RED `trc_0ba47ee51746`: focused task-cwd regression failed because `startTaskSession` did not expose the cwd handoff.
- RED parity evidence `trc_ac6b5758290e`: audit identified exactly three unclassified OS scripts (`google.ts`, `google-workspace-auth.ts`, `managed-gog.ts`).
- GREEN `trc_0c76f9bfede7`: OS session foundation + workspace session compatibility + script parity all passed, 16/16 tests.
- VERIFY diagnostic `trc_44646e6491a7`: every focused session suite passed; only the auto-selected whole-OS package suite failed on unrelated daemon/cleanup/subagent tests because the script-parity fixture had no exclusive selector ownership.
- Selector RED `trc_8cc21f8a4188`: changing only the script-parity classification fixture selected `auto:@consuelo/os:package-test` and no focused parity rule.
- Selector GREEN `trc_4fbac08d1778`: `os-script-parity-audit` exclusively owns the fixture and selects only the focused audit contract.
- Strict review `trc_b9dfd127d8d6`: 0 blocking issues and 0 documentation opportunities.
- FINAL VERIFY `trc_1ab5385b209f`: full canonical gate passed and wrote a publish-valid stamp against `origin/stream/workspace-agents`.
- 2026-08-27 00:52:06 `review.run`: passed — OK
- 2026-08-27 00:52:57 `verify`: failed — COMMAND_FAILED
- 2026-08-27 00:54:48 `review.run`: passed — OK
- 2026-08-27 00:55:07 `verify`: passed — OK

## key decisions

- Keep `executionScope: "runtime"`; that is required to resolve the shipped `session:start` script. Repair task creation at the delegation boundary by setting the child cwd to the active workspace project checkout.
- Keep the OS/workspace `session-start.ts` copies behaviorally aligned.
- Treat the Google scripts as OS-only intentional because all three exist only under `packages/os` and implement the managed Google runtime surface.
- Give the parity classification fixture explicit critical selector ownership so a narrow audit-data edit cannot drag in unrelated package-wide tests.

## notes for ko

- The latest Codex P1 on PR #2193 was valid and is addressed here before release.

## improvements noticed

- none yet

## issues and recovery

- The first direct task-cwd test used Bun globals under Vitest's Node runtime; the harness was corrected before production edits were considered green.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `session.start({kind:"task"})` must resolve the shipped runtime-owned `session:start` implementation without losing the configured project repository cwd; `kind:"work"` must still execute from the shipped runtime package. Current-main script-parity classifications must exactly match the merged OS script inventory so stream sync does not fall through to a stale package-wide audit failure.
existing local pattern: `session.start` delegates task creation through `packages/os/scripts/session-start.ts` to `packages/workspace/scripts/task-start.js`; facade runtime execution scope currently changes the outer cwd. Script parity is enforced by `packages/os/tests/audit/script-parity-audit.test.ts` against `packages/os/tests/audit/fixtures/script-parity-classifications.json`.
new or changed tests: add a focused installed-runtime task-session regression that proves task start receives the project checkout cwd while work sessions retain runtime execution; use the existing script-parity audit as the red/green contract for the classification refresh.
focused red command: `bunx vitest run packages/os/tests/session-start-foundation.test.ts packages/os/tests/audit/script-parity-audit.test.ts`
expected red failure: the task-mode installed-runtime assertion should show runtime package cwd instead of the target repo; script-parity audit should identify current-main scripts missing from classifications.
no-test waiver: not applicable.

- 2026-08-27 00:49:13 append: `.task/workspace-agents/unblock-workspace-agents-release-after-main-sync/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-project-cwd.ts`
- `packages/os/scripts/session-start.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/workspace/scripts/session-start.ts`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-27 00:54:02 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-27 00:54:35 apply-patch: `.task/workspace-agents/unblock-workspace-agents-release-after-main-sync/workpad.md`

- 2026-08-27 00:55:14 apply-patch: `.task/workspace-agents/unblock-workspace-agents-release-after-main-sync/workpad.md`