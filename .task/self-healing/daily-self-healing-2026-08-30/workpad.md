# daily self healing 2026 08 30

branch: `task/self-healing/daily-self-healing-2026-08-30`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2323/daily-self-healing-2026-08-30
github pr: https://github.com/consuelohq/opensaas/pull/2323
started: 2026-08-31

## acceptance criteria

- [x] Reconstruct the last-24h OS failure picture from the canonical monitor implementation, without treating every non-OK trace as a bug.
- [x] Check current `main`, `stream/self-healing`, the open Aug 28 daily task, PR #1941, recent merged OS work, and current `stream/os` before selecting any source fix.
- [x] Keep `stream/self-healing` aligned with accepted `main` history without discarding accepted stream history; resolve only conflicts that can be justified from current source and tests.
- [x] Fix at most four coherent, evidence-backed OS/tooling defects, or record a truthful no-source-change decision.
- [x] Run focused regression proof plus review/verify when source changes are justified.
- [ ] Push the daily task, promote it only into `stream/self-healing`, preserve PR #1941 as the human-only main boundary, and publish the Daily Schedules report/workpad.

## plan

1. Recover the deterministic monitor report from current source because installed `monitor.errors` is missing its script.
2. Classify the strongest groups against current contracts, current `stream/os`, recent PRs, and runtime/source identity; consult normalized hosted telemetry if an exposed read model exists.
3. Select the smallest coherent fix set only if current source still contains a real defect. Write the focused regression first and prove RED before production edits.
4. Reconcile accepted-main drift on the daily task/integration path when safely supported; do not reset the poisoned generated stream-sync worktree.
5. Run focused GREEN, diff inspection, strict review, and full verify against `origin/stream/self-healing` as appropriate.
6. Update this workpad, push, promote task -> `stream/self-healing`, publish Daily Schedules, and verify the perpetual review PR remains open.

## current status

- Maintenance date: 2026-08-30 (America/New_York). Task started from remote `stream/self-healing` head `63d0ed9e0269d5b756ff0a5c02943205d0bcded2` as PR #2323.
- Installed OS reports version 0.1.93. The typed `monitor.errors` call failed with `Script not found "monitor:errors"` (`trc_0ebaad2980e5`), so current-source execution is required for deterministic evidence.
- Initial `stream.context` hit the known concurrent-fetch CAS failure once, then succeeded on the bounded retry. Current `stream/os` contains materially newer Aug 30 OS work, especially subagent/runtime fixes, so it is being treated as authoritative duplicate-check evidence.
- PR #1941 (`stream/self-healing` -> `main`) is OPEN/CLEAN with all 51 checks complete and green. The stale Aug 28 daily PR #2267 is separately OPEN/CLEAN with all 43 checks green; it will not be silently folded into today's task.
- Installed `stream.sync` is stale in two ways: the typed facade passes unsupported `--repo`, and the legacy retry found a poisoned generated sync worktree with a substantive `packages/workspace/test-selection.registry.json` conflict. No reset/discard was performed.
- Current-source `stream.sync` exposed the remaining root cause: a dirty *pre-existing generated* `stream-*-sync-*` worktree reached `ensureWorktreeClean` before any ownership-aware recovery. The fix now removes only worktrees provably owned by the generated sync root/name contract and leaves manual stream worktrees protected by the clean-worktree guard. A live retry removed the poisoned generated worktree, created a fresh temporary one, reported `Already up to date`, ran its checks successfully, and pushed without changing remote history.
- Fresh remote-ref proof after that recovery: `origin/main` = `f07a09062fb54d01ab8f406a8852f7fefd9e10a7`; `origin/stream/self-healing` = `63d0ed9e0269d5b756ff0a5c02943205d0bcded2`; `origin/main...origin/stream/self-healing` = `0 49`. The persistent stream therefore contains all accepted current-main history and is 49 commits ahead before today's task promotion.
- Final deterministic report written to `.task/self-healing/daily-self-healing-2026-08-30/monitor-errors-report.json`: 31 groups — 3 expected-policy, 9 caller-input, 0 runtime/contract drift, 6 defect-candidate, 10 transient, 0 external, 3 unknown; 6 actionable. Before the classifier correction it was 30 groups with 7 caller-input and 7 actionable. The extra group is intentional splitting of deterministic caller state from a still-actionable shared `(tool, code)` family.
- Remaining historical actionable groups were not blindly patched: `verify` lacks normalized failure detail sufficient for a safe global rule; `explore` timeout evidence is concentrated in one prior session while current `stream/os` contains newer runtime/subagent work; `monitor.errors` is installed 0.1.93 script drift already fixed in source; `review.run` is three 180s timeouts in one task/session without a proven current-source defect; and the remaining `task.push` group is specifically `remote branch not found`, retained as actionable because its provenance is not yet strong enough to call caller error. The historical `stream.sync` group includes the recovery defect fixed today and stale installed facade failures.
- Read-only Sentry inspection found zero unresolved issues in the last 24 hours. No normalized hosted install/onboarding/control-plane impact read model was exposed through the current typed surface, so no hosted-user impact was inferred.
- Strict review against `origin/stream/self-healing` passed with 0 blocking issues. Full verify passed and is publish-valid; DB guard reported 0 risks / 0 findings. Focused monitor contracts passed 22/22; focused stream-sync/task-push/fetch contracts passed 38/38.

## files changed

