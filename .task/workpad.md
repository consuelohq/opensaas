# fix parallel dial create 500

branch: `task/dialer/fix-parallel-dial-create-500`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/172
started: 2026-04-24

## acceptance criteria

- [x] start from `stream/dialer` with `bun run task:start -- --area dialer --title "fix parallel dial create 500" --start-from stream --json`.
- [x] read `AGENTS.md` and `CODING-STANDARDS.md` in the new task worktree before editing.
- [x] fill out `.task/workpad.md` before coding with this checklist, the current railway evidence, and the intended first fix.
- [x] re-run railway truth commands before code changes: `bun run railway:logs -- --errors`, `bun run railway:logs -- --grep "twilio OR queue"`, `bun run railway:logs -- --grep "ParallelService OR PARALLEL_DIAL_FAILED OR Twilio not configured OR CALLER_ID_LOCKED OR initiateGroup"`, `bun run railway:logs -- --status`, and twilio env checks.
- [ ] confirm the deployed frontend is posting to `/api/v1/calls/parallel`, and capture status code, content type, and response body for the failed request.
- [ ] confirm railway shows `ParallelService` receiving `queueId` and `workspaceId` for the failed request.
- [x] add stage-specific safe error logging inside `ParallelService.initiateParallelDial()` so railway prints error `name`, `message`, `stack`, and failing stage without leaking tokens or customer phone numbers.
- [x] instrument the likely stages separately: strategy resolution, `legacyDialerService.getDialer()`, `dialer.listNumbers()`, caller-id resolution, caller-id lock acquisition, and `dialer.parallel.initiateGroup()`.
- [ ] deploy/publish the logging-only diagnostic change if the root exception is still hidden locally.
- [ ] reproduce the failed start-call flow once after diagnostic logging lands, then pull railway logs again and copy the root exception into the workpad.
- [ ] fix the concrete create-group failure revealed by logs. candidate areas: nest `LegacyDialerService` credential/workspace handling, twilio number availability, `API_BASE_URL`, callback URL construction, missing DB relations, or caller-id locks.
- [x] keep the frontend on `/api/v1/calls/parallel`; do not revert to legacy `/v1/calls/parallel` unless railway proves the nest route cannot own this flow.
- [x] preserve authenticated workspace/user context through `ParallelController` into `ParallelService`.
- [x] confirm twilio env vars are set in railway and do not print their values.
- [ ] confirm a successful create response includes `groupId`, `conferenceName`, `profileId`, and at least one call object with a real twilio `callSid`.
- [ ] confirm the browser receives json from `/api/v1/calls/parallel`, not html or an unrelated catch-all response.
- [ ] confirm the frontend plays the dialing-start sound and stores `parallelGroupId` / `parallelActiveCalls` after a successful create response.
- [ ] confirm group polling `/api/v1/calls/parallel/:groupId` returns `calls`, `winnerSid`, and `winner` when applicable.
- [ ] confirm terminate `/api/v1/calls/parallel/:groupId/terminate` returns json and releases caller-id locks for the group.
- [ ] confirm twilio callback urls point at `/api/v1/calls/parallel/status-callback` and `/api/v1/calls/parallel/customer-twiml` with the correct public base url.
- [x] add or update focused tests around the revealed failure path in `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`.
- [ ] add/update frontend tests only if endpoint handling or failure behavior changes.
- [x] run the strongest available targeted checks. at minimum attempt the backend parallel service spec and the frontend endpoint helper spec; document dependency/bootstrap blockers exactly.
- [ ] re-check railway after the fix: no `ParallelService parallel dial failed` for the reproduced call, and a real `callSid` appears in response/log evidence.
- [ ] only after create succeeds, resume queue/list drift investigation for list 18 and duplicate backend queues.
- [ ] publish through `bun run task:push`, `bun run task:pr`, and `bun run task:finish`; use explicit `--files` if `task:push --changed` mis-parses `.task/current.json`.

## plan

