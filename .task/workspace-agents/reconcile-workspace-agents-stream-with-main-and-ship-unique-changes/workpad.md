# reconcile workspace agents stream with main and ship unique changes

branch: `task/workspace-agents/reconcile-workspace-agents-stream-with-main-and-ship-unique-changes`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2186/reconcile-workspace-agents-stream-with-main-and-ship-unique-changes
github pr: https://github.com/consuelohq/opensaas/pull/2186
started: 2026-08-26

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

- none yet

## workspace-owned: validation evidence

- 2026-08-26 02:30:52 `review.run`: passed — OK
- 2026-08-26 02:33:16 `review.run`: passed — OK
- 2026-08-26 02:36:33 `verify`: failed — COMMAND_FAILED
- 2026-08-26 02:40:57 `review.run`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

behavior under test: reconciling `stream/workspace-agents` onto current `main` preserves the stream-only product behavior we still want (Diffs/source-control + GitHub App onboarding + compact explore contract) while preserving newer `main` implementations where stream code has been superseded, especially subagent/session/runtime reliability.
existing local pattern: resolve stream-to-main drift through a task started from the stream, merge current `origin/main` into the task, resolve real code conflicts semantically rather than choosing ours/theirs wholesale, then run focused feature tests plus canonical review/verify before promoting the task back into the stream and merging the stream review PR to main.
new or changed tests: reuse existing Diffs/source-control/GitHub App/explore/subagent/session tests; only change/add tests if merge resolution exposes an uncovered compatibility regression.
focused red command: before resolving conflicts, perform a no-commit merge of `origin/main` into this task and treat the resulting compile/test/conflict state as the integration RED signal; then run the smallest focused test groups after each semantic resolution cluster.
expected red failure: many changed-in-both files and some added-in-both conflicts due the Aug 12-25 divergence; current main is expected to contain newer subagent/session/runtime code while missing the GitHub App and compact explore additions.
no-test waiver: not applicable.

## acceptance criteria (integration)

- [ ] Inventory what is genuinely unique to `stream/workspace-agents` versus what current `main` already contains or supersedes, and record why each retained feature should ship.
- [ ] Reconcile current `origin/main` into the stream task without regressing newer main behavior; resolve code/tests/generated/config conflicts semantically.
- [ ] Preserve and ship the unique Diffs/source-control productization and hardening that is still absent from main.
- [ ] Preserve and ship the GitHub App source-control onboarding path: direct Connect GitHub UX, Device Authority App credential boundary, one-time browser handoff, repository hydration, and short-lived installation tokens.
- [ ] Preserve and ship the compact explore response contract if still absent from main.
- [ ] Do not reintroduce stale Aug-12 subagent/runtime implementations where main has newer hardening; keep main's newer session/subagent lifecycle behavior unless a stream-only invariant is demonstrably missing.
- [ ] Focused tests, strict review, canonical verify, and a realistic browser/runtime smoke for Diffs/GitHub onboarding pass on the reconciled branch.
- [ ] Promote task -> `stream/workspace-agents`, merge stream review PR #2055 to `main`, and verify the merge SHA.
- [ ] Configure the approved production GitHub App integration with least-privilege repository permissions and wire the required Device Authority secrets/config without exposing credentials.
- [ ] Release the resulting OS version to Canary and update this local Consuelo OS install to Canary using the canonical lifecycle updater; verify health and the installed version.

## plan (integration)

1. Audit stream-only commits/features against current main and classify each as retain, superseded, or metadata-only.
2. Merge current `origin/main` into this stream-based task with `--no-commit`, capture the exact conflict set, and resolve by subsystem.
3. Keep current-main implementations for superseded session/subagent/runtime conflicts; integrate stream-only Diffs/GitHub/explore behavior into the current-main versions.
4. Regenerate only canonical generated surfaces required by the resolved source changes.
5. Run focused tests by feature cluster, then browser/runtime smoke, strict review, and full verify.
6. Push/promote the task into the stream, resolve any final PR state, then merge stream PR #2055 to main.
7. Configure the GitHub App externally and Device Authority runtime secrets/config; validate the installation/Connect GitHub flow.
8. Release main to Canary, update this local OS to Canary, and verify lifecycle/runtime health.

