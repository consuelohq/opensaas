# daily self healing 2026 08 29

branch: `task/self-healing/daily-self-healing-2026-08-29`
stream: `stream/self-healing`
pr: https://github.com/consuelohq/opensaas/pull/2308
started: 2026-08-30

## acceptance criteria

- [x] Inspect current main, `stream/self-healing`, open daily self-healing PRs, perpetual stream review PR, recently merged OS work, and current authoritative OS development.
- [x] Run the deterministic 24h self-healing monitor path; if the installed facade is drifted, use the current-source equivalent without updating/restarting OS.
- [x] Classify high-signal failures by contract and fix at most four related real OS/tooling defects only when evidence supports a bounded correction.
- [x] Keep accepted main changes represented in the task/integration path; resolve substantive sync conflicts deliberately rather than resetting stream history.
- [x] Validate any source correction with test-first evidence, focused checks, strict review, and publish verify.
- [ ] Push and promote the daily task into `stream/self-healing` when gates permit; never merge the persistent stream into main.
- [ ] Publish the normalized self-healing report plus this generated workpad through Daily Schedules/Artifacts and refresh the index.

## plan

1. Recover deterministic monitor evidence from current source because installed `monitor.errors` is missing its script.
2. Reconcile current accepted-main and authoritative `stream/os` state against the self-healing task; inspect the single reported test-selection registry sync conflict rather than discarding it.
3. Investigate the highest-recurrence actionable monitor groups against current contracts, tests, PR history, and runtime/source identity.
4. If a real bounded defect remains, write the focused regression first, prove RED, implement the root fix, prove GREEN, then run review/verify. Otherwise record a no-source-change decision.
5. Update this workpad with classifications, evidence, validation, and telemetry gaps; push/promote the task and publish Daily Schedules.

## Test-first contract

behavior under test: the self-healing monitor must not promote deterministic operation-state/lifecycle-precondition failures into OS defect candidates merely because they recur. Specifically: GitHub checks/log reads requested before the requested data exists are caller operation-state errors; `task.push` publish-valid/sync guards are healthy policy; `session.start` missing-path/missing-area or managed-repo work-session rejections are caller/policy errors; and `task.pr` substantive merge-conflict rejection is task state, not an OS source defect.
existing local pattern: workflow-cancel, filesystem containment, release verification refusal, and lifecycle-active preconditions already use stderr-specific classification while preserving unrelated failures as actionable.
new or changed tests: extend `packages/os/tests/monitor-errors.test.ts` with positive cases for the four observed categories plus negative controls proving unrelated `github`, `task.push`, `session.start`, and `task.pr` failures are still actionable when the monitor has real defect evidence.
focused red command: `bun x vitest run tests/monitor-errors.test.ts` with cwd `packages/os`, after source-safety preflight.
expected red failure: the new observed precondition/wrapper cases are currently returned as `defect-candidate/actionable=true`; negative controls remain actionable.
no-test waiver: not applicable.

## files changed

- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/tests/monitor-errors.test.ts`


## key decisions

- Installed OS runtime is `0.1.93`; installed `monitor.errors` currently fails with `Script not found "monitor:errors"`, so source/runtime drift is already one explicit observation, not automatically a source defect.
- Direct `stream.sync` with `repo` reproduced typed-schema/runtime drift (`unknown flag: --repo`). Retrying without `repo` reached a real merge conflict only in `packages/workspace/test-selection.registry.json`; the conflicting sync worktree is being preserved, not reset or discarded.
- The daily task started from current `stream/self-healing` at source SHA `fe057df6b576448e8b77a626973e803df02584b4`; accepted-main reconciliation will happen on the task/integration path before promotion.
- Accepted `origin/main` was merged into the daily task at `54239e17c65b5cece48e186ee8550dc0629e4983`. The only substantive sync conflict was the generated `packages/workspace/test-selection.registry.json`; it was regenerated from the merged rules/source instead of choosing either stale side, then committed as the merge resolution. `origin/stream/os` and `origin/main` have the same monitor classifier, so today’s selected classifier correction is not already present in authoritative OS development.
- Deterministic current-source monitor report before remediation: 72 groups total; 9 expected-policy, 19 caller-input, 24 defect-candidate/actionable, 17 transient, 0 external, 3 unknown. Selected high-recurrence false-positive evidence includes `github/COMMAND_FAILED` (21), `task.push/COMMAND_FAILED` (14), `session.start/COMMAND_FAILED` (13), and `task.pr/COMMAND_FAILED` (9).
- `mac.call/COMMAND_FAILED` is the largest raw group (31), but the sampled group mixes explicit sub-100ms caller timeouts with successful partial `du` output followed by child exit 1. The current normalized monitor does not retain enough child-result detail to safely generalize a source correction, so it is investigated but not selected today.
- The 25 `authorization.mcp/OAUTH_INTROSPECTION_UNAVAILABLE` failures occurred from 2026-08-29T02:12:46Z through 08:10:12Z and did not continue afterward. Read-only Sentry showed zero unresolved issues and zero introspection matches for the last 24h. No bounded source correction is justified from that incident alone; keep it as provider/runtime incident evidence rather than faking success or weakening auth.
- TDD RED: focused monitor suite ran 17 tests and failed exactly the four new positive regression cases while all 13 prior/negative cases passed (`trc_45ae4a951e22`).
- TDD GREEN: focused monitor classifier passed 17/17 after the bounded classifier change (`trc_13c6d38031c2`). Canonical monitor rule execution with Bun then passed 20/20 across classifier + report aggregation tests (`trc_a016d2a36243`).
- The accepted-main registry reconciliation was validated independently: `packages/workspace/tests/test-selection.test.js` passed 76/76 (`trc_26051cb37311`).
- Post-fix deterministic monitor report has 77 groups: 11 expected-policy, 22 caller-input, 24 defect-candidate/actionable, 17 transient, 0 external, 3 unknown. The total group count increased because deterministic caller/policy reasons are now split from residual same-tool/code failures instead of being collapsed into them. Observed corrected subsets now appear separately: GitHub not-yet-readable state (3) caller-input; task.push publish/sync guard (7) expected-policy; session.start missing prerequisite (3) caller-input and managed-repo work-session block (1) expected-policy; task.pr substantive merge-conflict state (6) caller-input. Residual same-tool groups remain actionable rather than being hidden by these corrections.
- Final publish validation was rerun against the synchronized task head (`HEAD` = accepted-main merge `54239e17c65b5cece48e186ee8550dc0629e4983`) so accepted-main changes were treated as the integration baseline rather than re-linted as task-owned changes. `verify` passed, was publish-valid, selected only the two task-owned monitor files, reported 0 review blockers / 0 related-pre-existing findings, and DB guard 0 risks / 0 findings (`trc_054c4cff628c`). Earlier `verify --base origin/stream/self-healing` failures were caused by treating the 137 accepted-main commits being synchronized into the stream as the task delta; they did not identify task-owned defects.
- The prior daily task PR #2267 (2026-08-28) remains open and clean with its own distinct runtime-routing fixes. It was inspected specifically to avoid duplicating those fixes; this task does not absorb or discard that branch.
- A read-only tool-catalog check did not expose a normalized hosted install/onboarding impact read model; only local `monitor.errors`/doctor-style diagnostics were discoverable. Read-only Sentry evidence already recorded above found no unresolved relevant issue, so no hosted-user impact is inferred.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- Installed `monitor.errors` facade failed before any code work: `Script not found "monitor:errors"` (`trc_7f7f278f1501`).
- `stream.sync` with `repo` failed because the installed script rejects `--repo` (`trc_0dd29ef89be4`).
- `stream.sync` without `repo` reached a substantive conflict in `packages/workspace/test-selection.registry.json` and stopped safely (`trc_f1bfdc320bc5`).

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-30 02:04:29 write: `.task/self-healing/daily-self-healing-2026-08-29/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 02:04:29 fs.write: `.task/self-healing/daily-self-healing-2026-08-29/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/mac.js`
- `packages/os/scripts/monitor-errors.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tools/mac/handler.ts`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- 2026-08-30 02:19:24 `review.run`: passed — OK
- 2026-08-30 02:22:18 `verify`: failed — COMMAND_FAILED
- 2026-08-30 02:24:27 `verify`: failed — COMMAND_FAILED
- 2026-08-30 02:26:47 `verify`: failed — COMMAND_FAILED
- 2026-08-30 02:28:40 `verify`: failed — COMMAND_FAILED
- 2026-08-30 02:35:34 `verify`: passed — OK

- 2026-08-30 02:36:36 apply-patch: `.task/self-healing/daily-self-healing-2026-08-29/workpad.md`