# daily self healing 2026 08 24

branch: `task/self-healing/daily-self-healing-2026-08-24`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2177/daily-self-healing-2026-08-24
github pr: https://github.com/consuelohq/opensaas/pull/2177
started: 2026-08-25

## acceptance criteria

- [x] Run the canonical 24-hour self-healing monitor first, falling back to the synchronized task source when the installed facade is stale.
- [x] Reconstruct the contract for every actionable group using current `stream/self-healing`, runtime identity, raw bounded trace evidence, recent PR history, and current authoritative OS development where relevant.
- [x] Do not duplicate fixes that already exist in current source or turn caller/policy/transient failures into source changes.
- [x] Validate the current monitor classifier and GitHub CLI runtime-resolution contracts that govern today's strongest signals.
- [x] Record a truthful no-source-change maintenance decision when no bounded source correction is better than current behavior.
- [ ] Push the generated task record, promote PR #2177 into `stream/self-healing`, and publish the Daily Schedules report/workpad without merging to `main`.

## plan

1. Run `monitor.errors`; because installed OS 0.1.67 lacks the `monitor:errors` script, run the same normalized report from the synchronized task source.
2. Inspect `main`, `stream/self-healing`, PR #1941, the open daily task PR, recent merged PRs, `stream/os`, and bounded raw trace details for actionable/transient groups.
3. Confirm whether today's strongest groups are real source defects, caller/policy failures, transient/external behavior, installed-runtime drift, or already fixed in current source.
4. Validate the current contracts with their focused tests. Make no production-code edit unless evidence proves a new bounded defect.
5. Update this generated workpad, run review/verify for the maintenance record, push/promote the daily task, and publish the normalized report plus this workpad through the best current Daily Schedules capability.

## current status

- Investigation complete. **No source-code change is justified today.**
- Generated task report (captured before investigation added its own caller mistakes): 14 groups — 2 caller-input, 2 defect-candidate, 8 transient, 2 unknown; 2 actionable. A later diagnostic rerun showed 15 groups / 3 caller-input after this run added one validation error; the two actionable groups and remediation decision were unchanged.
- The two actionable groups are both installed-runtime/source drift: `github/COMMAND_FAILED` (5 occurrences) and `monitor.errors/COMMAND_FAILED` (3 occurrences). Current source already contains the fixes/contracts, so duplicating them would be incorrect.
- PR #1941 (`stream/self-healing -> main`) is OPEN/CLEAN with 51 checks, 0 failed, 0 pending. `stream/self-healing` is 32 commits ahead of and 0 behind current `main`.
- Review/verify completed successfully through the synchronized source fallback. Promotion and artifact publication remain.

## files changed

- Generated task workpad only; no product/source file changed.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-25 02:09:39 `review.run`: passed — OK
- 2026-08-25 02:11:34 `review.run`: passed — OK
- 2026-08-25 02:13:22 `verify`: passed — OK

## key decisions

- **No source change:** current source already repairs every high-confidence actionable runtime failure observed today.
- `github/COMMAND_FAILED` is installed-runtime drift. The installed facade still resolves the Consuelo `gh` wrapper recursively, while synchronized source routes through `resolveGitHubCli()` and excludes Consuelo wrapper directories. The current-source GitHub facade successfully read PR #1941, PR #2177, branch comparisons, and recent merged PRs; its focused resolver tests pass 2/2.
- `monitor.errors/COMMAND_FAILED` is installed-runtime drift. Installed 0.1.67 reports `Script not found "monitor:errors"`; synchronized source declares `monitor:errors` and directly produced the normalized report. No second implementation is needed.
- Repeated `code.call` and `batch` failures are intentionally non-actionable wrapper evidence in current source. Bounded raw samples include caller-authored Bun syntax errors (`return` at module top level) and child-tool failures; recurrence alone does not prove either wrapper is broken.
- The `fs.read` inactive-branch group is correctly caller-input in current source (the 2026-08-23 self-healing fix). The root/main fallback report looked stale because it did not contain the accumulated self-healing classifier fixes.
- Both observed `stream.sync --repo` failures are the already-fixed runtime/source drift covered by the 2026-08-20 self-healing correction; do not patch it again.
- Security-maintenance lifecycle failures from one task session trace to the same stale runtime boundaries: missing `security:scan`/Daily Schedules scripts and the stale GitHub wrapper. That task ultimately merged as PR #2176, so there is no independent new self-healing root cause to patch from those recovered calls.
- `stream/os` is materially divergent (172 ahead / 3 behind `main`) but does not contain a newer implementation needed for today's two actionable groups. `stream/self-healing` itself is current with accepted `main` (32 ahead / 0 behind).

