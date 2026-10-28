# close release tool review findings

branch: `task/os/close-release-tool-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2225/close-release-tool-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2225
started: 2026-08-26

## acceptance criteria

- [x] A cancelled runtime publication run is excluded from subsequent exact-SHA discovery so the retry cannot spend its only recovery attempt on the same stale run.
- [x] Runtime publication discovery still fails closed for genuine exact-SHA failures and never accepts another commit.
- [x] Promotion queue waiting and post-dispatch observation use separate time budgets so a long pre-existing promotion cannot consume the new promotion's observation window.
- [x] Focused release regressions pass, strict review is clean, and full verify remains publish-valid before merging back into `stream/os`.

## plan

1. Add focused tests for excluding an observed cancelled publication run and for fresh post-dispatch promotion timing.
2. Extend the runtime-publication selection/discovery contract with excluded run IDs and carry observed cancellations across the orchestrator retry.
3. Split the promotion queue deadline from the post-dispatch polling deadline without changing signing, approval, or exact-bundle correlation.
4. Run focused tests, strict review, full verify, then publish into `stream/os` and re-check PR #2219.

## current status

- Implementation and validation are complete. Cancelled runtime publication IDs are carried into the next exact-SHA discovery and filtered from GitHub run candidates. Promotion queue waiting and post-dispatch correlation now create independent 25-minute deadlines. Exact SHA/bundle safety, protected promotion, and signed target-pointer checks are unchanged.

## files changed

- `packages/os/scripts/lib/release-orchestrator.ts` — excluded cancelled runtime-run IDs across publication retry.
- `packages/os/scripts/lib/release-promotion-correlation.ts` — shared promotion-deadline helper.
- `packages/os/scripts/release.ts` — applies excluded run IDs during exact-SHA polling and resets the promotion observation deadline after dispatch.
- `packages/os/tests/release-orchestrator.test.ts` — stale cancelled-run exclusion regression.
- `packages/os/tests/release-script-promotion-correlation.test.ts` — fresh post-dispatch timing regression.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 18:02:55 `review.run`: passed — OK
- 2026-08-26 18:03:07 `verify`: passed — OK

## key decisions

- Keep exact merged-SHA identity as the publication boundary. Recovery excludes only already-observed cancelled run IDs; it never falls forward to another commit.
- Keep the protected promotion workflow and signed target pointer authoritative. Timing repair is limited to separate queue-wait and post-dispatch deadlines.

## notes for ko

- These close both actionable Codex P2 findings currently blocking confidence in stream PR #2219. No workflow credential scope or protected-environment behavior changed.

## improvements noticed

- none yet

## issues and recovery

- Canonical `session.start({ kind: "task" })` still fails because the facade injects unsupported `timeout` into constructor input (`trc_48707b6d5fba`); used the documented `task.start` compatibility path to create `tsk_3bc12bc4ade0`.

## validation evidence

- Focused RED reproduced both missing contracts: stale cancelled run was selected again and `promotionDeadline` did not exist (`trc_fc7e092f3d65`).
- Focused GREEN: 24/24 release/orchestrator/promotion/security/tool-surface tests passed with 51 assertions (`trc_72fa274d8a9d`).
- Strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_d30c05784277`).
- Full verify: passed, publish-valid, DB gate clean (`trc_7f543d21194f`).
- Workpad filesystem calls began returning an OS facade `UNKNOWN/ExceptionGroup` after verify; this final workpad update used task-scoped `code.call` as the supported fallback.

## Test-first contract

behavior under test: after a watched exact-SHA runtime publication is cancelled, the next discovery must exclude that run ID and wait for a different viable exact-SHA run; promotion queue waiting must not reduce the subsequent newly dispatched promotion's full observation window.
existing local pattern: `release-orchestrator.test.ts` exercises adapter-level release sequencing; `release-script-promotion-correlation.test.ts` exercises promotion queue/correlation helpers; `release.ts` owns GitHub polling and timing.
new or changed tests: add excluded-run candidate/discovery coverage and a pure timing-budget regression that proves queue and post-dispatch deadlines are created independently.
focused red command: `bun test packages/os/tests/release-orchestrator.test.ts packages/os/tests/release-script-promotion-correlation.test.ts`
expected red failure: runtime publication selection has no excluded-run contract and promotion timing has no independently testable post-dispatch deadline helper.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/release-orchestrator.ts`
- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-orchestrator.test.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`

- 2026-08-26 18:01:55 apply-patch: `packages/os/tests/release-orchestrator.test.ts`
- 2026-08-26 18:01:55 apply-patch: `packages/os/tests/release-script-promotion-correlation.test.ts`
- 2026-08-26 18:02:02 apply-patch: `packages/os/tests/release-orchestrator.test.ts`
- 2026-08-26 18:02:20 apply-patch: `packages/os/scripts/lib/release-orchestrator.ts`
- 2026-08-26 18:02:20 apply-patch: `packages/os/scripts/lib/release-promotion-correlation.ts`
- 2026-08-26 18:02:20 apply-patch: `packages/os/scripts/release.ts`