- `packages/os/scripts/lib/monitor-errors.ts` — attribute deterministic malformed-patch and invalid task.push invocation contracts to caller input while preserving negative controls.
- `packages/os/tests/monitor-errors.test.ts` and `packages/os/tests/monitor-errors-report.test.ts` — classifier and pre-aggregation regressions.
- `packages/{os,workspace}/scripts/lib/stream-sync-cleanup.js` — ownership-aware stale generated sync-worktree cleanup, canonicalized through `realpathSync` for macOS `/var` aliases.
- `packages/{os,workspace}/scripts/stream-sync.js` — recover an owned stale generated sync worktree before the clean-worktree guard; manual worktrees remain fail-closed.
- `packages/workspace/tests/stream-sync-conflict-cleanup.test.ts` — mirrored generated-vs-manual ownership contract and filesystem-alias regression.
- Generated task metadata/workpad plus `monitor-errors-report.json` for the durable maintenance record.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-31 02:06:55 `review.run`: passed — OK
- 2026-08-31 02:07:11 `verify`: passed — OK
- 2026-08-31 02:08:01 `verify`: passed — OK

## key decisions

- Treat installed facade/runtime drift as evidence, not as a reason to duplicate fixes that already exist in current source.
- Preserve the generated stream-sync conflict state until a supported current task/integration path proves a deliberate reconciliation. The dirty worktree is not authority over remote stream history.
- After TDD established ownership semantics, the current-source stream-sync implementation was the supported recovery path: it removed only the stale tool-owned generated worktree. The old conflict state was not reset or hand-resolved, and no human/manual stream worktree was touched.
- Keep `task.push remote branch not found` actionable. Unlike missing `--changed`/`--files` selection and conventional-commit rejection, current evidence does not prove the remote-branch condition is caller-caused.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- `monitor.errors` failed because installed OS 0.1.93 lacks the `monitor:errors` script. Recovery: execute the current source implementation inside this task worktree; do not run an OS update/restart.
- First `stream.context` for self-healing failed on `git fetch` with `incorrect old value provided`; one retry succeeded, consistent with the bounded concurrent-fetch race contract.
- Installed `stream.sync` rejected `--repo`; retry without the stale argument reached a generated sync worktree that is already dirty and contains a real merge conflict. Recovery will stay on the supported task/integration path rather than cleaning that worktree destructively.
- First ownership implementation used lexical `path.resolve`; live macOS evidence and a symlink regression showed `/var/...` vs `/private/var/...` can refer to the same generated root. The test was made RED for that alias and the implementation changed to `fs.realpathSync`; both mirrors then passed and the live recovery succeeded.

## Test-first contract

behavior under test: deterministic caller mistakes must not become defect candidates merely because they recur. In particular, malformed `fs.apply_patch` envelopes (`invalid patch: missing *** Begin Patch`) and invalid `task.push` invocation shape (missing changed/files selection or a non-conventional commit message) are caller-input. A recurring `task.push` `remote branch not found` remains actionable because the current evidence is insufficient to prove that state is caller-caused.
existing local pattern: `packages/os/tests/monitor-errors.test.ts` already protects deterministic caller/policy attribution and always includes negative controls so real wrapper failures stay actionable.
new or changed tests: extend the filesystem caller-error contract for malformed patch envelopes; add a `task.push` caller-input contract for deterministic invocation validation plus a negative control for missing remote branches.
focused red command: `bun --cwd packages/os vitest run tests/monitor-errors.test.ts` (executed through task-scoped `code.call`).
expected red failure: the two new deterministic caller-input families currently classify as `defect-candidate`; the missing-remote-branch negative control stays `defect-candidate`.
no-test waiver: not applicable; this is a classifier contract change with focused regression coverage.

second behavior under test: `stream.sync` must recover from a stale worktree that is provably owned by the stream-sync temporary-worktree naming/root contract, while never deleting a normal/manual stream worktree. This addresses the live poisoned `stream-self-healing-sync-*` worktree without weakening the clean-worktree guard for human-owned stream worktrees.
second existing local pattern: mirrored `packages/{workspace,os}/scripts/lib/stream-sync-cleanup.js` already owns failed-merge cleanup, and `packages/workspace/tests/stream-sync-conflict-cleanup.test.ts` exercises both mirrors against real Git worktrees.
second new test: create a dirty generated-path worktree and require cleanup to remove it; then create a dirty manual-path worktree and require cleanup to refuse it.
second focused red command: `bun test packages/workspace/tests/stream-sync-conflict-cleanup.test.ts`.
second expected red failure: both mirrored helpers lack `removeStaleGeneratedSyncWorktree`, so only the two new recovery cases fail while the four existing cleanup cases remain green.

TDD results: monitor RED was 16 pass / 2 fail exactly on the two new caller-attribution expectations; GREEN is 22/22 across classifier + report aggregation. Stream-sync RED was 4 pass / 2 fail because both mirrors lacked the generated-worktree recovery helper; first GREEN reached 6/6, then the real filesystem alias exposed a second bounded RED at 4 pass / 2 fail; `realpathSync` restored GREEN at 6/6. The full focused stream-sync selection is 38/38.

## promotion and publication

- Daily task PR: #2323 (`task/self-healing/daily-self-healing-2026-08-30` -> `stream/self-healing`). Promotion pending final push/gates.
- Perpetual human review boundary: PR #1941 (`stream/self-healing` -> `main`). It remains human-only; this run will not merge it or perform a release/update/deploy.
- Daily Schedules publication pending final task push/promotion. Publish the generated workpad and `.task/self-healing/daily-self-healing-2026-08-30/monitor-errors-report.json`; do not create a parallel workpad.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/test-selection.registry.json`

- 2026-08-31 02:07:46 apply-patch: `.task/self-healing/daily-self-healing-2026-08-30/workpad.md`
