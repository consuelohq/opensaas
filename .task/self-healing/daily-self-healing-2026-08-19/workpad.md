# Daily self-healing 2026-08-19

branch: `task/self-healing/daily-self-healing-2026-08-19`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2165/daily-self-healing-2026-08-19
github pr: https://github.com/consuelohq/opensaas/pull/2165
started: 2026-08-20

## acceptance criteria

- [x] Reconstruct current main / stream/self-healing / stream/os state and classify recent monitor candidates without duplicating accepted fixes.
- [x] Fix only a bounded, high-confidence self-healing defect with regression coverage.
- [ ] Validate focused behavior, review, and publish gate; promote the daily task into stream/self-healing only if gates permit.
- [ ] Publish the normalized self-healing report + generated workpad to Daily Schedules.

## plan

1. Use source fallback for `monitor.errors` because the installed facade currently reports `Script not found`, then inspect the highest-confidence recurring candidates against main, stream/self-healing, and stream/os.
2. Characterize `stream.sync` conflict cleanup: a substantive merge conflict currently leaves the stream worktree dirty, so every later retry fails before it can reset to the remote stream head.
3. Add a focused regression test around failed-merge cleanup, confirm red, then make the smallest change that restores the transient worktree state without altering accepted stream history.
4. Re-run focused tests, inspect the diff, run strict review + verify, update this workpad, push, and promote task -> stream/self-healing if mergeable.
5. Publish Daily Schedules via the current artifact capability; never merge stream/self-healing -> main.

## current status

- Source `monitor-errors.ts` fallback ran against the canonical trace DB: 22 groups, 5 actionable defect candidates. GitHub facade failures are already fixed on stream/self-healing but not installed/main; dailySchedules/artifact failures are installed/source drift; verify/task.push failures are precondition/validation evidence. `stream.sync` is the strongest new source defect: four recurring failures and a persistent dirty conflict worktree.
- TDD reproduced the cleanup bug before implementation (`trc_3de4cc174aa5`) and passed after the bounded fix (`trc_81208b4b3587`). Broader focused coverage across stream sync + task-push git behavior passes 18/18 (`trc_509909c22bc1`).
- Removed only the stale generated sync worktree `stream-self-healing-sync-38ZOUW`, then reran typed `stream.sync`: it cleanly incorporated current main, passed its selected safety suites, and pushed `stream/self-healing` to `82da23523a57e3ab0d9d4aae67dd7eb19f51362a` (`trc_18ad897b12ea`).
- Reconciled the daily task with the newly synchronized stream using task-worktree-scoped `git merge origin/stream/self-healing` because the current typed surface exposes stream sync and PR merge but no operation to merge the current stream into an already-started task branch (`trc_2281cb3a4d50`).
- First full verify exposed a second related tooling defect: the mirrored stream-sync boundary had no focused test-selection ownership, so `packages/os/scripts/stream-sync.js` fell through to the unrelated historically-red `@consuelo/os` package suite. Added the `workspace-stream-sync` exclusive rule and regenerated the derived test registry. The rule was RED before implementation (`trc_6944ac36deea`) and GREEN after regeneration (`trc_58b6197f66d8`).
- Final focused suites pass: stream-sync/task-push coverage 18/18 and the complete test-selection contract 46/46 (`trc_a25d2e48562a`). Strict review reports 0 blocking issues (`trc_8ba990a1280a`); full verify is publish-valid with DB guard 0 risks / 0 findings (`trc_d5c64d2cfc83`).
- Final normalized report persisted at `.task/self-healing/daily-self-healing-2026-08-19/monitor-errors-report.json`: 22 groups (6 caller-input, 6 defect-candidate, 8 transient, 2 unknown). The extra candidate count includes validation/publish activity generated during this run and is preserved rather than suppressed.
- Source identity at final validation: task pre-publish HEAD `5a6317c4cf7ef23f58bea8349908ff1a1d27554c`; synchronized `stream/self-healing` `82da23523a57e3ab0d9d4aae67dd7eb19f51362a`; main `f73573184111b24f75fc60b4ce4445fea4afb80e`; authoritative `stream/os` `42b152196fd8afabb76169a5d5fb31873f4408eb`.

## files changed

- `packages/os/scripts/stream-sync.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/os/scripts/lib/stream-sync-cleanup.js`
- `packages/workspace/scripts/lib/stream-sync-cleanup.js`
- `packages/workspace/tests/stream-sync-conflict-cleanup.test.ts`


## workspace-owned: files changed

- `packages/os/scripts/lib/stream-sync-cleanup.js`
- `packages/workspace/scripts/lib/stream-sync-cleanup.js`
- `packages/workspace/tests/stream-sync-conflict-cleanup.test.ts`

## workspace-owned: activity log

- 2026-08-20 01:42:23 fs.write: `packages/workspace/tests/stream-sync-conflict-cleanup.test.ts`
- 2026-08-20 01:51:08 fs.write: `packages/workspace/scripts/lib/stream-sync-cleanup.js`
- 2026-08-20 01:51:11 fs.write: `packages/os/scripts/lib/stream-sync-cleanup.js`

## workspace-owned: validation evidence

