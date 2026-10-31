# DEV-1665 stream-align trace labels and explore diagnostics

branch: `task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2751
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
# DEV-1665 — clean stream publication of actionable trace labels and explore diagnostics

Stream: `stream/os`
Source task: `tsk_3a8b304898f3` (PR #2748), based on divergent main history
Replacement task: `tsk_52aa629ce940` (PR #2751), started directly from stream/os
Linear: https://linear.app/consuelo/issue/DEV-1665/improve-agent-trace-action-labels-and-explore-failure-diagnostics
Approval: complete task verification and publish **only through stream/os**. Do not merge main or deploy; do not delete another agent's files.

## Acceptance criteria
- [ ] Preserve 4 existing regression tests + 3 explore diagnostic cases, and their red/green evidence, without clobbering stream changes.
- [ ] Show actual patchText file targets in trace Input/Output; useful code.call codeFile, CLI, and multiline targets; safe Linear identifiers/actions; preserve redaction.
- [ ] Improve explore error descriptions by preserving phase/cause and safe next action, with bounded credential redaction; no DB behavioral changes.
- [ ] Verify exact changes with focused tests + managed full gate, investigate attributable failures and do not bypass checks.
- [ ] Promote to stream/os through managed task push/PR and confirm stream head; close #2748 as superseded if replacement succeeds.
- [ ] Preserve current local user system.md, keep local Mac routing and runtime untouched; record full evidence in Linear.

## Test-first contract
Behavior under test: On the stream/os baseline, trace labels from typed patchText and code.call match specific paths, public Linear issue identifiers and operations remain visible without private text, and explore failure retains technical category, phase and recovery hints.
Existing local pattern: `packages/os/tests/trace-site-inspector-os-owned.test.ts` and `packages/os/tests/explore-output-contract.test.ts` use Vitest fixtures. Current main source has additional trace formatter improvements missing on stream/os, so consider those baseline functionality before replacing any file.
New or changed tests: port ONLY the changed tests from original task branch to stream-based worktree first; confirm expected red. Then apply scoped production diff and any necessary already-shipped formatter compatibility while preserving all stream changes.
Focused red: `bunx vitest run tests/trace-site-inspector-os-owned.test.ts tests/explore-output-contract.test.ts` with cwd `packages/os`.
Expected red: old stream renderer gives generic patch/code/Linear labels and does not expose explore failure helper.
No-test waiver: none.

## Evidence from source session
- Mac OS 0.1.146 is ready; local disk had 16 GiB free, later 26 GiB free. No files were removed.
- Source task had 57/57 focused trace/explore/gateway tests and typecheck passing.
- Source full verify static review passed, but `trace-persistence.test.ts` failed while other agents concurrently verified and Mac was previously low on disk; no proof of attributable regression. Do not ignore failing suite.
- Source PR #2748 reports DIRTY; task HEAD and stream HEAD diverged by 36 vs 37 commits, no stream-side changes in the five target file paths since common merge-base.
- One formatter has ~208 lines of differences between original main base and stream baseline. Do not silently copy it unless needed to retain current installed behavior, and document exact delta.

## Plan
1. Port regression tests to the clean stream task and show red, then port scoped changes; verify current stream integration.
2. Run focused tests and typecheck without concurrent extra verification. Inspect error details, respect disk safety.
3. Run managed review/verify and resolve attributable issues.
4. Task push, task.pr into stream; verify PR and stream SHA, close superseded PR #2748. Do not merge main/deploy.

- 2026-10-31 07:24:42 append: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 07:24:42 fs.write: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`
- 2026-10-31 07:25:49 fs.write: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`
- 2026-10-31 07:27:11 fs.write: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`
- 2026-10-31 07:28:56 fs.write: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`

## Recovery execution evidence — October 31

- OS readiness: `get_steering` returned local online/ready and `lifecycle.status` confirmed installed canary 0.1.146. No node changes.
- Disk: initial `df -h` reported 16 GiB available / 93% data-volume usage, rising naturally to ~30 GiB available / 86% without removing files. No deletion/cleanup performed.
- Original task PR #2748 cannot be safely merged to stream/os: original head based on main, stream divergence 36 vs 37 commits; no stream-side edits in five targeted files since common base. Old task unchanged.
- This task starts directly from `stream/os`. Ported regression test files first with exact baseline comparison; RED confirmed 5 expected failed assertions, 21 passes and missing explore helper.
- Ported only five code/test paths, including currently released main-side trace formatter improvements omitted by stream (to prevent regression of code.call file/multi-command summaries). No unrelated source or stream changes were merged.
- GREEN on clean stream worktree: 57/57 tests in `trace-site-inspector-os-owned`, `explore-output-contract`, `trace-sites-browser-client`, `trace-sites-gateway-live-endpoints`. `bunx nx run consuelo-os:typecheck`: passed. `git diff --check`: passed.
- A separate agent's OS verification was still running, so allow resource contention to clear before final managed verify; prior original-task full gate failed only in unrelated trace persistence suite despite clean static review.
- No main merge, deployment, install, routing changes, credential handling, or other-agent file deletion.

## Files changed on clean stream task
- packages/os/scripts/explore.js
- packages/os/scripts/lib/search/explore-failure.js (new)
- packages/os/scripts/lib/trace-site-inspector/table-formatters.ts
- packages/os/tests/explore-output-contract.test.ts
- packages/os/tests/trace-site-inspector-os-owned.test.ts

- 2026-10-31 07:25:49 append: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`

## Former verification blocker resolved by independent reproduction

- The unrelated `trace-persistence.test.ts` suite that failed on original main-based task was rerun alone on the clean stream task with other verifiers active; **12/12 passed** (one test file). Disk free ~29 GiB. No trace-persistence source change needed and no test suppression/waiver.
- Proceed to managed full gate on the exact stream-based working tree with focused 57/57 + typecheck + `git diff --check` already green.

- 2026-10-31 07:27:11 append: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:28:44 `verify`: passed — OK

## Full managed verification passed — exact clean stream branch

- `verify` completed successfully, with `stamp.publishValid=true`.
- Six selected critical suites completed with **0 failures**.
- Static review completed: 0 own issues, 0 related pre-existing issues, 0 blocking issues, 0 failed suites.
- Prior focused suites: 57/57 passed; trace-persistence independent probe: 12/12; OS typecheck: green; `git diff --check`: green.
- Only the five target files plus task metadata/workpad changed; all user data and other agent worktrees preserved.
- Publication boundary: task.push then task.pr merges **to stream/os only**; **not** main/deploy/install.

- 2026-10-31 07:28:56 append: `.task/os/dev-1665-stream-align-trace-labels-and-explore-diagnostics/workpad.md`
