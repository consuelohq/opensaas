# yield release lock lease between queue queries

branch: `task/os/yield-release-lock-lease-between-queue-queries`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2230/yield-release-lock-lease-between-queue-queries
github pr: https://github.com/consuelohq/opensaas/pull/2230
started: 2026-08-26

## acceptance criteria

- [x] The lock owner can explicitly renew its repository lease from inside the critical section, independent of the timer heartbeat.
- [x] Release queue/dispatch logic renews the lease between synchronous GitHub commands, so no chain of blocking `spawnSync` calls can consume the two-minute stale lease without an owner refresh.
- [x] Manual renewal is owner-checked and fails closed on ownership loss; the existing timer heartbeat remains as protection during asynchronous waits such as `fetchChannel`.
- [x] Post-dispatch correlation, exact signed target checks, repository-wide coordination, and protected GitHub release workflows remain unchanged.
- [x] Focused release/lock tests pass, strict review is clean, and full verify is publish-valid before merging into `stream/os`.

## plan

1. Add a RED lock regression where the timer heartbeat is intentionally too slow to help, but explicit owner renewal keeps a long critical section from being reclaimed.
2. Pass an owner-scoped `renew()` lease handle into the critical-section callback.
3. In `release.ts`, renew immediately before/after each synchronous GitHub queue query and dispatch command; keep the timer heartbeat for async waits.
4. Run focused release/lock/security tests, strict review, full verify, then publish to `stream/os` and stop review-chasing unless a deterministic check fails.

## current status

- Implementation and validation are complete. The lock helper now provides an owner-scoped `lease.renew()` handle in addition to the timer heartbeat. The release critical section renews before and after each bounded synchronous GitHub queue/dispatch query, and the three shared release-state workflow queries reuse the already-fetched promotion rows rather than doing a fourth pre-dispatch call. Timer and manual renewals are serialized to avoid compare-and-swap collisions.

## files changed

- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts` — explicit lease handle plus serialized timer/manual renewal path.
- `packages/os/scripts/release.ts` — lease renewal between synchronous GitHub queue/dispatch calls and promotion-row reuse.
- `packages/os/tests/release-promotion-dispatch-lock.test.ts` — manual-renewal regression with the timer intentionally too slow to help.
- `packages/os/tests/release-script-security.test.ts` — updated release queue/lease source contract.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 18:55:31 `review.run`: passed — OK
- 2026-08-26 18:55:43 `verify`: passed — OK

## key decisions

- Do not replace the whole release CLI with async process plumbing in this release. The bounded synchronous GitHub calls already have 30s timeouts; explicit owner renewal between calls gives a deterministic < stale-threshold lease age while preserving the existing CLI/error-handling surface.
- Keep the timer heartbeat because asynchronous `fetchChannel` waits do yield to the event loop. Manual renewal complements it specifically where synchronous subprocesses can starve timers.
- After this fix, rely on deterministic CI + local strict review/verify rather than starting another unbounded automated-review cycle; this stream has already had nine Codex passes and every concrete P2 has been addressed.

## notes for ko

- This closes the latest Codex P2. I am treating deterministic CI plus the clean local strict review/full verify as the final engineering gate rather than starting another open-ended automated-review loop.

## improvements noticed

- none yet

## issues and recovery

- This task is narrowly scoped to the current fresh P2. No workflow files, signing configuration, or release artifact format need to change.

## validation evidence

- RED: explicit lease renewal was unavailable and the new regression failed with `lease.renew` undefined (`trc_d3c96e21ae63`).
- GREEN: 35/35 focused release/orchestrator/lock/security/tool-surface tests passed with 80 assertions (`trc_965454ea7a2f`).
- Strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_fdeeb676748b`).
- Full verify: passed, publish-valid, DB gate clean (`trc_737e3f0e496c`).

## Test-first contract

behavior under test: when the background heartbeat interval is longer than the stale threshold, a live owner can explicitly renew from inside its critical section and a second operator still cannot reclaim the lock after the original timestamp would otherwise be stale.
existing local pattern: `release-promotion-dispatch-lock.test.ts` simulates two independent operators against shared remote state and already covers timer renewal, stale recovery, and compare-and-swap cleanup.
new or changed tests: add a manual-renewal test with `staleAfterMs=25`, `heartbeatIntervalMs=1000`, first operation > stale threshold, explicit lease renewals during the operation, and a second operator starting after the original lease would be stale.
focused red command: `bun test packages/os/tests/release-promotion-dispatch-lock.test.ts`
expected red failure: the current critical-section callback receives no lease handle, so explicit renewal is unavailable and the second operator reclaims the marker before the first completes.
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

- 2026-08-26 18:54:04 apply-patch: `.task/os/yield-release-lock-lease-between-queue-queries/workpad.md`
- 2026-08-26 18:54:13 apply-patch: `packages/os/tests/release-promotion-dispatch-lock.test.ts`
- 2026-08-26 18:54:43 apply-patch: `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- 2026-08-26 18:54:43 apply-patch: `packages/os/scripts/release.ts`
- 2026-08-26 18:55:02 apply-patch: `packages/os/tests/release-script-security.test.ts`

- 2026-08-26 18:55:59 apply-patch: `.task/os/yield-release-lock-lease-between-queue-queries/workpad.md`