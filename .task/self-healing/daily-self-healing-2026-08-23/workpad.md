# Daily self healing 2026 08 23

branch: `task/self-healing/daily-self-healing-2026-08-23`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2175/daily-self-healing-2026-08-23
github pr: https://github.com/consuelohq/opensaas/pull/2175
started: 2026-08-24

## acceptance criteria

- [x] Reconstruct the last-24h self-healing candidates from current trace evidence and current source contracts.
- [x] Fix only a bounded, high-confidence OS/tooling root cause that is not already present in current authoritative source.
- [x] Preserve healthy policy/input failures as failures while preventing caller-caused rejections from becoming defect candidates.
- [x] Validate against `origin/stream/self-healing`, promote only into `stream/self-healing`, and leave the stream-to-main PR human-only.
- [ ] Publish the normalized daily report and generated workpad to Daily Schedules.

## plan

1. Run canonical `monitor.errors`, then use the current task source fallback when installed runtime drift prevents it.
2. Check current main, `stream/self-healing`, recent stream history, `stream/os`, and hosted-user telemetry availability before selecting a candidate.
3. Reconstruct each actionable candidate from trace data and current source; do not duplicate fixes already accumulated in `stream/self-healing`.
4. For the selected monitor-classification defect, add a focused regression test first, run it red, make the smallest classifier change, then run it green.
5. Run review/verify, push the task, promote it into `stream/self-healing`, publish Daily Schedules, and clean up the merged daily task.

## current status

- Implemented one bounded new defect fix: recurring `fs.read/COMMAND_FAILED` traces caused by caller-selected non-task branch values are now classified as caller-input/non-actionable when stderr proves the task resolver rejected the selected branch. A negative control preserves real recurring `fs.read` execution failures as defect candidates.
- Current `stream/self-healing` already contains the prior fixes for `code.call` validation/wrapper attribution and the GitHub CLI resolution defect; installed `monitor.errors`, `session.start`, and GitHub runtime behavior remain behind source and must not be re-fixed in source.
- Current remote refs show `origin/main` is fully contained in `origin/stream/self-healing` (`0` main-only / `29` self-healing-only commits). `stream/os` is materially divergent and does not supersede the newer self-healing fixes relevant to today's candidates.
- Hosted install/onboarding diagnostics are not exposed through the current typed read surface; no hosted-user impact is inferred.
- Post-fix current-source monitor summary: 13 groups total; 3 caller-input, 2 defect-candidate, 6 transient, 2 unknown, 2 actionable. The remaining actionable groups are installed GitHub-wrapper drift and installed `monitor.errors` script drift already corrected in current source.

## files changed

- `packages/os/scripts/lib/monitor-errors.ts` — classify explicit inactive-task branch routing rejections from `fs.read` as caller input.
- `packages/os/tests/monitor-errors.test.ts` — regression plus negative control.
- Generated scoped task metadata/workpad files under `.task/self-healing/daily-self-healing-2026-08-23/` and `.task/tasks/self-healing/`.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-24 01:45:31 `review.run`: passed — OK
- 2026-08-24 01:45:41 `verify`: passed — OK
- 2026-08-24 01:46:09 `verify`: passed — OK

## key decisions

- Treat the three `fs.read` failures from attempted reads of `branch=main`, `branch=stream/self-healing`, and `branch=stream/os` as caller input. Their stderr is the task resolver's explicit `no active task found for branch ... run task:start first` rejection; the read implementation itself behaved as contracted.
- Do not change GitHub, `monitor.errors`, or `session.start` source for installed-runtime failures already corrected in `stream/self-healing`.
- Use the task compatibility constructor because installed `session.start` first rejected the facade-level timeout and then lacked its `session:start` script; both are existing runtime/source drift rather than today's source defect.
- Do not broaden the classifier to all `fs.read/COMMAND_FAILED`; only the exact task-resolver stderr contract is attributed to caller input, preserving unexpected recurring reader failures as actionable.

## notes for ko

- The perpetual `stream/self-healing -> main` review boundary remains human-only. This run will not deploy, release, update/restart OS, or merge that stream PR.

## improvements noticed

- The installed runtime still exposes stale compatibility surfaces (`monitor.errors`, canonical `session.start`, GitHub wrapper, and Daily Schedules facade) despite current source containing newer contracts.

## issues and recovery

- Installed `monitor.errors` failed with `Script not found "monitor:errors"`; recovered read-only by executing the current source monitor script.
- Canonical `session.start` failed first because facade `timeout` leaked into strict tool input, then without timeout because installed `session:start` was missing; recovered with the supported `task.start` compatibility alias and created PR #2175.
- Installed typed GitHub PR listing recursively resolved the Consuelo `gh` wrapper and failed JSON parsing. Current self-healing source already contains the GitHub CLI runtime-resolution fix, so this is recorded as drift instead of duplicated.
- Because the installed typed GitHub facade is the failing component, read-only PR state was verified with the external `/opt/homebrew/bin/gh` binary as the narrow fallback. PR #1941 is OPEN/CLEAN from `stream/self-healing` to `main`; task PR #2175 targets `stream/self-healing`.

## Test-first contract

behavior under test: recurring `fs.read/COMMAND_FAILED` failures whose stderr says no active task exists for the caller-selected branch are caller-input/non-actionable, while other recurring `fs.read` command failures remain defect candidates.
existing local pattern: `packages/os/tests/monitor-errors.test.ts` already table-tests caller-caused filesystem failures alongside negative controls.
new or changed tests: extend the existing filesystem caller-failure case with `fs.read` task-routing stderr plus a negative-control recurring `fs.read` runtime failure.
focused red command: `bun test packages/os/tests/monitor-errors.test.ts`
expected red failure: the new `fs.read` routing case is classified `defect-candidate` instead of `caller-input` before implementation.
no-test waiver: not applicable; this is deterministic classification logic with an existing focused unit-test seam.

## validation summary

- RED: `bun test packages/os/tests/monitor-errors.test.ts` => 8 pass / 1 fail; the new `fs.read` routing case was incorrectly `defect-candidate` and actionable.
- GREEN: same focused test => 9 pass / 0 fail / 17 assertions.
- Runtime proof: current-source `monitor-errors.ts` moved the observed `fs.read/COMMAND_FAILED` group from actionable defect candidate to caller-input; actionable groups fell from 3 to 2 without hiding the trace.
- Strict review against `origin/stream/self-healing`: 2 source/test files, 0 blocking issues, 0 pre-existing issues.
- Full verify against `origin/stream/self-healing`: passed, publish-valid, DB guard 0 risks / 0 findings; verify stamp written.
- Git diff was inspected after edits; only the two intended source/test files plus generated task metadata/workpad are changed.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/skills/artifacts/SKILL.md`
- `packages/os/tests/monitor-errors.test.ts`

- 2026-08-24 01:44:11 apply-patch: `.task/self-healing/daily-self-healing-2026-08-23/workpad.md`
- 2026-08-24 01:44:18 apply-patch: `packages/os/tests/monitor-errors.test.ts`
- 2026-08-24 01:44:30 apply-patch: `packages/os/scripts/lib/monitor-errors.ts`

- 2026-08-24 01:46:02 apply-patch: `.task/self-healing/daily-self-healing-2026-08-23/workpad.md`
