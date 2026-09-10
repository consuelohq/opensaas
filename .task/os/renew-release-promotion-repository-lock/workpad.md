# renew release promotion repository lock

branch: `task/os/renew-release-promotion-repository-lock`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2229/renew-release-promotion-repository-lock
github pr: https://github.com/consuelohq/opensaas/pull/2229
started: 2026-08-26

## acceptance criteria

- [x] A live owner renews the repository lock lease while the pre-dispatch critical section is running, so another operator cannot reclaim it merely because the original acquisition timestamp is old.
- [x] Renewal is owner-checked and compare-and-swap safe: if ownership changes, renewal fails closed and the old owner cannot overwrite the newer marker.
- [x] Heartbeat/renewal stops before final cleanup and does not leak a background loop after success or failure.
- [x] Truly abandoned stale locks remain recoverable when the lease expires and no shared release-state workflow is active.
- [x] Repository lock semantics remain independent of operator machine/`CONSUELO_HOME`, and protected GitHub workflows/signing/approval gates are unchanged.
- [x] Focused lock/release tests pass, strict review is clean, and full verify is publish-valid before merging into `stream/os`.

## plan

1. Add a RED concurrent-owner regression where the first critical section exceeds the stale threshold and the second operator would reclaim it without renewal.
2. Extend the lock adapter with owner-safe lease renewal and run a cancellable heartbeat while the owner operation executes.
3. Implement renewal in the GitHub Contents API adapter by re-reading the owner/blob SHA and updating the marker with the current lease timestamp using that SHA.
4. Keep stale-lock recovery for truly abandoned owners, run focused tests/review/verify, then publish to `stream/os` and re-check PR #2219.

## current status

- Implementation and validation are complete. The repository marker is now a renewable lease: while the owner critical section runs, a cancellable heartbeat refreshes `acquiredAtMs` every 30 seconds by default (or one quarter of a shorter stale threshold in tests). Renewal is owner-checked and uses the current GitHub blob SHA, so stale owners cannot overwrite newer ownership. The heartbeat is aborted and awaited before cleanup.

## files changed

- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts` — renewable lease heartbeat, immediate cancellation, owner-loss failure semantics.
- `packages/os/scripts/release.ts` — GitHub Contents API compare-and-swap lease renewal implementation.
- `packages/os/tests/release-promotion-dispatch-lock.test.ts` — live-owner-over-stale-threshold concurrency regression plus renewal assertions.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 18:45:59 `review.run`: passed — OK
- 2026-08-26 18:46:12 `verify`: passed — OK

## key decisions

- Keep the existing two-minute stale threshold, but renew well inside it (default 30 seconds) rather than inflating the threshold and leaving crash recovery slow.
- Renewal uses the same owner identity and GitHub blob-SHA compare-and-swap boundary as cleanup. A heartbeat that no longer owns the lock is a fatal ownership loss, not a silent retry.
- The heartbeat must be cancellable immediately when the operation ends; do not make release completion wait for a full heartbeat sleep interval.

## notes for ko

- This closes the current Codex concurrency finding without increasing stale-lock recovery time or changing the protected release workflow.

## improvements noticed

- none yet

## issues and recovery

- This is the eighth Codex review cycle on the stream; the finding is still a concrete concurrency bug, so it is being fixed rather than treated as review churn.

## validation evidence

- RED: with a 25ms stale lease and no renewal, the second operator reclaimed the live first owner and the first failed cleanup ownership (`trc_dc9451e4bd55`).
- GREEN: 34/34 focused release/orchestrator/lock/security/tool-surface tests passed with 75 assertions (`trc_79c71e039ccf`).
- Strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_926a7b6933a5`).
- Full verify: passed, publish-valid, DB gate clean (`trc_16c582fed21f`).

## Test-first contract

behavior under test: a first operator can remain in the critical section longer than `staleAfterMs` while renewing its lease, and a second independent operator must still wait until the first exits; abandoned non-renewed markers remain reclaimable.
existing local pattern: `release-promotion-dispatch-lock.test.ts` already simulates independent operators against shared remote lock state and proves stale recovery/CAS cleanup.
new or changed tests: add adapter renewal support and a concurrent test with a short stale threshold/heartbeat interval that would overlap without renewal; assert renewals occurred and max concurrent critical-section entries remains one.
focused red command: `bun test packages/os/tests/release-promotion-dispatch-lock.test.ts`
expected red failure: the current coordinator never calls adapter renewal, so the second operator reclaims the first owner's still-live marker after the short stale threshold and both critical sections overlap.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-promotion-dispatch-lock.test.ts`

- 2026-08-26 18:44:26 apply-patch: `.task/os/renew-release-promotion-repository-lock/workpad.md`
- 2026-08-26 18:44:39 apply-patch: `packages/os/tests/release-promotion-dispatch-lock.test.ts`
- 2026-08-26 18:45:28 apply-patch: `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- 2026-08-26 18:45:28 apply-patch: `packages/os/scripts/release.ts`

- 2026-08-26 18:46:26 apply-patch: `.task/os/renew-release-promotion-repository-lock/workpad.md`