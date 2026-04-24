# fix queue state drift call start

branch: `task/dialer/fix-queue-state-drift-call-start`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/170
started: 2026-04-24

## acceptance criteria

- [x] start from `stream/dialer` with `task:start` and fill out `.task/workpad.md` before coding.
- [x] ingest ko's browser logs if provided and cross-check them against fresh browser/network evidence.
- [x] prove which server owns production dialer routes: nest `twenty-server` consuelo-api controllers, legacy `packages/api`, or both.
- [x] prove the route contract end-to-end for parallel dialing: frontend request path, backend mounted path, status code, content type, and response body.
- [x] fix the parallel route path mismatch so the frontend hits the real nest controller, not the spa/static catch-all. current repo evidence: frontend calls `/v1/calls/parallel`; nest controller is mounted at `/api/v1/calls/parallel`.
- [x] after path alignment, prove `post /calls/parallel` reaches `ParallelController.initiateParallelDial()` with authenticated workspace context.
- [x] replace or bridge the `ParallelService.initiateParallelDial()` `NotImplementedException` so a real parallel dial group can be created, or explicitly route the frontend to the legacy implementation if that is the chosen migration path.
- [x] cover all parallel endpoints in the chosen route namespace: create group, validate, group status polling, terminate, twilio status callback, and customer twiml.
- [x] add focused backend/controller tests that fail on the old path mismatch and fail on the `NotImplementedException` create-group path.
- [x] add or update frontend tests/helpers so `useParallelDialer` targets the chosen namespace consistently.
- [x] verify the browser no longer receives spa html or unrelated middleware responses for parallel api calls; response must be json with the expected schema.
- [ ] only after route + implementation is proven, investigate the remaining list/queue drift: list 18 renders `completed` while backend queues are `active` with stuck `calling` items.
- [ ] explain why multiple backend queues exist for the same list/source id and whether that is a cause or aftermath of the route failure.
- [x] fix the first proven blocker only, with tests.
- [ ] verify the fix with a safe browser/network reproduction or explicit ko-provided reproduction logs.
- [x] run the strongest available local checks and document any repo/tooling blockers honestly.
- [ ] publish with `bun run task:push`, `bun run task:pr`, and `bun run task:finish`.

## plan

1. verify the current stream/repo state and capture deploy/runtime evidence without starting live calls.
2. prove the parallel route ownership and namespace from code first, then from browser/network/runtime evidence.
3. inspect the legacy parallel implementation and nest consuelo-api parallel controller/service to choose the least-risk route owner.
4. patch the first proven blocker: align frontend/backend namespace and bridge the nest service to the existing dialer implementation.
5. add focused tests for the route/implementation failure path.
6. run targeted checks, update this workpad with results, publish through the task workflow.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- `packages/twenty-front/src/modules/dialer/utils/parallel-dialer-endpoint.ts`
- `packages/twenty-front/src/modules/dialer/utils/__tests__/parallel-dialer-endpoint.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

## key decisions

- production currently has both owners live: legacy `/v1/calls/parallel/validate` returns json 200, while nest `/api/v1/calls/parallel/validate` reaches `ParallelController` and returns the current dev-1459 501.
- because the stream decision says api routes are migrating to native nest controllers, this patch moves the frontend to `/api/v1/calls/parallel` and wires the nest service rather than routing around it.
- the nest service now bridges to the existing dialer/parallel/lock primitives, resolves the strategy with authenticated workspace context, and returns `winner` plus `winnerSid` for frontend polling compatibility.
- queue/list drift investigation remains intentionally deferred until the parallel create path is no longer a proven not-implemented blocker.

## notes for ko

- task created as pr #170 from `stream/dialer`.
- passive browser evidence showed list 18 rendered as completed in the list table; no call-start controls were clicked.
- safe browser route probe, using the authenticated browser context without printing tokens, showed `/v1/calls/parallel/validate` returning legacy json and `/api/v1/calls/parallel/validate` returning the nest dev-1459 501 before this patch.
- this patch does not attempt queue dedupe yet; it fixes the first proven route/implementation blocker.

## improvements noticed

- `ParallelController` had been ignoring request bodies and route params on create/status/terminate paths. the controller now passes body, group id, user id, and workspace id to the service.
- the legacy group status shape returned `winnerSid` but the frontend expected `winner`. the migrated nest group status returns both.

## errors i ran into

- `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` could not execute because `@swc/jest` was not installed in the worktree.
- the worktree had no `node_modules` or pnp artifacts. `yarn install --immutable --mode=skip-build` failed because the install would modify the lockfile, so i did not mutate the lockfile for this dialer task.
- `yarn install --immutable --mode=skip-builds` was a typo; yarn 4 expects `skip-build`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): repair queue state drift" --changed
bun run task:pr
bun run task:finish
```
