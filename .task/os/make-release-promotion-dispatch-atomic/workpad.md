# make release promotion dispatch atomic

branch: `task/os/make-release-promotion-dispatch-atomic`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2226/make-release-promotion-dispatch-atomic
github pr: https://github.com/consuelohq/opensaas/pull/2226
started: 2026-08-26

## acceptance criteria

- [x] Concurrent local `release` processes cannot both pass the protected-promotion queue check and dispatch before the first dispatch becomes observable.
- [x] The atomic section covers signed target re-check, active-run re-check, workflow dispatch, and bounded observation of the newly created run before releasing the lock.
- [x] A crashed/stale local release process cannot permanently wedge future releases; reuse the existing owner-aware node resource lock and its stale-owner recovery.
- [x] GitHub's protected promotion workflow, approval/signing environments, global server-side concurrency group, and exact bundle/source-commit verification remain unchanged.
- [x] Focused release regressions pass, strict review is clean, and full verify is publish-valid before merging into `stream/os`.

## plan

1. Add a focused concurrent lock regression before production edits.
2. Reuse the existing `node-resource-lock` primitive with a canonical lock under the Consuelo node runs directory rather than inventing another lock protocol.
3. Hold that local lock through queue/target checks, dispatch, and bounded dispatch-visibility polling; release it before the long protected workflow execution.
4. Run focused release tests, strict review, full verify, then publish to `stream/os` and re-check PR #2219.

## current status

- Implementation and validation are complete. `release` now serializes the signed-target check, active protected-promotion check, workflow dispatch, and dispatch-visibility barrier under one canonical node-scoped lock. The lock is released before the long protected workflow executes. Existing GitHub server-side concurrency, approvals/signing, and exact bundle/source-commit verification remain unchanged.

## files changed

- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts` — canonical release-promotion lock backed by the existing owner-aware node resource lock.
- `packages/os/scripts/release.ts` — atomic queue-check/dispatch/visibility critical section.
- `packages/os/tests/release-promotion-dispatch-lock.test.ts` — canonical-path and concurrent serialization regression.
- `packages/workspace/test-selection.rules.json` and generated registry — keep the new release helper/test inside the focused exclusive release safety suite instead of falling into unrelated package-wide OS tests.

## workspace-owned: files changed

- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- `packages/os/tests/release-promotion-dispatch-lock.test.ts`

## workspace-owned: activity log

- 2026-08-26 18:10:05 fs.write: `packages/os/tests/release-promotion-dispatch-lock.test.ts`
- 2026-08-26 18:10:38 fs.write: `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`

## workspace-owned: validation evidence

- 2026-08-26 18:11:16 `review.run`: passed — OK
- 2026-08-26 18:11:38 `review.run`: passed — OK
- 2026-08-26 18:12:22 `verify`: failed — COMMAND_FAILED
- 2026-08-26 18:14:30 `verify`: passed — OK
- 2026-08-26 18:14:40 `review.run`: passed — OK

## key decisions

- The local Consuelo node is the operator serialization boundary for the top-level `release` tool. GitHub workflow concurrency remains the cross-host safety boundary and signed target state remains authoritative.
- Do not change the protected workflow file or require the special GitHub `workflow` OAuth scope. The lock is runtime-local state under the canonical Consuelo home, not repository state.
- Releasing the local lock immediately after `gh workflow run` is insufficient because GitHub run-list visibility is eventually consistent. The lock stays held until a post-baseline promotion run is observable (or the exact target pointer is already visible), bounded by a short visibility timeout.

## notes for ko

- This closes the fresh Codex P2 on PR #2219 without changing the protected GitHub workflow or requiring additional GitHub OAuth scope.

## improvements noticed

- none yet

## issues and recovery

- This task uses `task.start` because the canonical `session.start` constructor remains broken by facade-injected `timeout`; that compatibility fallback was already established earlier in this release stream.
- First full verify failed because the new helper/test were not yet covered by the exclusive `os-release-surface-freshness` test-selection rule, so auto-selection also ran the historically failing package-wide OS suite. The focused rule was extended and its generated registry refreshed; the subsequent full verify passed.

## validation evidence

- Focused RED: new release-promotion dispatch lock module absent (`trc_dd20c08c6072`).
- Focused GREEN: 31/31 relevant release/orchestrator/promotion/security/resource-lock tests passed, 64 assertions (`trc_79bb7eb3d841`).
- Initial strict review caught one local async error-handling rule violation (`trc_2733d6030ebd`); fixed with scoped release-step error wrapping.
- Final strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_315b2e91b0f5`).
- Initial verify diagnosed unrelated package-wide OS test selection caused by uncovered new release files (`trc_a51fd4914248`, detailed `trc_2ceb1d77d0f1`).
- Final full verify: passed, publish-valid, DB gate clean (`trc_5b0d60b633d3`).

## Test-first contract

behavior under test: two concurrent local release dispatch critical sections targeting the same protected promotion must execute serially, and the second cannot enter until the first has completed its dispatch-visibility barrier.
existing local pattern: `packages/os/scripts/lib/node-resource-lock.ts` provides an atomic `wx` owner record with live-PID protection and stale-owner recovery; `node-resource-lock.test.ts` proves wait/recovery behavior; `release.ts` owns protected promotion dispatch.
new or changed tests: add `release-promotion-dispatch-lock.test.ts` that starts two critical sections against the same canonical lock and proves maximum concurrent entries is one plus deterministic lock-path placement under `node/runs`.
focused red command: `bun test packages/os/tests/release-promotion-dispatch-lock.test.ts`
expected red failure: the release-specific lock helper does not exist yet.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/node-resource-lock.ts`
- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/node-resource-lock.test.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`

- 2026-08-26 18:15:03 apply-patch: `.task/os/make-release-promotion-dispatch-atomic/workpad.md`

- 2026-08-26 18:15:09 apply-patch: `.task/os/make-release-promotion-dispatch-atomic/workpad.md`