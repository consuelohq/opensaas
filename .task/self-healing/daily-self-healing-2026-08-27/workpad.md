# daily self healing 2026 08 27

branch: `task/self-healing/daily-self-healing-2026-08-27`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2241/daily-self-healing-2026-08-27
github pr: https://github.com/consuelohq/opensaas/pull/2241
started: 2026-08-27 America/New_York

## acceptance criteria

- [ ] Reconstruct the last 24h OS failure picture from the canonical monitor implementation without treating every non-OK trace as a bug.
- [ ] Check current main, `stream/self-healing`, authoritative `stream/os`, recent PRs, installed/runtime identity, and available hosted evidence before selecting a fix.
- [ ] Fix only 1-4 coherent high-confidence OS/tooling defects, or record a truthful no-source-change decision when current source already fixes the evidence or the signal is weak/transient/external.
- [ ] Validate selected changes or no-change source contracts, keep this generated workpad current, push the daily task, and promote it only into `stream/self-healing`.
- [ ] Publish the normalized self-healing report plus this generated workpad into Daily Schedules. Never merge `stream/self-healing` to `main`, deploy, release, or run OS install/update/restart/rollback/uninstall.

## plan

1. Run installed `monitor.errors`, then fall back to the current source implementation if the installed facade is stale.
2. Inspect current stream/main/OS-development context, recent PRs, installed runtime identity, and read-only Sentry evidence; reconstruct contracts for actionable groups.
3. Rank only real source defects. If a source correction is justified, write the focused regression RED before production code, implement the smallest fix, then run GREEN and broader validation.
4. Reconcile task/stream state safely without discarding accepted history; the installed stream-sync worktree is currently dirty with substantive code conflicts, so do not reset it blindly.
5. Push the task metadata/source, promote the daily task into `stream/self-healing` when gates permit, publish Daily Schedules, and leave the perpetual stream-to-main PR for Ko.

## current status

- Installed `monitor.errors` failed with `Script not found "monitor:errors"`; current `stream/self-healing` source contains the script and package entrypoint, so this is runtime/source drift pending current-source report execution.
- Installed OS reports canary `0.1.84`, last successful update 2026-08-27T01:47:26Z.
- `stream/self-healing` has no open prior daily task PR. Perpetual PR #1941 is OPEN with 51/51 completed checks and zero failed checks at inspection time.
- Read-only Sentry inspection found zero unresolved issues in the last 24h.
- `stream.sync` is stale in the installed runtime: the typed `repo` argument is rejected by the CLI, and the retry without `repo` found the generated sync worktree dirty with many accepted-main changes plus substantive conflicts in `packages/os/scripts/github.js` and the workspace test-selection registry/rules. No reset/discard was performed.
- Today’s task was started from the remote `stream/self-healing` head via the compatible `task.start` path because installed canonical `session.start` still rejects the outer `timeout` after it is merged into strict typed input.
- Current-source normalized monitor report at 2026-08-28T01:21:00Z: 32 groups total; 7 expected-policy, 12 caller-input, 4 defect-candidate, 7 transient, 2 unknown, 4 actionable. The remaining actionable groups are `stream.sync` (installed/source drift plus stale generated sync worktree), `monitor.errors` (installed missing script), `verify` (sampled validation-gate failures; insufficient structured normalized detail for a safe classifier rule), and `stream.context` (the real concurrent Git-fetch race fixed in this task).
- The monitor correction moved the observed repeated GitHub workflow-cancel failures to caller-input and split the observed release failures into expected verification policy vs transient lifecycle-busy state; actionable groups fell from 6 to 4 without hiding a trace.
- Remote comparison: current `main` has exactly one commit not in `stream/self-healing`, website changelog PR #2240 touching only `packages/consuelo-website/src/data/json-files/changelogData.json`; `stream/os` has zero commits ahead of main. No current OS implementation was missing from the self-healing source used for this fix.
- Focused TDD proof: RED failed 6/17 as expected; after the bounded implementation, GREEN passed 17/17 across the monitor classifier and both mirrored Git fetch helpers.

## Test-first contract

behavior under test: (1) concurrent read-only stream context calls must recover only from Git's known remote-tracking-ref compare-and-swap race (`incorrect old value provided` / equivalent `cannot lock ref ... expected`) instead of failing the whole context read; all unrelated fetch failures must still propagate. (2) repeated GitHub workflow-cancel precondition failures and release safety/lifecycle-busy gates must remain visible but must not be promoted into source-defect candidates. (3) shared Git helper changes must be owned by focused synchronization verification rather than the unrelated package-wide OS baseline.
existing local pattern: `packages/os/tests/monitor-errors.test.ts` keeps deterministic policy/caller failures non-actionable with negative controls; both OS and workspace stream-context paths share the mirrored `scripts/lib/git.js#fetchOrigin` boundary; `workspace-stream-sync` is already the exclusive focused contract for stream synchronization and shared Git task-push invariants.
new or changed tests: extend `packages/os/tests/monitor-errors.test.ts` with exact observed GitHub/release stderr cases plus unrelated negative controls; add `packages/os/tests/git-fetch-origin-concurrency.test.ts` to exercise both mirrored fetch helpers with an injected Git runner; add a test-selection regression proving both mirrored Git helpers and the new fetch test select `workspace-stream-sync` and exclude the broad OS package suite.
focused red commands: (a) `bunx vitest run packages/os/tests/monitor-errors.test.ts packages/os/tests/git-fetch-origin-concurrency.test.ts`; (b) after the first full verify exposed missing ownership, `bunx vitest run packages/workspace/tests/test-selection.test.js -t "keeps shared Git helper changes on focused synchronization contracts"`.
expected red failures observed: (a) 6/17 failed because monitor cases were still `defect-candidate` and both mirrored `fetchOrigin` helpers ignored the injected runner; (b) the selection test matched only `auto:@consuelo/os:package-test` instead of `workspace-stream-sync`.
no-test waiver: not used; both selected source corrections have deterministic focused regressions.

