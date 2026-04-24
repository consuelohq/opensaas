# fix queue call start audio ringing

branch: `task/dialer/fix-queue-call-start-audio-ringing`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/190
started: 2026-04-24

## acceptance criteria

- [x] start a fresh task from `stream/dialer` using `task-start`.
- [x] read `/Users/kokayi/Dev/opensaas/AGENTS.md` and `CODING-STANDARDS.md` before editing.
- [x] copy these acceptance criteria into `.task/workpad.md` before coding.
- [x] reproduce the current production issue with a fresh HAR: queue progresses, backend creates a group, but the user gets no audible sound and/or no visible/real ringing.
- [x] capture the `POST /api/v1/calls/parallel` response body or equivalent status object, including `groupId`, `conferenceName`, `profileId`, and `callSid` values. captured equivalent status body for existing production group; the post body was not available for the stale start because the blocked retry did not create a fresh group.
- [x] capture several `GET /api/v1/calls/parallel/:groupId` response bodies and determine whether calls ever move from `dialing` to `ringing`, `in-progress`, `completed`, `failed`, `busy`, or `no-answer`. group `pg_316ec7f32b6c` stayed `dialing` across captured polls.
- [x] determine whether Twilio status callbacks are reaching `/api/v1/calls/parallel/status-callback` and whether `/api/v1/calls/parallel/customer-twiml` is requested. railway filters showed no callback/twiml route activity for the captured group; the confirmed code fix here is the frontend retry guard that prevented a fresh post/retry.
- [x] determine whether the missing local sound is caused by `notificationSounds.ts`, browser autoplay/Web Audio state, `soundsEnabled`, missing user gesture linkage, or the queue path not calling the sound helper. confirmed the queue path was not reaching `playDialingStartedSound()` when `startParallelBatch()` returned early against stale recoil queue state.
- [x] determine whether the visible `Grant microphone access` state is related to the failure. `queueRunnerReady` is `queueUsesParallelDialing || deviceReady`, so mic permission is not the parallel auto-start blocker.
- [x] fix the confirmed cause only.
- [x] add focused tests for the fixed call-start/audio/ringing behavior.
- [ ] validate production after deploy: queue progression creates calls, status advances correctly, no unexpected 500s, and sound/ringing behavior is proven or explicitly measured.
- [ ] publish with `bun run task:push`, `bun run task:pr`, and `bun run task:finish`.

## plan

1. reproduce the production queue-start path using browser and railway scripts before changing code.
2. capture network bodies for parallel create and polling, plus console/page errors and railway callback/twiml evidence.
3. trace frontend queue/parallel dialer/audio/device readiness paths and backend parallel twiml/status callback paths.
4. patch only the confirmed root cause.
5. add focused tests at the narrowest useful layer.
6. run review/typecheck/focused tests, publish with task-publish, and verify production after deploy.

## production evidence

- prior handoff proved `POST /api/v1/calls/parallel` now returns 201 for a valid batch and creates group `pg_9588af6e91c9`.
- remaining reported failures are downstream of group creation: audible local sounds, real call ringing/status progression, twiml/status callbacks, or queue ui device state.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- `packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts`

## key decisions

- `startParallelBatch()` now returns `true` only after a parallel batch is actually posted and polling starts.
- the opportunity queue auto-start guard now clears itself when `startParallelBatch()` returns `false` or throws. this fixes the race where the first effect ran before recoil `activeQueue`/`queueItems` hydration reached `useParallelDialer`, returned early, and permanently blocked retries for the same item.
- microphone permission is not required for the server-side parallel batch start path; it remains required for browser device calling.

## notes for ko

- production is source of truth for this task.

## improvements noticed

- pending investigation.

## validation

- production repro: captured `GET /api/v1/calls/parallel/pg_316ec7f32b6c` bodies with two real call sids (`CA658e20f40ac5cb9808be49b17961137e`, `CA66d5b337d17dcfb2943fe76ce70f18e1`) stuck in `dialing` across repeated polls.
- production repro: after stop/continue, captured no `/api/v1/calls/parallel` post; only GraphQL `UpdateOneOpportunity(listStatus: ACTIVE)` and `/v1/voice/status`, proving the queue activation path could fail before batch creation and therefore before local sound.
- production queue probe: queue `15355bf2-b1d7-4ee6-a98a-c5de4b3c44ea` was `active`, parallel enabled, with one `calling` item and pending items behind it.
- tests: `yarn jest --runInBand --config=packages/twenty-front/jest.config.mjs useParallelDialer.test.ts` passed.
- tests: `yarn jest --runInBand --config=packages/twenty-front/jest.config.mjs useTwilioDevice.test.ts` passed.
- tests: `yarn jest --runInBand --config=packages/twenty-front/jest.config.mjs useParallelDialer.test.ts useTwilioDevice.test.ts` passed after formatting: 2 suites, 13 tests.
- review: `bun run review -- --base origin/task/dialer/fix-queue-call-start-audio-ringing --json --quiet` reported 0 issues in my changes after formatting; remaining failures are pre-existing stream issues/full-suite failures.
- typecheck: `yarn nx typecheck twenty-front --skip-nx-cache` failed in pre-existing `twenty-shared` relative date filter files, unrelated to this patch.

- 2026-04-24 21:08:26 write: `.task/workpad.md`