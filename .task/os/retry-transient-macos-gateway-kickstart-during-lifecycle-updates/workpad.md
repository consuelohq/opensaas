# Retry transient macOS gateway kickstart during lifecycle updates

branch: `task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2090/retry-transient-macos-gateway-kickstart-during-lifecycle-updates
github pr: https://github.com/consuelohq/opensaas/pull/2090
started: 2026-08-15

## acceptance criteria

- [x] Transient macOS gateway sidecar kickstart exit-5/Input-output failures are retried with bounded delay.
- [x] Non-transient gateway kickstart failures remain fail-fast; exhausted transient retries fail with the gateway label and original launchctl detail.
- [x] Existing gateway bootout/bootstrap retry, primary reload behavior, and sidecar ordering remain unchanged.
- [x] Focused lifecycle/reload regression and touched-file static checks are green.
- [ ] Strict review/full verify, stream/main promotion, runtime publication, canary update, and route smoke are complete.

## plan

1. Reproduce the live failure with an injected transient gateway kickstart and prove RED.
2. Add bounded kickstart retry beside the existing gateway bootstrap retry.
3. Run focused GREEN, syntax/type/diff checks, strict review, and full verify.
4. Promote through stream/main, publish/promote canary, upgrade the local node, and smoke affected routes.

## current status

- Implementation is locally GREEN. The live failure shape is reproduced by the new pretest; focused lifecycle/reload tests pass 25/25 and OS syntax/type checks are green. Review/verify and publication remain.

## files changed

- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## workspace-owned: activity log

- 2026-08-15 20:08:30 fs.write: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`
- 2026-08-15 20:08:54 fs.write: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`
- 2026-08-15 20:09:56 fs.write: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`
- 2026-08-15 20:11:02 fs.write: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 20:09:13 `checkFiles`: passed — OK
- 2026-08-15 20:10:05 `audit`: failed — COMMAND_FAILED
- 2026-08-15 20:10:28 `review.run`: passed — OK
- 2026-08-15 20:10:49 `verify`: passed — OK

## key decisions

- Treat gateway kickstart exit 5 / `Bootstrap failed: 5` / `Input/output error` as the same bounded launchd teardown race already recognized for gateway bootstrap.
- Keep retries at four attempts with 200ms delay and preserve immediate failure for non-transient launchctl errors.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- v0.1.51 proved the previous primary LaunchAgent repair itself can restart the node; lifecycle activation still failed afterward at the gateway sidecar stage. The new RED test reproduced the exact context-free error from that single-attempt kickstart path.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## Acceptance criteria

- [ ] A transient macOS gateway sidecar `launchctl kickstart` failure (`exit 5`, `Bootstrap failed: 5`, or `Input/output error`) is retried with a bounded delay after bootstrap succeeds.
- [ ] Non-transient gateway kickstart failures still fail immediately.
- [ ] Exhausted transient gateway kickstart retries fail closed with the gateway label and original launchctl detail instead of a context-free raw provider error.
- [ ] Existing gateway bootout/bootstrap retry, loaded-job acceptance, primary reload behavior, and sidecar ordering remain unchanged.
- [ ] Focused lifecycle restart regression goes RED before production edits and GREEN after implementation; touched-file checks, strict review, and full verify pass.
- [ ] The fix is promoted through `stream/os` to `main`, a new runtime is published and promoted to canary, the local installation upgrades successfully, and affected local routes are smoked.

## Plan

1. Extend the existing macOS gateway lifecycle contract with a transient kickstart failure after successful bootstrap; prove RED.
2. Add a bounded kickstart retry loop beside the existing bootstrap retry, reusing the same launchd exit-5 classification and short delay.
3. Run focused GREEN plus syntax/type/diff checks, strict review, and full verify.
4. Push/promote through stream/main, publish/promote the new runtime to canary, retry local update, then smoke local routes.

## Test-first contract

