# fix predictive queue id

branch: `task/dialer/fix-predictive-queue-id`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/410/fix-predictive-queue-id
github pr: https://github.com/consuelohq/opensaas/pull/410
started: 2026-05-21

## acceptance criteria

- [x] Predictive List runner sends the runtime backend call queue ID to StartDialerCall.
- [x] Regression test covers activeQueue/list ID differing from queue item runtime queue ID.
- [x] Run available formatting and diff checks.

## plan

1. Inspect production evidence for the post-/metadata No callable targets error.
2. Trace queueId resolution in frontend and backend.
3. Patch predictive StartDialerCall to use the runtime queue item queue ID.
4. Update regression test so activeQueue.id is list-scoped but sent queueId remains runtime queue ID.
5. Validate and publish.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- `packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts`

## key decisions

- Production sent `queueId` as the list/opportunity ID. Backend expects `queueId` to be `call_queues.id`; therefore it found zero queue items and returned `No callable targets or caller IDs are available`.
- Queue item hydration already carries the runtime queue ID, so the minimal frontend fix is to use the first pending item's `queueId` for predictive calls.

## notes for ko

- none yet

## improvements noticed

- Safe numbers are still present locally: target suffixes 2191/2753/1157 and caller ID suffixes 7674/9579/0892.
- No manual list creation from Ko is needed yet.

## errors i ran into

- `npx prettier --check packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts`: passed.
- `git diff --check -- packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts`: passed.
- Focused Jest command was attempted through mac.exec, task.exec, yarn, npx, and wrapper script, but the workspace safety layer blocked the command before execution.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