## current status (integration)

- Discovery shows the stream contains three important product clusters plus an old subagent reliability branch: Diffs/source-control productization + review hardening; GitHub App onboarding; compact explore responses; and a large Aug-12 durable subagent lifecycle series.
- Current main already has Diffs baseline files and substantially newer subagent/session hardening, but it does not contain the GitHub App route/client files or compact explore output module. Therefore a blind stream merge risks regressing newer main code; this task will reconcile semantically.
- `session.start({kind:"task"})` is advertised but the installed OS lacks the backing `session:start` script (`trc_29112ed415a4`); the documented `task.start` compatibility path created PR #2186 / taskSession `tsk_06d6ca957d43` successfully.
- Task-scoped `fs.read` and `fs.write` currently cannot resolve this valid task branch (`trc_38db731ac0d1`, `trc_4180cabe9954`), so the known-worktree `code.call` fallback is being used narrowly and recorded as a tooling gap.

## key decisions (integration)

- Do not merge the old stream snapshot wholesale into main. Reconcile main into the stream task and preserve main for superseded subsystems; preserve stream only where the feature is genuinely unique or current-main-compatible.
- Treat GitHub App onboarding and compact explore as clearly unique retain candidates because their defining files are absent from current main.
- Treat the old subagent lifecycle series as suspect/superseded because current main has later session/subagent hardening commits; retain only any invariant that targeted tests prove is missing.

## issues and recovery (integration)

- `session.start` failed with `Script not found "session:start"`; recovered with `task.start` compatibility alias.
- `fs.read`/`fs.write` failed to resolve the active task branch; narrowed fallback to the exact task worktree via task-scoped `code.call`.


## Integration conflict resolution evidence

- Integration RED: merging `origin/main` (`1f3062c63239bd378eeb3b7d4b9f09efb32a178c`) into the stream-based task produced 16 real conflicts (`trc_777c0216edfe`).
- Kept current-main implementations wholesale where the stream copy was demonstrably older/superseded: subagent runtime/orchestration, trace persistence, install-state/Sites CLI, edge publisher expectations, and the generated test-selection registry baseline (`trc_45e7f65b844d`). These preserve newer task/work-session, timeout, Nodes, and runtime reliability behavior already on main.
- Reconciled source-control production files as current-main + the stream-only GitHub App deltas: installation-to-workspace materialization, signed connect/complete routes, managed installation token brokerage, and the direct Connect GitHub setup page. Preserved main's vendored Diff Cockpit runtime import instead of the stale stream source import (`trc_15f8c49dc0a9`).
- Reconciled Configuration UI semantically: current main's newer Overview heatmap, Tools inventory, Nodes/navigation/chrome remain intact; only the manual source-control binding form was replaced by the stream's GitHub App connect/manage UI and one-time handoff completion flow (`trc_e7b323daca35`).
- Reconciled tests semantically: current-main coverage remains, plus GitHub source-control route/UI/edge/test-selection contracts (`trc_743d57503413`). The registry was regenerated from the merged rule set rather than hand-merged (`trc_6ccf187e1a42`).
- The initial current-main test-selection port expected the GitHub rule to be the only focused suite. Current main now has other valid overlapping explicit critical rules for Device Authority/internal shell/cloud contracts. RED proved five focused suites and no broad OS package suite (`trc_77163f8a557b`); the assertion was corrected to the actual safety invariant: GitHub suite selected and `@consuelo/os package test` not selected. GREEN `trc_92b7507ebbd8`; full test-selection file 45/45 GREEN `trc_6924245504a4`.

## Focused validation so far