behavior under test: after a macOS gateway sidecar bootout/bootstrap succeeds, lifecycle restart tolerates launchd's transient exit-5/Input-output race during `kickstart -k` by retrying a bounded number of times; non-transient errors and exhausted retries remain fail-closed with gateway context.
existing local pattern: `createReloadServiceController` already retries gateway bootstrap four times with a 200ms delay and classifies exit 5 / `Bootstrap failed: 5` / `Input/output error` as transient; `lifecycle-restart-contract.test.ts` has deterministic injected-runner coverage for gateway bootstrap retries and label-specific failure.
new or changed tests: add a service-controller regression where bootstrap succeeds, the first gateway kickstart returns exit 5 with `Bootstrap failed: 5: Input/output error`, and the second kickstart succeeds; assert two kickstart attempts and a retry delay. Add an exhausted-kickstart assertion only if needed to protect error context.
focused red command: `bun --cwd packages/os test tests/lifecycle-restart-contract.test.ts`.
expected red failure: the current controller performs exactly one gateway kickstart and propagates its raw stderr through `canonical reload adapter failed` with no gateway-specific retry/context.
no-test waiver: none.

## Runtime evidence leading to this task

- v0.1.51 contains the primary LaunchAgent bootstrap retry and was successfully published/promoted to canary, but local activation still rolled back with `failed to restart Consuelo services: canonical reload adapter failed: Bootstrap failed: 5: Input/output error`.
- The same v0.1.51 `consuelo-reload.js restart-now` was then run directly against the local node and completed healthy, proving the primary canonical reload adapter can restart successfully with the new retry.
- `lifecycle/service.ts` runs macOS gateway sidecars after that canonical reload. Gateway bootstrap has exit-5 retry/context, while the following gateway `kickstart -k` is single-attempt and uses `commandFailure`, exactly matching the context-free error shape seen during v0.1.51 activation.

- 2026-08-15 20:08:30 append: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`

- 2026-08-15 20:08:42 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`

## RED evidence

- Focused RED: `bun --cwd packages/os test tests/lifecycle-restart-contract.test.ts` failed exactly the two new kickstart contracts: 2 failed / 13 passed (trace `trc_8f64e3523803`).
- The first failure reproduced the live canary error shape byte-for-byte at the relevant boundary: `canonical reload adapter failed: Bootstrap failed: 5: Input/output error`, caused by the single gateway `kickstart` call in `service.ts`.
- The exhausted-retry contract also proved current errors omit the gateway label and perform only one kickstart attempt.

- 2026-08-15 20:08:54 append: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`

- 2026-08-15 20:09:05 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`

- 2026-08-15 20:09:49 apply-patch: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`

## GREEN evidence

- Focused lifecycle restart contract passed 15/15 after implementation (trace `trc_a2dc45016273`).
- Combined lifecycle restart + canonical reload regression passed 25/25 (trace `trc_680e287d50a7`).
- Touched-file `checkFiles` passed for `service.ts` and `lifecycle-restart-contract.test.ts` (trace `trc_90c92bbfb16a`).
- `bun run --cwd packages/os typecheck` passed (`workspace script syntax checks passed`, trace `trc_ea673d1046ed`).
- `git diff --check` passed cleanly (trace `trc_adad315fa8b0`).

- 2026-08-15 20:09:56 append: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`


## Pre-publish validation

- Strict review against `origin/stream/os` is clean: 0 task issues, 0 blockers, 0 related/pre-existing findings (trace `trc_b6e83bfcb158`). The only review note is a non-blocking generic lifecycle documentation opportunity; no public operator contract changed, so no docs edit is required for this internal launchd reliability repair.
- Full `verify --base origin/stream/os` passed with `publishValid: true`; review and DB guard are clean (trace `trc_dc6a51ac3bda`).
- Repository-wide `audit` still fails on large pre-existing script/docs/index drift unrelated to this two-file task (trace `trc_8c06c33d42d9`). Full verify remains publish-valid, and none of the audit findings are caused by this change.

- 2026-08-15 20:11:02 append: `.task/os/retry-transient-macos-gateway-kickstart-during-lifecycle-updates/workpad.md`
