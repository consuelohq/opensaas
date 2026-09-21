# make release promotion dispatch idempotent

branch: `task/os/make-release-promotion-dispatch-idempotent`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2222/make-release-promotion-dispatch-idempotent
github pr: https://github.com/consuelohq/opensaas/pull/2222
started: 2026-08-26

## acceptance criteria

- [x] Before dispatching, wait behind any already queued/in-progress protected promotion instead of creating another workflow_dispatch run while the globally serialized release-state queue is occupied.
- [x] Re-check the signed target channel after queued promotions clear so a retry whose exact promotion already finished returns success without dispatching again.
- [x] Dispatch only after the protected promotion queue is empty, then preserve the existing signed-pointer correlation and fail-closed behavior.
- [x] Preserve the global release-state concurrency/approval/signing workflow and exact-bundle/source-commit safety checks.
- [x] Add focused RED/GREEN regressions, pass release workflow/security tests, strict review, and full verify, then merge the task into stream/os.

## plan

1. Extend promotion-correlation tests first for active protected-promotion queue detection.
2. Make `release.ts` wait behind active promotion runs and re-check the signed target channel before deciding to dispatch.
3. Preserve the existing post-dispatch correlation and exact bundle/source-commit checks.
4. Run focused release/workflow/security tests, review, verify, then publish to stream/os.

## current status

- Implementation and validation are complete. `release` now treats the protected promotion workflow as one globally serialized mutation queue: while any promotion is queued/in progress it waits instead of dispatching another; after the queue clears it re-checks the signed target channel before dispatching. If an earlier retry already promoted the requested exact bundle, the next retry exits successfully without creating another run. The global release-state concurrency and protected environments are unchanged.

## files changed

- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 15:17:59 `review.run`: passed — OK
- 2026-08-26 15:18:12 `verify`: passed — OK
- 2026-08-26 15:22:11 `review.run`: passed — OK
- 2026-08-26 15:22:25 `verify`: passed — OK

## key decisions

- Keep `group: consuelo-os-release-state` and `cancel-in-progress: false`; release-state serialization is intentional and must not be weakened.
- Treat any active protected promotion as a serialization blocker because the workflow already uses one global release-state concurrency group.
- The signed target channel remains final success authority; queue waiting never substitutes recency or branch SHA for exact bundle/source-commit verification.

## notes for ko

- This specifically fixes the second failure seen during the live release: retries will no longer fan out multiple indistinguishable promotion runs once this stream reaches main/runtime.
- The first cancelled-publication race repair remains in the same `stream/os` review surface, so both release-tool fixes travel together.

## improvements noticed

- none yet

## issues and recovery

- GitHub's `gh run cancel` reports queued promotion runs as non-cancellable before their jobs enter the scheduler. The release repair therefore focuses on preventing duplicate dispatches rather than relying on cleanup after the fact.
- The first implementation used a deterministic workflow `run-name`, but `task.push` exposed that the current GitHub credential lacks the `workflow` scope (`trc_71dff5f03b58`, `trc_970ec1dbc5e4`). Rather than require a new credential scope, the final implementation uses the workflow's existing global release-state serialization as the idempotency boundary and leaves the protected workflow file unchanged.

## validation evidence

- Initial RED proved the first deterministic-title approach was absent (`trc_6f265dcd9f5d`). After the credential-scope discovery, the final queue-serialization regression went RED because `selectActivePromotionRun` did not exist (`trc_0cf070ce10fa`).
- Final GREEN: 30/30 focused release/orchestrator/workflow/security tests, 179 assertions (`trc_f52e77799073`).
- Final strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_9df3fae546f4`).
- Final full verify against `origin/stream/os`: passed, publish-valid, DB gate clean (`trc_c7e066f19c24`).

## Test-first contract

behavior under test: repeated `release` calls must not dispatch another protected promotion while the global release-state promotion queue is already occupied; after the queue clears, the signed target pointer is re-checked before any new dispatch.
existing local pattern: `packages/os/tests/release-script-promotion-correlation.test.ts` unit-tests correlation, `packages/os/tests/distribution/release-channel-workflows.test.ts` asserts protected workflow structure, and `packages/os/scripts/release.ts` owns dispatch/polling.
new or changed tests: active promotion queue selection plus the existing signed-pointer correlation and protected-workflow contracts.
focused red command: `bun test packages/os/tests/release-script-promotion-correlation.test.ts packages/os/tests/distribution/release-channel-workflows.test.ts packages/os/tests/release-script-security.test.ts`
expected red failure: no active-promotion queue selector exists, so the release script has no reusable guard against retry fan-out before dispatch.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-26 15:16:28 apply-patch: `.task/os/make-release-promotion-dispatch-idempotent/workpad.md`
- 2026-08-26 15:16:39 apply-patch: `packages/os/tests/release-script-promotion-correlation.test.ts`
- 2026-08-26 15:16:39 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-08-26 15:17:03 apply-patch: `packages/os/scripts/lib/release-promotion-correlation.ts`
- 2026-08-26 15:17:03 apply-patch: `packages/os/scripts/release.ts`
- 2026-08-26 15:17:03 apply-patch: `.github/workflows/consuelo-os-runtime-promote.yaml`

- 2026-08-26 15:18:27 apply-patch: `.task/os/make-release-promotion-dispatch-idempotent/workpad.md`
- 2026-08-26 15:21:21 apply-patch: `packages/os/tests/release-script-promotion-correlation.test.ts`
- 2026-08-26 15:21:22 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-08-26 15:21:51 apply-patch: `packages/os/scripts/lib/release-promotion-correlation.ts`
- 2026-08-26 15:21:51 apply-patch: `packages/os/scripts/release.ts`
- 2026-08-26 15:21:51 apply-patch: `.github/workflows/consuelo-os-runtime-promote.yaml`

## workspace-owned: files read

- none yet

- 2026-08-26 15:23:15 apply-patch: `.task/os/make-release-promotion-dispatch-idempotent/workpad.md`