- GitHub App/source-control suite: 7 files / 80 tests pass on the reconciled main integration (`trc_754833bc78cd`).
- Workspace Edge/source-control routing: exact Bun-hosted Vitest runner passes 3 files / 32 tests (`trc_70f01aa25e71`). The first package-script attempt failed only because Node-hosted Vitest cannot import `bun:sqlite`; rerunning with the repository's Bun-hosted Vitest command is green (`trc_0e565b2e634c` -> `trc_70f01aa25e71`).
- Compact explore response contract: 5/5 pass under the package's canonical Vitest script (`trc_b98df70f4d7f`). A direct Bun-hosted Vitest attempt exposed unrelated zod ESM interop and was not the package's canonical runner (`trc_8392f7f6b9c2`).
- Preserved current-main regression cluster: subagent orchestration, trace persistence, install state, and Sites CLI all pass: 4 files / 63 tests (`trc_c46bb9451d5e`).
- Reconciled diff against current main is now intentionally narrow: 32 non-task files, 2,192 insertions / 132 deletions, concentrated in GitHub App onboarding, Diffs managed credentials/UX, compact explore output, their tests, generated facade surfaces, edge route wiring, and test-selection rules (`trc_387ff39edc1d`).

- Post-merge strict review now sees the intended narrow surface (25 source/test files, excluding generated/docs metadata) and is clean: 0 task-owned issues, 0 pre-existing issues, 0 blocking issues. One non-blocking docs opportunity notes discoverable tool-contract metadata changed (`trc_8b3a0e05284b`).
- Current `origin/main` remains exactly the validated second parent `1f3062c63239bd378eeb3b7d4b9f09efb32a178c`; the remote task branch is still at pre-reconciliation `36740d89ac39fd6edf4b028d429fdeb0be1ac102`, so no concurrent remote task mutation has occurred (`trc_20cfe7dab1cd`).

- Canonical verify reached the selected test gate and failed only because the compact explore files were the remaining source files not owned by an explicit critical rule, so test-selection fell through to the unrelated broad `@consuelo/os package test`; that broad suite hit existing facade dry-run failures (`trc_6c341ea81d68`). Selection evidence isolated the uncovered files to `scripts/explore.js`, `lib/search/explore-output.js`, `tools/decision-engine/handler.ts`, and the compact explore test (`trc_9da5a931d9c1`).
- Added a focused critical `os-compact-explore-response` selection rule plus regression test, regenerated the registry (`trc_7a77ad381c34`), and proved the new regression GREEN (`trc_aba7c09d9f1a`). The whole task selection now chooses only focused suites and explicitly excludes the broad OS package suite (`trc_a56c5d1d765e`).

## Final validation and publish recovery

- Final strict review after the compact-explore selection fix remains clean: 0 task-owned/pre-existing/blocking issues (`trc_09a7cb6405f7`).
- Canonical full verify is now GREEN and publish-valid on HEAD `9454c91dd833408723b4a2f387e44385b9e6fa2a`: review passed, focused selected tests passed, DB guard passed with only the expected route-seed warning and 0 findings (`trc_4a3bbf53bba8`).
- Browser proof on the reconciled code preserves current-main Overview/heatmap/chrome while showing managed source control: Configuration renders `Manage GitHub access`, `consuelohq/opensaas`, `main`, and GitHub state (`trc_52b60e169212`); Diffs renders the direct `Connect GitHub` CTA (`trc_5e2422727df0`); clicking it reaches the GitHub connect route and returns to Configuration (`trc_35ef54cf6f5e`). Browser and preview process were closed/terminated (`trc_656a3a553410`, `trc_e4d759980575`).
- Publish topology requires preserving the validated merge commit with `origin/main` as its second parent. The native `task.push` is a GitHub file-API publisher that creates a single-parent commit from changed files; using it for the main reconciliation would flatten roughly 1,600 merged-main files and discard the conflict-resolution ancestry. `stream.sync` cannot semantically resolve the 16 non-metadata conflicts. Therefore the bounded recovery is: fast-forward the existing task branch with the already-validated local merge commits using `git push`, then immediately return to the native lifecycle (`task.push` only for scoped task metadata/verify evidence, `task.pr`, `task.finish`). The remote task branch has not moved since task creation, so this is a fast-forward, not a rewrite.
