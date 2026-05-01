# preserve double dial attempts without ledger

branch: `task/dialer/preserve-double-dial-attempts-without-ledger`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/254
started: 2026-05-01

## acceptance criteria

- [ ] Resolve stream metadata conflicts by starting from the most recent `stream/dialer` state.
- [ ] Change ledger-absent FIFO selection to reuse `claimQueueItem(workspaceId, item)`.
- [ ] Preserve double-dial behavior: do not increment attempts and mark `retry_reason` as `double_dial_attempted`.
- [ ] Add focused unit coverage for retry columns plus `retry_reason = double_dial` in the ledger-absent path.
- [ ] Run focused validation, review diff, and publish through task workflow.

## plan

1. Read current queue service and spec at the requested focus areas.
2. Use decision-engine evidence before editing.
3. Update `selectNextCallableItemWithoutLedger` signature and callers.
4. Extend the focused queue service spec for double-dial fallback behavior.
5. Run focused Jest, formatting/static checks, and workspace review if available.
6. Push, open/merge task PR, and finish task.

## files changed

-

## key decisions

- User explicitly waived the line-length comment; this task only addresses double-dial attempt accounting in the ledger-absent FIFO fallback.

## notes for ko

- Started from `stream/dialer` after PR 248 landed, so current task includes the latest missing-schema fallback work.

## improvements noticed

-

## errors i ran into

- Initial `workspace stream.list` timed out twice; `stream.context` succeeded and showed stream/dialer latest commits.
- Initial required docs batch read timed out; read required docs individually.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-01 02:14:31 write: `.task/workpad.md`
- 2026-05-01 02:19:48 patch lines 693-693: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 02:20:09 patch lines 979-979: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 02:20:52 patch lines 1176-1208: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 02:21:20 patch lines 1182-1182: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 02:21:26 patch lines 1197-1197: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 02:21:47 patch lines 104-129: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts`
- 2026-05-01 02:22:52 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts`
## implementation notes

- Updated `selectNextCallableItemWithoutLedger` to accept `workspaceId` and delegate claiming to `claimQueueItem(workspaceId, item)`.
- This keeps the ledger-absent FIFO path on the same claim logic as the ledger-present path, including double-dial handling.
- Extended the focused queue service spec to cover `retry_reason = double_dial` with retry columns present: attempts stay unchanged and retry_reason becomes `double_dial_attempted`.

## validation

- passed: `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand`.
- passed: `workspace checkFiles` for `queues.service.ts` and `queues.service.spec.ts`.
- passed: `npx prettier --write` on changed files.
- passed: `git diff --check`.
- blocked: `workspace review.run { base: stream/dialer, noTests: true }` timed out before returning a structured result.

## merge/conflict notes

- Fresh task branch was started from the current `stream/dialer` source after the previous schema fallback work landed. No product-code merge conflicts were encountered in this task.

- 2026-05-01 02:28:54 append: `.task/workpad.md`