- 2026-08-20 01:47:42 `review.run`: passed — OK
- 2026-08-20 01:48:21 `verify`: failed — COMMAND_FAILED
- 2026-08-20 01:51:53 `review.run`: passed — OK
- 2026-08-20 01:52:08 `verify`: passed — OK

## key decisions

- Treat the GitHub `COMMAND_FAILED` recurrence as already-fixed/source-runtime drift because `stream/self-healing` contains `fix(self-healing): repair GitHub CLI runtime resolution` and current installed GitHub tooling still runs from a source that lacks that accepted stream change.
- Fix `stream.sync` cleanup rather than weakening conflict handling. Substantive conflicts must still stop promotion; the fix only restores the transient worktree to `origin/<stream>` (or removes a temporary worktree) after reporting the conflict so later retries are not poisoned.
- Hard reset in the existing-worktree cleanup path is safe here because `stream.sync` requires `ensureWorktreeClean` immediately before starting its merge. The reset therefore removes only merge-produced transient state and does not discard pre-existing accepted stream work.
- `stream/os` was inspected as authoritative current OS development and does not already contain this cleanup correction. No duplicate implementation was found there or on current main.
- Hosted normalized install/onboarding telemetry is not exposed by the current read-only OS tool surface; continue with local dogfood traces and repository/runtime evidence and record the telemetry gap rather than inventing affected-user counts.

## notes for ko

- Selected two related fixes: failed stream-sync conflict cleanup and focused verification ownership for that same boundary. No unrelated trace was patched merely because it failed.
- Installed `monitor.errors` and `github` behavior still demonstrates source/runtime drift; accepted source fixes already exist for the GitHub failure, so no duplicate change was created.
- Perpetual PR #1941 remains the human-only `stream/self-healing` -> `main` boundary. This run will stop after daily task promotion and artifact publication.

## improvements noticed

- The current typed task surface still lacks a direct operation to merge a newly advanced target stream into an already-started task branch; today required a scoped raw Git fallback after `stream.sync` advanced the stream.

## issues and recovery

- Installed `monitor.errors` fails with `Script not found "monitor:errors"`; recovered by running the current source script read-only inside the task worktree against the canonical trace DB.
- The persistent stream sync worktree is already dirty from an earlier failed merge. This is evidence for the cleanup defect; do not discard stream history. The regression will target transient merge state only.
- The installed `github` facade still resolves through the stale `gh` wrapper and fails parsing. Current source GitHub tooling on the task branch successfully verified the perpetual review PR #1941 remains OPEN from `stream/self-healing` to `main`; this is already-covered runtime/source drift, not a second source fix for today.
- No typed current-task branch synchronization operation was discoverable after `stream.sync` advanced the stream. Used a scoped raw Git merge inside the generated task worktree, consistent with Senior Engineer fallback guidance, and recorded it here.
- `task.push` then correctly refused because the remote task branch still pointed at the pre-sync task base while the local task branch contained the accepted stream-sync merge. No typed task-branch ref synchronization operation exists, so a scoped fast-forward `git push origin HEAD:task/self-healing/daily-self-healing-2026-08-19` advanced only the daily task ref to the already-validated local merge commit before retrying normal `task.push` (`trc_f89cc2f001f7`).
- The first full verify selected the unrelated package-wide OS suite and failed on pre-existing facade/media dry-run assertions. It also updated a facade snapshot as a test side effect; that snapshot was immediately restored because it is unrelated to this task. The focused test-selection correction prevents this stream-sync boundary from depending on that unrelated baseline.

## Test-first contract

behavior under test: when `stream.sync` encounters a substantive merge conflict, it reports the conflict but cleans the transient merge state so a later retry starts from a clean `origin/<stream>` worktree; temporary sync worktrees are removed.
existing local pattern: `packages/workspace/tests/stream-sync-node-modules.test.js` protects stream-sync lifecycle ordering; `packages/workspace/scripts/lib/git.js` owns reusable worktree/git operations.
new or changed tests: add focused coverage for cleanup of an existing conflicted worktree and for removal of a temporary worktree.
focused red command: `bun test packages/workspace/tests/stream-sync-conflict-cleanup.test.ts`
expected red failure: cleanup helper/contract does not exist and a conflicted worktree remains dirty after a failed sync.
no-test waiver: not applicable.

### Verification-selection contract discovered during publish validation

behavior under test: changes to the mirrored `stream-sync.js` boundary select the focused stream-sync/git regression suite and do not fall through to the unrelated package-wide OS suite.
existing local pattern: focused exclusive rules such as `os-self-healing-monitor` and `os-deployment-provider-adapters` in `packages/workspace/test-selection.rules.json`.
new or changed tests: add a `test-selection.test.js` case with the actual stream-sync/git changed-file set and assert the focused rule is selected while `auto:@consuelo/os:package-test` is not.
focused red command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "uses focused stream-sync contracts"`
expected red failure: no stream-sync-specific rule exists, so the broad OS package suite remains selected.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/monitor-errors.ts`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/stream-sync-node-modules.test.js`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-20 01:52:42 apply-patch: `.task/self-healing/daily-self-healing-2026-08-19/workpad.md`

- 2026-08-20 01:53:16 apply-patch: `.task/self-healing/daily-self-healing-2026-08-19/workpad.md`