## files changed

- `packages/os/scripts/lib/git.js` and mirrored `packages/workspace/scripts/lib/git.js`: retry exactly one understood concurrent remote-ref compare-and-swap race; unrelated fetch errors still propagate.
- `packages/os/scripts/lib/monitor-errors.ts`: classify exact GitHub workflow-cancel operation-state rejections, release failed-check policy gates, and release lifecycle-busy state without suppressing them.
- `packages/os/tests/git-fetch-origin-concurrency.test.ts`: mirrored helper regression coverage.
- `packages/os/tests/monitor-errors.test.ts`: observed attribution regressions plus negative controls.
- generated task metadata/workpad.

## workspace-owned: files changed

- `packages/os/tests/git-fetch-origin-concurrency.test.ts`

## workspace-owned: activity log

- 2026-08-28 01:17:34 fs.write: `.task/self-healing/daily-self-healing-2026-08-27/workpad.md`
- 2026-08-28 01:20:26 fs.write: `packages/os/tests/git-fetch-origin-concurrency.test.ts`

## workspace-owned: validation evidence

- 2026-08-28 01:22:07 `review.run`: passed — OK
- 2026-08-28 01:22:51 `verify`: failed — COMMAND_FAILED
- 2026-08-28 01:27:11 `review.run`: passed — OK
- 2026-08-28 01:27:31 `verify`: passed — OK
- 2026-08-28 01:29:05 `verify`: passed — OK

## key decisions

- Treat installed `monitor.errors`, `session.start`, and `stream.sync` behavior as runtime/source drift unless current authoritative source disproves that classification.
- Do not repair the dirty generated stream-sync worktree by resetting or choosing conflict sides; it contains substantive accepted-main/OS work and must not be discarded to make synchronization look green.
- Select one coherent reliability set: repair the shared Git fetch race behind recurring `stream.context` failures, and correct monitor attribution for repeated GitHub/release failures that are healthy operation-state/safety enforcement. Do not patch `verify`: the sampled failures are validation gates doing their job, but the current normalized trace row does not retain enough structured verify result detail to distinguish a gate failure from a verify-runner defect safely.
- The first full verify exposed a fourth coherent tooling defect: the changed shared Git helper had no focused verification owner and therefore selected the unrelated historically-red whole OS package suite. Extended the existing exclusive `workspace-stream-sync` contract to own both mirrored Git helpers, their task-push invariants, and the new concurrent-fetch regression; regenerated the registry instead of hand-editing it.

## notes for ko

- No deployment/release/update/restart action is part of this task. Installed runtime 0.1.84 still has individual facade/script drift for `monitor.errors`, canonical `session.start`, and `stream.sync` even though current source contains those fixes.

## improvements noticed

- The installed runtime can expose a newer version while individual generated/facade scripts remain stale relative to source; maintenance should classify the exact contract rather than infer freshness from version alone.

## issues and recovery

- `monitor.errors`: installed facade failed because its runtime package lacks the source script entrypoint; source fallback is being used as explicitly allowed by the maintenance workflow.
- `stream.sync --repo`: installed wrapper rejects its own typed `repo` flag. Retried without `repo`; the existing sync worktree is dirty/conflicted. No accepted state was destroyed.
- canonical `session.start({kind:"task"})`: installed strict schema rejected top-level `timeout` after facade merging. Recovered with the supported `task.start` compatibility alias and created PR #2241.
- First full verify after the source fixes was not publish-valid solely because `packages/os/scripts/lib/git.js` fell through to `auto:@consuelo/os:package-test`; the focused monitor suite passed and DB guard was clean, while the unrelated broad suite failed on pre-existing package tests. Captured a selection RED, fixed the ownership contract, regenerated the registry, and reran verification.
- Final pre-push validation: test-selection 56/56 passed; monitor/fetch focused tests 17/17 passed; strict review found 0 blocking issues; full verify passed and wrote a publish-valid stamp, selecting 6 focused suites (`workspace-test-selection`, server selector/GitHub workflow/TypeORM compatibility, `os-self-healing-monitor`, and `workspace-stream-sync`); DB guard reported 0 risks / 0 findings.

---

## publish checklist

```bash
bun run task:push -- --message "chore(self-healing): daily maintenance 2026-08-27" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-28 01:17:34 write: `.task/self-healing/daily-self-healing-2026-08-27/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/daily-schedules.ts`
- `packages/os/scripts/lib/daily-schedules-publisher.ts`
- `packages/os/scripts/lib/git.js`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/stream-context.js`
- `packages/os/tests/git-fetch-origin-concurrency.test.ts`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tools/daily-schedules/handler.ts`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/stream-context.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