## notes for ko

- Installed runtime identity: Consuelo OS `0.1.67`, bundle `sha256:424824f9f75c32c657fc754f7ce975ab1a103c3159ec12351cf7b6ddf6b5a263`; last successful recorded update was 2026-08-17 15:55 UTC. No install/update/restart/rollback/uninstall action was run.
- Source refs at investigation time: task HEAD `08731b542d654f797960140d0ab1a9c3b7eb7b49`; `origin/stream/self-healing` `364f640731e351054631d0dfc3387ab8dbb87f1d`; `origin/main` `b0e7016159103e3c3850dac6937f7b5333a72450`; `origin/stream/os` `42b152196fd8afabb76169a5d5fb31873f4408eb`.
- Hosted normalized install/onboarding error-group telemetry is not exposed through the current typed read surface. Sentry is configured and reachable; a read-only organization query returned zero unresolved issues in the last 24 hours. No hosted-user impact was invented.

## improvements noticed

- The installed runtime is now old enough that several already-fixed source contracts recur as operational noise. That is a release/update follow-up, not authorization for this schedule to update the machine.

## issues and recovery

- Installed `monitor.errors` failed with `Script not found "monitor:errors"`; recovered by running the synchronized source implementation without mutating the runtime.
- Installed `github` failed because the stale runtime invoked the Consuelo `gh` wrapper recursively. Recovered read-only GitHub inspection through the synchronized source facade, whose `resolveGitHubCli()` contract excludes Consuelo wrapper paths.
- One exploratory `code.call` used a top-level `return`, and one later call omitted the required `language` field. Both are caller-input/tool-invocation mistakes and were not attributed to OS defects.
- A combined Vitest invocation passed the 9 classifier tests but could not load `bun:sqlite` for the report suite under the Node/Vitest harness. Re-running the canonical Bun-native monitor suite passed 11/11; the harness mismatch is not a product defect.

## Test-first / no-source-change contract

- Behavior checked: current self-healing source must keep wrapper-propagated failures non-actionable, classify stale branch reads as caller input, select only `ok = 0` traces, preserve stderr only for internal classification, and resolve the real GitHub CLI outside Consuelo wrapper directories.
- Source edit decision: none. The observed actionable failures already have source corrections, so adding a new regression or implementation change would duplicate accepted work.
- Validation: `bun test packages/os/tests/monitor-errors.test.ts packages/os/tests/monitor-errors-report.test.ts` — **11/11 passed**; `bun x vitest run packages/workspace/tests/github-cli-resolution.test.ts` — **2/2 passed**.
- Runtime proof: the synchronized-source monitor reduced the stale root report's apparent six actionable groups to the two genuine drift groups without suppressing traces: GitHub runtime resolution and missing installed monitor script.

## review / verify evidence

- Installed typed `review.run` and `verify` each surfaced an outer runtime `ExceptionGroup` rather than a normal tool result. The synchronized source equivalents were used instead; this is recorded as facade/runtime drift rather than bypassing the gates.
- Strict source review against `origin/stream/self-healing` exited 0. The large lint inventory in its bounded packet was classified as pre-existing repository evidence, not task-owned findings.
- Full source verify against `origin/stream/self-healing` exited 0 and wrote a **publish-valid** stamp.
- Test selection passed with zero selected suites because the task changes are generated task metadata/workpad only; the focused monitor and GitHub resolver suites were run explicitly above.
- DB guard: **0 risks / 0 findings**.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/github.js`
- `packages/os/scripts/lib/daily-schedules-publisher.ts`
- `packages/os/scripts/lib/daily-schedules.ts`
- `packages/os/scripts/lib/github.js`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/lib/state/evidence-log.js`
- `packages/os/scripts/lib/state/explore-state.js`
- `packages/os/scripts/monitor-errors.ts`
- `packages/os/scripts/task-fs.js`
- `packages/os/streams/self-healing/AGENTS.md`
- `packages/os/test-selection.rules.json`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tools/artifacts/handler.ts`
- `packages/os/tools/artifacts/schema.ts`
- `packages/workspace/scripts/github.js`
- `packages/workspace/scripts/lib/state/evidence-log.js`
- `packages/workspace/scripts/lib/state/explore-state.js`
- `packages/workspace/scripts/lib/task-registry.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/test-selection.rules.json`

- 2026-08-25 02:17:07 apply-patch: `.task/self-healing/daily-self-healing-2026-08-24/workpad.md`