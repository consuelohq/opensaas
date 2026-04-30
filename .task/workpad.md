# fix parallel caller id repeat conflict

branch: `task/dialer/fix-parallel-caller-id-repeat-conflict`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/246
started: 2026-04-30

## acceptance criteria

- [ ]

## plan

1.

## files changed

-

## key decisions

-

## notes for ko

-

## improvements noticed

-

## errors i ran into

-

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## task brief from Apr 30 handoff

Objective: fix production dialer issue where the parallel dialer repeatedly posts to POST /api/v1/calls/parallel and receives 409 CALLER_ID_LOCKED while a list dialer is active.

Acceptance criteria:
- [ ] Prove deployed main/source and runtime path before editing.
- [ ] Confirm whether duplicate POST comes from frontend effect re-entry, queue identity churn, queue hydration reset, another call path, or backend lock lifecycle.
- [ ] Add focused frontend coverage if duplicate autostart after blocked result is root cause.
- [ ] Add focused backend coverage if lock release/lifecycle or stale Redis behavior is root cause.
- [ ] Verify no start sound, no polling loop, and no repeated same-item POST after caller-id-lock 409.
- [ ] Verify locks release on all intended terminal parallel outcomes if lifecycle is changed.
- [ ] Run focused checks plus workspace review or document blocker.
- [ ] Publish through task.push, task.pr, and task.finish.

Initial plan:
1. Pull Railway runtime truth and compare deployed main with stream/dialer implementation.
2. Use decision engine to choose read targets and avoid guessing.
3. Inspect frontend autostart path and backend caller-id lock lifecycle.
4. Implement the simplest correct fix with tests.
5. Verify, publish, and record any production/browser limitation.

Initial issue encountered:
- workspace stream.sync for dialer hit only .task metadata conflicts in .task/current.json, .task/evidence-log.json, .task/read-log.json, and .task/workpad.md. Product-code conflicts were absent, so task work proceeded from stream/dialer source sha 2393bfd3.

- 2026-04-30 22:19:39 append: `.task/workpad.md`

## implementation notes

Root cause fixed:
- Parallel status callbacks released loser caller-id locks when a group connected and all locks when a no-winner group completed, but the winning caller-id lock stayed held after the winner call ended because the group status remained connected. That left the winner number locked until the 5-minute caller-id TTL, causing later parallel starts to receive CALLER_ID_LOCKED.

Code changes:
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts now releases all caller-id locks when the group is completed or when the winning call receives a terminal callback.
- The connected/non-terminal path still releases only loser numbers so the active winner call keeps its caller-id lock while live.
- Added getGroupFromNumbers helper to release every caller-id used by the parallel group.

Test coverage added:
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts verifies loser-only release while the winner is still active.
- Same spec verifies all caller-id locks are released when the winner receives a completed callback.

Verification attempts:
- Railway status checked: opensaas was deployed from main commit bd06d88b, build success.
- Railway targeted filters for parallel dial blocked / caller id lock returned no fresh matching entries in the current window.
- Confirmed deployed bd06d88b already had the prior frontend blocked-result guard and delayed start sound behavior.
- Focused bun test failed because the worktree test runner could not resolve @nestjs/common.
- Focused npx jest with packages/twenty-server/jest.config.mjs failed with the same @nestjs/common module resolution issue.
- Plain yarn jest failed earlier because it did not load the TypeScript/Jest package config and could not parse import type.
- workspace review.run timed out twice without returning a structured result.
- npx nx typecheck twenty-server also timed out through the wrapper.
- git diff --check initially found trailing whitespace in generated .task/workpad.md placeholders; those were stripped.

Issues faced:
- stream.sync hit .task metadata conflicts only; product code had no sync conflict.
- The first patch command failed because shell quoting stripped TypeScript string quotes before Python ran. Retried using base64-encoded patch scripts.
- npx/yarn attempts created an untracked node_modules directory in the task worktree; it was removed before publish.

- 2026-04-30 22:39:24 append: `.task/workpad.md`