# serialize full release state queue

branch: `task/os/serialize-full-release-state-queue`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2228/serialize-full-release-state-queue
github pr: https://github.com/consuelohq/opensaas/pull/2228
started: 2026-08-26

## acceptance criteria

- [x] Pre-dispatch release-state queue detection includes runtime publish, promote, and rollback workflows because all three share the `consuelo-os-release-state` GitHub concurrency group.
- [x] Repository-lock stale recovery uses the same full shared-concurrency queue, so it cannot steal a stale-looking lock while publish or rollback is active.
- [x] Post-dispatch correlation remains scoped to promotion runs only and still requires the exact signed target bundle/source commit.
- [x] The full shared-concurrency workflow set is defined once and covered by a focused regression so a future workflow addition cannot silently drift from release queue behavior.
- [x] Focused release/security tests pass, strict review is clean, and full verify is publish-valid before merging into `stream/os`.

## plan

1. Add RED coverage for the exact shared release-state workflow set and for selecting an active publish/rollback from a combined queue.
2. Centralize the three workflow filenames in the release correlation boundary and aggregate their GitHub run lists for pre-dispatch queue checks.
3. Feed the same combined queue into repository-lock stale recovery while leaving post-dispatch promotion correlation on promote-only runs.
4. Run focused release/security tests, strict review, full verify, then publish to `stream/os` and re-check PR #2219.

## current status

- Implementation and validation are complete. The release client now models publish, promote, and rollback as one shared pre-dispatch release-state queue, including stale repository-lock recovery. Post-dispatch correlation remains promotion-only and still verifies the exact signed target bundle/source commit.

## files changed

- `packages/os/scripts/lib/release-promotion-correlation.ts` — canonical release-state workflow set and generic active release-state run selector.
- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts` — stale recovery now asks whether any shared release-state workflow is active.
- `packages/os/scripts/release.ts` — aggregates publish/promote/rollback for queue waiting and lock recovery, while keeping promotion-only dispatch correlation.
- `packages/os/tests/release-script-promotion-correlation.test.ts` — complete workflow-set and combined queue regression.
- `packages/os/tests/release-script-security.test.ts` — source contract proving full queue wiring and promotion-only correlation.
- `packages/os/tests/release-promotion-dispatch-lock.test.ts` — adapter semantic rename to full release-state activity.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 18:37:55 `review.run`: passed — OK
- 2026-08-26 18:38:06 `verify`: passed — OK

## key decisions

- Treat GitHub's `consuelo-os-release-state` concurrency group as one mutation queue. Publish, promote, and rollback are all blockers before a new promotion dispatch.
- Keep post-dispatch promotion correlation promotion-specific; publish/rollback runs are only pre-dispatch serialization evidence and must never count as promotion success.
- Reuse the repository-wide lock added in the prior task; only its active-release-state predicate changes from promotion-only to the full shared queue.

## notes for ko

- This closes the fresh Codex P2 without changing any GitHub workflow, signing key, approval environment, or release artifact format.

## improvements noticed

- none yet

## issues and recovery

- No new workflow/provider mutation is needed. This is release-client orchestration only; protected GitHub workflows, signing, and approval environments remain unchanged.

## validation evidence

- RED: shared workflow-set/helper exports were absent and the release source still wired queue checks only to promotion runs (`trc_5baa2b75b1cc`).
- GREEN: 33/33 focused release/orchestrator/lock/security/tool-surface tests passed with 72 assertions (`trc_af212ebfa44c`).
- Strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_2a701bac156b`).
- Full verify: passed, publish-valid, DB gate clean (`trc_e299cb7ed733`).

## Test-first contract

behavior under test: the release-state queue recognizes active publish, promote, and rollback runs as one serialized mutation queue, while post-dispatch correlation remains promotion-only.
existing local pattern: `release-script-promotion-correlation.test.ts` covers queue selection/correlation and `release-script-security.test.ts` guards release workflow boundaries; `release.ts` owns GitHub run listing.
new or changed tests: assert the canonical shared workflow set contains publish/promote/rollback exactly, and assert an active publish/rollback row in a combined queue blocks dispatch even when promotion rows are terminal.
focused red command: `bun test packages/os/tests/release-script-promotion-correlation.test.ts packages/os/tests/release-script-security.test.ts`
expected red failure: no exported shared release-state workflow set exists and the current source wires queue/stale-lock checks only to `RUNTIME_PROMOTE_WORKFLOW`.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`
- `packages/os/tests/release-script-security.test.ts`

- 2026-08-26 18:37:06 apply-patch: `packages/os/scripts/lib/release-promotion-correlation.ts`
- 2026-08-26 18:37:06 apply-patch: `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- 2026-08-26 18:37:06 apply-patch: `packages/os/tests/release-promotion-dispatch-lock.test.ts`
- 2026-08-26 18:37:06 apply-patch: `packages/os/scripts/release.ts`
- 2026-08-26 18:37:26 apply-patch: `packages/os/tests/release-script-security.test.ts`

- 2026-08-26 18:38:20 apply-patch: `.task/os/serialize-full-release-state-queue/workpad.md`