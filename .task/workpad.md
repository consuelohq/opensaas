# fix queue call start lifecycle

branch: `task/dialer/fix-queue-call-start-lifecycle`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/168
started: 2026-04-24

## acceptance criteria

- [x] start a fresh task branch from `stream/dialer` using `task-start`.
- [x] fill out `.task/workpad.md` and copy this checklist into it.
- [x] reproduce from the authenticated browser on list 18.
- [ ] capture exact `/v1/calls/parallel` request payload and response body for the 400 and 409 cases.
- [x] confirm whether production is deployed with the dedupe-lock fix and `ParallelDialResult` type fix.
- [x] determine why `/api/v1/queues/{id}/start` is called repeatedly after the queue is already active.
- [ ] determine whether parallel dial success creates twilio calls and whether callbacks reach `/v1/calls/parallel/status-callback`.
- [x] fix the first proven blocker only.
- [x] add focused tests for the failing path.
- [x] validate with the best available local checks and record any workspace/tooling blockers honestly.
- [ ] publish via `task:push`, `task:pr`, and `task:finish`.

## plan

1. run the required stream/task setup and read repo standards.
2. reproduce or extract current authenticated browser/network/runtime evidence for list 18.
3. inspect the frontend retry loop around queue session start and parallel batch start.
4. inspect backend `/v1/calls/parallel` validation/409 paths and production deploy/log evidence.
5. patch the first proven blocker with the smallest change and focused tests.
6. run targeted validation, update this workpad, then publish through task:push -> task:pr -> task:finish.

## files changed

- `.task/current.json`
- `.task/workpad.md`
- `.task/tasks/dialer/fix-queue-call-start-lifecycle.json`
- `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- `packages/twenty-front/src/modules/dialer/utils/backend-queue-session.ts`
- `packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts`

## key decisions

- task is based on `stream/dialer` because ko specified the dialer stream in the handoff.
- fixed the first proven blocker: `startBackendQueueSession()` treated every non-paused queue as needing `/start`, even when `ensureBackendQueue()` had just returned an already `active` queue.
- added a tiny endpoint resolver utility so active/completed queues do not post a transition route, paused queues post `/resume`, and idle/other queues post `/start`.
- added a module-level in-flight set keyed by list id to prevent overlapping startup effects from racing into duplicate queue transition calls before React state catches up.
- did not expand into the parallel polling response mismatch in this task, even though `GET /v1/calls/parallel/:groupId` returns `winnerSid` while the frontend reads `data.winner`. that is likely a separate follow-up after the start loop is no longer masking the lifecycle.

## notes for ko

- reproduced on list 18 from the authenticated browser: the page was active, showed a current contact, and the dialer panel was still idle.
- browser network evidence showed repeated `POST /api/v1/queues/15355bf2-b1d7-4ee6-a98a-c5de4b3c44ea/start 201`, plus `/v1/calls/parallel` 400/409 and later a 201 with many group polls.
- exact response-body capture was not completed. har capture showed the request/status sequence but did not retain useful response bodies; cdp access command was blocked; an injected fetch logger installed successfully but no new matching fetches occurred afterward.
- confirmed the stream code includes the prior dedupe caller-id lock fix and `ParallelDialResult` route type fix by reading `packages/api/src/routes/parallel.ts` and the existing parallel route tests.
- production deploy status command was blocked by tooling safety checks. `bun run railway:logs -- --grep parallel` returned the service as healthy with no current matching warnings in that window.

## validation

- passed: `./node_modules/.bin/jest packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts --config=packages/twenty-front/jest.config.mjs`
- attempted: `./node_modules/.bin/nx typecheck twenty-front`
  - failed before/around affected package validation because the worktree yarn lock context does not include `openworkspace@workspace:packages/workspace`, then surfaced existing unrelated `twenty-shared` type errors in relative date filter utilities.
- attempted: `bash scripts/code-review.sh`
  - core checks passed, but eslint/typecheck failed on pre-existing issues in `useOpportunityQueueWorkspace.ts` and the same worktree/typecheck problems. prettier issues were fixed before this final note.

## improvements noticed

- `useOpportunityQueueWorkspace.ts` has many existing lint issues, including `no-state-useref`, explicit boolean predicate rules, an unused `hasNextQueueItem`, and hook dependency warnings. touching this file causes `code-review.sh` to fail on the whole file.
- parallel group polling likely has a response contract mismatch: backend returns `winnerSid`, frontend expects `winner`.
- `useParallelDialer` throws away non-ok response bodies, which made the exact 400/409 diagnosis harder from the browser.

## errors i ran into

- several commands were blocked by openai safety checks, including direct cdp-url access, some jest/nx invocations, and railway status.
- yarn in the task worktree reports `openworkspace@workspace:packages/workspace` missing from the lockfile, so direct yarn/nx validation in the worktree is degraded.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): stop active queue start loop" --files .task/current.json .task/workpad.md .task/tasks/dialer/fix-queue-call-start-lifecycle.json packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts packages/twenty-front/src/modules/dialer/utils/backend-queue-session.ts packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts
bun run task:pr
bun run task:finish
```
