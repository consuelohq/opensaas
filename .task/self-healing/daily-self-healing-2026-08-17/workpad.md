# Daily self-healing 2026-08-17

branch: `task/self-healing/daily-self-healing-2026-08-17`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2160/daily-self-healing-2026-08-17
github pr: https://github.com/consuelohq/opensaas/pull/2160
started: 2026-08-18

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tools/deployment-provider/cloudflare.test.ts`
- `packages/os/tools/deployment-provider/cloudflare.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-18 01:58:57 fs.write: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`
- 2026-08-18 02:02:23 fs.write: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`
- 2026-08-18 02:03:04 fs.write: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`
- 2026-08-18 02:15:30 fs.write: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`
- 2026-08-18 02:17:23 fs.write: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`

## workspace-owned: validation evidence

- 2026-08-18 02:03:54 `review.run`: passed — OK
- 2026-08-18 02:06:39 `verify`: failed — COMMAND_FAILED
- 2026-08-18 02:09:07 `verify`: failed — COMMAND_FAILED
- 2026-08-18 02:11:13 `verify`: failed — COMMAND_FAILED
- 2026-08-18 02:16:09 `review.run`: passed — OK
- 2026-08-18 02:16:32 `verify`: passed — OK

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
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tools/deployment-provider/cloudflare.test.ts`
- `packages/os/tools/deployment-provider/cloudflare.ts`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/test-selection.test.js`

## acceptance criteria

- [ ] Reconstruct the last-24h OS failure picture from the canonical trace database even though the installed `monitor.errors` facade is runtime/source-drifted, and classify representative failures by governing contract rather than error count alone.
- [ ] Check current `main`, `stream/self-healing`, `stream/os`, open self-healing task PRs, the perpetual stream review PR, and recent merged OS PRs before selecting any source correction.
- [ ] Inspect normalized install/onboarding/control-plane evidence if a current read-only OS surface exists; otherwise record the telemetry gap without inventing impact.
- [ ] Fix only bounded high-confidence defects not already fixed in current authoritative source. Preserve intentional policy/caller rejections and do not duplicate the existing GitHub CLI or monitor fixes already on `stream/self-healing`.
- [ ] Reconcile accepted current main/authoritative OS work into the daily task without resetting accepted self-healing history, resolve substantive conflicts deliberately, and leave the task mergeable into `stream/self-healing`.
- [ ] Run focused regression proof, review, and publish-valid verify before task push/promotion. Promote only task -> `stream/self-healing`; never merge `stream/self-healing` -> `main`.
- [ ] Publish the normalized self-healing report plus this generated workpad into Daily Schedules after the workpad contains final investigation/remediation evidence.

## plan

1. Use source-fallback `monitor:errors` against the canonical trace DB, then inspect representative stderr/result evidence for the highest-frequency groups.
2. Compare plausible defect candidates with current `main`, `stream/os`, open/recent OS work, schemas/capabilities, sibling behavior, and focused tests so already-fixed or caller/external failures are excluded.
3. Select one coherent bounded root cause (or record a no-source-change decision), write the test-first contract, and reproduce the failing contract before any production edit.
4. Reconcile current accepted source into the task while preserving the self-healing-only commits; resolve only evidence-backed conflicts and rerun affected tests.
5. Implement the smallest correction, run focused green tests plus review/verify, push the task PR, promote into `stream/self-healing`, verify PR #1941 remains the human-only main boundary, and publish Daily Schedules.

## current status

- Task PR #2160 started from `stream/self-healing` at `f4264d12212b`; current `origin/main` is `c88a107f91c0` and authoritative `origin/stream/os` is `42b152196fd8`.
- `stream/self-healing` is materially stale/diverged: current main has 364 commits absent from the stream and the stream has 7 self-healing-only commits. `stream/os` is 172 commits ahead of main with one main-only commit.
- Installed `monitor.errors` fails with `Script not found "monitor:errors"`. The same current-source script exists and successfully analyzed `/Users/kokayi/.consuelo/node/db/traces.db`: 32 failure groups, 14 initially marked actionable, 7 caller-input, 9 transient, 1 expected-policy, 1 unknown.
- The largest `code.call/COMMAND_FAILED` group is dominated by GitHub HTTP 503 responses during release promotion and is external/transient evidence, not a source defect merely because the generic monitor classifier called it actionable.
- Installed typed `github` still invokes the shadowed Consuelo `gh` wrapper and fails JSON parsing. That root cause was already fixed by the accepted self-healing commit `04e8b9931f`; do not duplicate it. Read-only GitHub inspection therefore used explicit `/opt/homebrew/bin/gh` as a scoped runtime-drift fallback.
- Repeated Cloudflare `deployment.logs` (`cloudflare could not build logs.read`) and `deployment.raw` (`cloudflare could not build raw`) failures are a plausible shared provider-adapter candidate and require source/contract comparison before any edit.
- `stream.sync` previously entered substantive merge conflicts and left its temporary stream worktree dirty; retrying correctly refused to overwrite that state. Do not reset it. Reconciliation will occur on the daily task path once the selected correction and stream-only intent are understood.
- Open self-healing daily PRs: only #2160. Perpetual stream review PR #1941 remains open from `stream/self-healing` to `main`. Recent merged OS work was inspected, including worker-drain, retention/watchdog, internal-dashboard, and enrollment tasks.

## key decisions

- Treat generic command failures caused by GitHub 503s, bad search paths/regexes, or child failures propagated through `batch` as external/caller/transient unless their underlying contract contradicts current capability metadata.
- Existing accepted self-healing fixes are authoritative evidence even though current installed runtime/main has not converged to them; do not recreate those changes.

## issues and recovery

- Canonical installed `monitor.errors` is runtime/source-drifted. Recovery: executed the same source-owned monitor script from the generated daily task worktree against the canonical trace DB; no trace rows were mutated.
- Typed `github` is runtime-drifted to the pre-fix wrapper behavior. Recovery for read-only repository inspection: explicit system GitHub CLI path only; no GitHub mutation was performed through the fallback.
- `stream.sync` has an unresolved temporary sync worktree with substantive conflicts. Recovery will preserve stream history and reconcile on the task branch rather than deleting/resetting the conflicted stream worktree.

- 2026-08-18 01:58:57 append: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`