1. collect fresh railway truth with this checkout's supported `--grep` flag, since `--filter` is not accepted by `packages/workspace/scripts/railway-logs.js` here.
2. inspect the nest parallel controller/service and related spec to understand the current create path and logger conventions.
3. add safe stage-specific error logging around each create step in `ParallelService.initiateParallelDial()`.
4. add focused backend spec coverage proving the logger emits stage/name/message/stack metadata without phone-number lists when a create stage fails.
5. run targeted checks, then publish via `task:push -> task:pr -> task:finish`.
6. if railway logs after diagnostic publish reveal the concrete root failure inside this same loop, fix that failure and republish before finishing.

## current railway evidence

- `bun run railway:logs -- --errors` ran before coding. it reported `service: opensaas`, `boot: crashed or failing`, `errors: 5`, but the returned entries were cron registration logs rather than the root parallel exception.
- this task worktree's railway helper rejects `--filter`; use `--grep` in this checkout.
- `bun run railway:logs -- --grep "twilio OR queue"` returned no matching errors/warnings in the current log window.
- `bun run railway:logs -- --grep "ParallelService OR PARALLEL_DIAL_FAILED OR Twilio not configured OR CALLER_ID_LOCKED OR initiateGroup"` returned no matching errors/warnings in the current log window.
- `bun run railway:logs -- --status` reported `last build: failed`, with healthcheck failing twice and later succeeding.
- `bun run railway:logs -- --env TWILIO_ACCOUNT_SID` returned `set`; `bun run railway:logs -- --env TWILIO_AUTH_TOKEN` returned `set`. no env values were printed.
- prior handoff evidence says railway already showed `ParallelService` receiving `queueId` and `workspaceId`, then logging `parallel dial failed`, while twilio sid/token env vars are set.

## intended first fix

add stage-specific safe logging to `ParallelService.initiateParallelDial()` so the next railway reproduction shows exactly which stage failed and the thrown error `name`, `message`, and `stack`, while only logging safe metadata: queue id, workspace id, profile id, customer count, from-number count, and no twilio credentials or customer phone numbers.

## files changed

- `.task/workpad.md`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

## key decisions

- using `--grep` instead of `--filter` because the local railway helper in this task worktree errors on `--filter`.
- first change should be observability, not speculative functional changes, because production currently hides the actual exception before twilio creates a call sid.

## notes for ko

- initial task draft pr: https://github.com/consuelohq/opensaas/pull/172
- added diagnostic logging only; the current railway window did not include the root exception, so this patch should expose the failing create stage after deploy/reproduction.
- validation attempted:
  - `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` failed before tests because `@swc/jest` is unavailable.
  - `npx jest packages/twenty-front/src/modules/dialer/utils/__tests__/parallel-dialer-endpoint.test.ts --runInBand` failed before tests because the test runner could not parse ts/esm imports without project config.
  - `npx nx typecheck twenty-server` failed because nx modules are not installed in this disposable worktree.
  - `bun run review` failed because this checkout has no `review` script.
  - `git diff --check` passed.

## improvements noticed

- the handoff and current helper disagree on railway log flag spelling (`--filter` vs `--grep`). the script should probably accept both aliases to avoid wasting task time.

## errors i ran into

- `bun run railway:logs -- --filter "twilio OR queue"` failed with `unknown flag: --filter`; rerunning with `--grep`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-04-24 10:35:43 write: `/tmp/fs-test-write.txt`
- 2026-04-24 10:35:43 write: `/tmp/fs-test-write.txt`
- 2026-04-24 10:35:43 append: `/tmp/fs-test-write.txt`
- 2026-04-24 10:35:43 write: `/tmp/fs-test-inline.txt`
- 2026-04-24 10:35:43 write: `/tmp/fs-test-deep/nested/file.txt`
- 2026-04-24 10:35:59 patch lines 3-5: `/tmp/fs-test-patch.txt`
- 2026-04-24 10:35:59 patch lines 7-7: `/tmp/fs-test-patch.txt`