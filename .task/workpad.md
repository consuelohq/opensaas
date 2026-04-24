# queue dialing real call lifecycle

branch: `task/dialer/queue-dialing-real-call-lifecycle`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/164
started: 2026-04-24

## acceptance criteria

- [x] reproduce queue dialing from production browser with network evidence
- [x] tail/query railway logs during reproduction and correlate first failing call path
- [x] determine actual runtime queue mode from network evidence instead of assuming browser mode
- [x] implement the smallest code fix that removes the proven blocker
- [x] add regression coverage for the proven blocker
- [x] run focused test/format checks where repo tooling allows
- [ ] verify deployed production after merge/deploy

## runtime evidence

record: `https://consuelo.consuelohq.com/object/opportunity/8c31646a-4055-4ee3-975d-ddd6c2dfb263`
queue: `15355bf2-b1d7-4ee6-a98a-c5de4b3c44ea`

browser before click showed list 18 completed with `continue queue`, `now calling` violet medrano, and `up next` hernan mendoza.

browser after click changed to active controls: `pause`, `stop`, `skip`, `end`.

network source of truth after click:

- `GET /v1/phone-numbers` 200
- `GET /v1/voice/status` 200
- `GET /v1/voice/token` 200
- twilio sdk sound assets loaded
- repeated `POST /api/v1/queues/15355bf2-b1d7-4ee6-a98a-c5de4b3c44ea/start` 201
- `POST /v1/calls/parallel` 409
- no `/v1/voice/preflight` in this runtime path

railway sample around reproduction showed token generation and did not show fresh missing-relation warnings in the filtered recent sample.

## root cause

`POST /v1/calls/parallel` only returned 409 from its caller-id lock branch. The route resolved one outbound `fromNumber` per customer leg and then acquired a lock for every leg using synthetic call ids like `parallel-0`, `parallel-1`.

Caller-id locks are keyed by phone number. If local presence falls back multiple legs to the same caller id, the second lock attempt conflicts with the first lock from the same batch before any twilio calls are created.

## fix

`packages/api/src/routes/parallel.ts`

- dedupe resolved caller ids before lock acquisition
- acquire one lock per unique `fromNumber` for a parallel batch
- preserve 409 behavior for genuinely busy distinct caller ids
- release already-acquired locks when another lock fails
- release acquired locks if `dialer.parallel.initiateGroup` throws before callbacks can clean up

`packages/api/src/routes/__tests__/parallel.spec.ts`

- added coverage that duplicate resolved caller ids lock once and still initiate the group
- added cleanup coverage when twilio group creation fails
- added coverage that a true distinct caller-id conflict still returns 409 and releases earlier locks

## validation

passed:

```bash
yarn jest packages/api/src/routes/__tests__/parallel.spec.ts -c packages/api/jest.config.mjs --runInBand
# 3 passed
```

passed:

```bash
yarn prettier --check packages/api/src/routes/parallel.ts packages/api/src/routes/__tests__/parallel.spec.ts
```

passed:

```bash
git diff --check
```

blocked by existing repo/tooling drift:

```bash
yarn nx run @consuelo/api:typecheck
```

The typecheck failure is not introduced by this patch. It currently fails across api on unresolved workspace imports such as `@consuelo/logger`, `@consuelo/dialer`, `@consuelo/agent`, plus existing strict-null errors in unrelated files. Also, this worktree's yarn lock still records `@consuelo/workspace@workspace:packages/workspace` while `packages/workspace/package.json` is named `openworkspace`, so yarn commands require a local install that produces unrelated lockfile churn. Those artifacts were reverted before publishing.

## files changed

- `.task/current.json`
- `.task/tasks/dialer/queue-dialing-real-call-lifecycle.json`
- `.task/workpad.md`
- `packages/api/src/routes/parallel.ts`
- `packages/api/src/routes/__tests__/parallel.spec.ts`

## follow-up after deploy

Reproduce the same list again and confirm `POST /v1/calls/parallel` returns 201 and creates a parallel group. Then confirm twilio callbacks advance the group lifecycle and queue state.