## test-first contract

- Selected root cause: Cloudflare customer-provider command builders use ordinary `Error` for caller-controlled reference validation. The shared provider service only maps `ProviderInputError` to `INVALID_INPUT`; ordinary builder errors are converted to `MALFORMED_OUTPUT`. This turns intentional operator-resource rejection and malformed caller references into misleading defect-candidate traces.
- Intended invariant: invalid or forbidden caller Cloudflare references must remain rejected before Wrangler starts, but the normalized provider error must be `INVALID_INPUT`, matching the sibling Railway provider and the service’s advertised input-error contract. Output parsing failures remain `MALFORMED_OUTPUT`.
- Regression coverage: change the existing operator-owned raw-reference expectation in `packages/os/tools/deployment-provider/cloudflare.test.ts` from `MALFORMED_OUTPUT` to `INVALID_INPUT`, and add a `logsRead` assertion showing an operator-owned service reference also yields `INVALID_INPUT` with zero provider-process requests.
- RED command: `bun --cwd packages/os test tools/deployment-provider/cloudflare.test.ts` after test-only changes and before production implementation. Expected RED: current Cloudflare helpers throw ordinary `Error`, so both affected paths normalize to `MALFORMED_OUTPUT` rather than `INVALID_INPUT`.
- GREEN command: rerun the same focused test after changing only the Cloudflare input validators to throw `providerInputError`; then run the adjacent deployment-provider handler/facade tests.

## reconciliation evidence

- Daily task reconciled accepted `origin/main` into the task branch with merge commit `b7713024bfbf`, preserving both parents (`59d264d...` self-healing task base and `c88a107f...` current main) rather than resetting stream history.
- Substantive conflicts were resolved in favor of current accepted main except for the accepted self-healing monitor invariant `tool_traces.ok = 0`; main still carried the pre-fix free-form status/code query, so `packages/os/scripts/lib/monitor-errors-report.ts` intentionally retained the stream version.
- The accepted GitHub CLI external-resolution fix auto-merged cleanly. Its focused `os-github-cli-runtime` verification mapping was reintroduced into current main’s newer test-selection rule set and the registry was regenerated, preserving yesterday’s validation contract without discarding new main rules.
- There is no typed task-branch merge-into-task operation in the currently exposed OS surface. Task-scoped Git was therefore used only for this reconciliation/merge commit; the dirty `stream.sync` temporary worktree was not reset or modified.
- Hosted normalized install/onboarding telemetry is not exposed by the currently installed OS tool surface (`tools.search` returned no read-only control-plane/user-impact tool). This run therefore continues from local dogfood traces and repository/runtime evidence and records the telemetry gap rather than inventing hosted-user impact.

- 2026-08-18 02:02:23 append: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`

- 2026-08-18 02:02:28 apply-patch: `packages/os/tools/deployment-provider/cloudflare.test.ts`
- 2026-08-18 02:02:45 apply-patch: `packages/os/tools/deployment-provider/cloudflare.ts`
## remediation evidence

- RED reproduced exactly: focused Cloudflare provider test failed because the actual normalized code was `MALFORMED_OUTPUT` while the regression required `INVALID_INPUT`; provider process remained uninvoked.
- Implementation: `packages/os/tools/deployment-provider/cloudflare.ts` now routes caller/reference validators through `providerInputError` (including empty/unsafe raw arguments). Output-shape/parser exceptions remain ordinary errors and therefore remain `MALFORMED_OUTPUT`.
- GREEN: `cloudflare.test.ts` passed 14/14; adjacent `handler.test.ts` + `facade.test.ts` passed 33/33. The operator-owned boundary is still fail-closed and Wrangler is not invoked.
- This is one shared contract repair affecting the observed `deployment.logs` and `deployment.raw` MALFORMED_OUTPUT groups rather than two symptom patches.

- 2026-08-18 02:03:04 append: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`

