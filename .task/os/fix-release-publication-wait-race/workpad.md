# fix release publication wait race

branch: `task/os/fix-release-publication-wait-race`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2217/fix-release-publication-wait-race
github pr: https://github.com/consuelohq/opensaas/pull/2217
started: 2026-08-26

## acceptance criteria

- [x] Reproduce the release-tool failure mode where an exact merged-SHA runtime publication is reported as cancelled even though an exact-SHA publication run is still pending or a replacement exact-SHA run exists.
- [x] Make the release workflow tolerate stale/cancelled exact-SHA publication runs by selecting or re-resolving the viable exact-SHA run without ever accepting a different commit.
- [x] Preserve fail-closed behavior for genuinely failed runtime publications and never promote/update from a mismatched SHA or bundle.
- [x] Add focused regression coverage before production edits, then pass release-tool tests, strict review, and full verify.
- [ ] Publish the fix through the normal OS task -> stream workflow after the current canary release is completed safely.

## plan

1. Reproduce the race with a focused adapter-level test around cancelled/stale exact-SHA publication runs.
2. Adjust release orchestration/adapter selection so cancelled stale runs trigger bounded exact-SHA re-resolution while hard failures still fail closed.
3. Run focused release tests, inspect the diff, review, verify, and publish the repair.

## current status

- Repair implementation and validation are complete. The selector now ignores stale cancelled exact-SHA runs while preferring successful or active exact-SHA publication attempts, and the orchestrator re-resolves once when an active exact-SHA run becomes cancelled while being watched. Genuine failures remain terminal. The live release for PR #2195 continues independently on exact merge SHA `e3b56c69831e6568147f0429ff046c623d6cb6f5`.

## files changed

- `packages/os/scripts/lib/release-orchestrator.ts` — exact-SHA publication candidate selection plus one bounded cancellation re-resolution.
- `packages/os/scripts/release.ts` — uses the candidate selector while polling GitHub workflow runs instead of accepting a stale cancelled run.
- `packages/os/tests/release-orchestrator.test.ts` — cancelled/stale replacement and genuine-failure regressions.
- task-scoped `.task/os/fix-release-publication-wait-race/**` metadata.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 15:02:19 `review.run`: passed — OK
- 2026-08-26 15:02:31 `verify`: passed — OK

## key decisions

- Exact commit identity remains non-negotiable: recovery may re-resolve only publication runs whose `headSha` exactly equals the merged main SHA.
- A stale cancelled run is recoverable only when a viable exact-SHA run exists or appears within the existing bounded wait. Genuine failure conclusions remain terminal.

## notes for ko

- Root cause was a release race, not the runtime bundle itself: the release tool treated the first exact-SHA cancelled workflow attempt as authoritative even when GitHub had/started another viable workflow attempt for the exact same merged commit.
- Recovery remains exact-SHA only. The repair cannot hop to a later main commit or different bundle just because it is newer.

## improvements noticed

- none yet

## issues and recovery

- Canonical `session.start({ kind: "task" })` still receives the outer facade timeout inside constructor input and rejected it (`trc_e69ea82b7232`); used the documented `task.start` compatibility alias to create `tsk_5e55668973f7`.

## validation evidence

- Focused RED: `release-orchestrator.test.ts` failed because `selectRuntimePublishCandidate` did not exist (`trc_2af427c7bb80`).
- Focused GREEN: release orchestrator/tool-surface/security tests passed 17/17 with 42 assertions (`trc_8c371d7a82ad`).
- Strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_159addbb9968`).
- Full verify: `passed: true`, `publishValid: true`, DB gate clean (`trc_f838ddeb6f0c`).

## Test-first contract

behavior under test: when the first exact-merged-SHA runtime publication run is cancelled/stale but a later exact-SHA run is queued/in-progress/successful, `release` must follow the viable exact-SHA publication instead of failing early; a genuinely failed exact-SHA publication with no viable replacement must still fail closed.
existing local pattern: `packages/os/tests/release-orchestrator.test.ts` drives `orchestrateRelease` through a fake `ReleaseAdapter`; `packages/os/scripts/release.ts` owns GitHub run discovery and `packages/os/scripts/lib/release-orchestrator.ts` owns terminal publication handling.
new or changed tests: add a regression that returns a cancelled publication first and a viable exact-SHA replacement on re-resolution, plus a hard-failure guard if needed.
focused red command: `bun test packages/os/tests/release-orchestrator.test.ts`
expected red failure: the current orchestrator immediately throws on a completed cancelled publication and never re-resolves the exact-SHA publication.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet

- 2026-08-26 15:00:12 apply-patch: `.task/os/fix-release-publication-wait-race/workpad.md`
- 2026-08-26 15:00:47 apply-patch: `packages/os/tests/release-orchestrator.test.ts`
- 2026-08-26 15:01:15 apply-patch: `packages/os/tests/release-orchestrator.test.ts`
- 2026-08-26 15:01:26 apply-patch: `packages/os/scripts/lib/release-orchestrator.ts`
- 2026-08-26 15:01:37 apply-patch: `packages/os/scripts/release.ts`

- 2026-08-26 15:02:54 apply-patch: `.task/os/fix-release-publication-wait-race/workpad.md`