## second test-first contract: deployment-provider verification ownership

- The first full verify exposed a second, directly related tooling defect: `packages/os/tools/deployment-provider/**` has no explicit test-selection owner, so a bounded Cloudflare adapter change falls through to the package-wide `@consuelo/os` test suite. That broad suite currently has dozens of unrelated accepted-main failures (media dry-run, subagent, facade compatibility, etc.) and is not evidence about this adapter boundary.
- Intended invariant: deployment-provider adapter/source/test changes must select the focused Cloudflare/Vercel provider, handler, and facade contracts and suppress the unrelated package-wide OS baseline, matching the repository’s existing `exclusive` focused-rule pattern. This narrows validation to the actual contract rather than skipping tests.
- RED coverage: add a selector regression in `packages/workspace/tests/test-selection.test.js` requiring a Cloudflare provider source change to match `os-deployment-provider-adapters`, exclude `auto:@consuelo/os:package-test`, and select the focused deployment-provider suite. Run that test before adding the rule; it must fail on current selection.
- GREEN: add the explicit critical/exclusive rule to `packages/workspace/test-selection.rules.json`, regenerate `test-selection.registry.json`, rerun the selector regression, then use the synchronized pre-fix merge commit `b7713024bfbf` as the verify base so validation covers today’s actual changes rather than re-litigating accepted main history.
- The earlier base=`origin/stream/self-healing` full verify was intentionally retained as evidence: review/DB checks were sound, but test selection included accepted-main differences and unrelated broad-suite failures; it wrote no publish-valid stamp. One incidental facade snapshot mutation from that failed broad suite was reverted exactly and not adopted.

- 2026-08-18 02:15:30 append: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`

- 2026-08-18 02:15:35 apply-patch: `packages/workspace/tests/test-selection.test.js`

## final validation evidence

- Second RED reproduced exactly: selector coverage for `packages/os/tools/deployment-provider/cloudflare.ts` matched only `auto:@consuelo/os:package-test`; the focused `os-deployment-provider-adapters` rule did not exist.
- Second GREEN: added critical/exclusive `os-deployment-provider-adapters`, regenerated `packages/workspace/test-selection.registry.json`, and the selector now chooses only `OS deployment-provider adapter contracts` for the provider source. Focused provider validation passed 65/65 across Cloudflare, Vercel, handler, and facade tests.
- Reconciliation preservation tests passed: workspace test-selection + GitHub CLI + review-scope coverage passed 50/50; accepted self-healing monitor contracts passed 7/7 under Bun's native test runner. The earlier package-Vitest attempt for the Bun-SQLite monitor test was a runner/runtime mismatch (`bun:sqlite` unavailable under Node/Vitest), not a product regression.
- Strict review against synchronized pre-fix base `b7713024bfbf` passed with 0 blocking findings, 0 owned issues, and one nonblocking documentation opportunity. No public documentation change was taken because this correction changes internal error normalization/verification ownership rather than the user-facing deployment-provider operation set.
- Full typed `verify` against `b7713024bfbf` passed and wrote a publish-valid stamp: review passed; selected tests passed; DB guard passed with 0 risks and 0 findings; mode `full`; stamp path `.task/self-healing/daily-self-healing-2026-08-17/verify.json`.
- The earlier full verify against stale `origin/stream/self-healing` is retained as diagnostic evidence only. It failed because it re-tested hundreds of already-accepted main changes, including stale worker-port assertions and the unrelated broad OS suite. It wrote no valid stamp. An incidental facade snapshot update from that failed broad suite was reverted exactly before final verification.

## selected defects

1. Cloudflare customer-provider input validation incorrectly surfaced intentional caller/reference rejections as `MALFORMED_OUTPUT`. Fixed by using the shared `ProviderInputError` path so these remain fail-closed but normalize to `INVALID_INPUT`; actual output parsing failures remain `MALFORMED_OUTPUT`.
2. Deployment-provider source had no focused test-selection ownership, so bounded provider changes fell through to the unrelated package-wide OS suite. Fixed with a critical/exclusive focused provider rule and regression coverage.

No additional source change was justified from the other recent groups: GitHub 503s were external/transient; invalid filesystem/search/batch calls were caller/propagated failures; installed `monitor.errors` and installed GitHub CLI behavior are runtime/source drift where accepted self-healing source already contains the correction.

- 2026-08-18 02:17:23 append: `.task/self-healing/daily-self-healing-2026-08-17/workpad.md`
