# normalize persisted parallel group cleanup failures

branch: `task/dialer/normalize-persisted-parallel-group-cleanup-failures`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1755/normalize-persisted-parallel-group-cleanup-failures
github pr: https://github.com/consuelohq/opensaas/pull/1755
started: 2026-08-03

## acceptance criteria

- [ ] Hydrate persisted parallel groups when `cleanupFailures` is missing, null, or a non-array Redis Lua JSON object.
- [ ] Preserve and clone valid cleanup-failure arrays.
- [ ] Keep new group creation and Redis persistence contracts unchanged.
- [ ] Pass focused domain tests, dialer tests, dialer-server tests/build, strict review, and publish verification.
- [ ] Merge the hotfix into `stream/dialer`, deploy an exact stream artifact, and verify healthy startup.
- [ ] Replay only the missing signed terminal callback for the already-completed call ending 0892 -> 2191.
- [ ] Verify that the stale group closes, the caller-ID lock releases, and one learning outcome is recorded.
- [ ] Place no additional carrier call.

## plan

1. Add a focused domain contract reproducing the production `cleanupFailures: {}` payload.
2. Normalize cleanup failures at the persisted-group hydration boundary and preserve valid arrays.
3. Run focused and broad validation, review, and the publish safety gate.
4. Merge into `stream/dialer` and deploy the exact merged standalone artifact to Railway.
5. Replay the missing signed terminal callback for the existing completed Twilio call and verify cleanup/learning without another call.

## current status

- Ko authorized exactly one live call from the approved caller ending 0892 to the approved target ending 2191.
- Twilio confirms exactly one outbound API leg completed: 7 seconds, AMD `machine_start`. No second call is authorized or planned.
- Twilio received HTTP 503 from both customer-TwiML and status callback routes. The call never entered the conference.
- The signed status replay also returns the application's `SERVICE_UNAVAILABLE` response.
- Direct runtime reproduction found `cleanupFailures: {}` in Redis and a decoder failure because `.map` was called on that object.
- Root cause: Redis Lua `cjson.encode` serializes an empty decoded Lua table as `{}` after the register-call script rewrites the group.
- The exact call group remains `dialing`, its 0892 lock remains, and no learning row exists yet.

## test-first contract

- Behavior under test: persisted groups with missing, null, or non-array `cleanupFailures` hydrate to an empty array without throwing; valid arrays are cloned and preserved.
- Existing pattern: `hydrateParallelGroup` is the domain boundary used after parsing persisted group JSON.
- New test: `packages/dialer/src/domain/parallel-group.spec.ts` with a production-shaped `cleanupFailures: {}` fixture plus valid-array preservation.
- Focused red command: `bun test packages/dialer/src/domain/parallel-group.spec.ts`.
- Expected red failure: `(group.cleanupFailures ?? []).map is not a function`.
- No-test waiver: none.

## files changed

- `packages/dialer/src/domain/parallel-group.spec.ts` (test first)
- `packages/dialer/src/domain/parallel-group.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-03 16:29:51 `review.run`: passed — OK
- 2026-08-03 16:29:52 `review.run`: passed — OK
- 2026-08-03 16:30:13 `verify`: failed — COMMAND_FAILED
- 2026-08-03 16:32:07 `review.run`: passed — OK
- 2026-08-03 16:32:25 `verify`: passed — OK

## key decisions

- Normalize at hydration rather than rewriting production Redis manually or changing Lua encoding behavior.
- Treat all parsed persistence fields as untrusted runtime input even when their TypeScript type is `ParallelGroup`.
- Preserve the one-call authorization boundary; callback replay and state cleanup do not create a carrier call.

## notes for ko

- The approved call occurred once and was classified as a machine answer, but the conference/callback lifecycle failed before application completion.
- This task repairs that compatibility failure and closes the existing call state; it will not dial again.

## improvements noticed

- none yet

## issues and recovery

- The authenticated GoHighLevel browser profile was logged out, so the live call entered through the same deployed application runtime rather than the UI.
- The first execution failed before module loading and placed no call.
- A later safety preflight found the already-created one-call lock and correctly refused to create a second leg.
- Signed callback replay exposed a persisted-shape compatibility failure rather than a Twilio signature failure.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/dialer/package.json`
- `packages/dialer/src/domain/parallel-group.ts`
- `packages/dialer/src/domain/parallel-transition.spec.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- `packages/workspace/scripts/review.js`

## implementation evidence

- Focused red reproduced the production exception for `cleanupFailures: {}`.
- The same red test proved `hydrateParallelGroup` reattached the original valid array after cloning.
- Implementation normalizes non-array cleanup failures to `[]`, clones valid entries, and returns the clone directly.


## validation evidence

- Focused red: 0 passed, 2 failed with the production `.map is not a function` exception and valid-array aliasing.
- Focused green: 2 passed, 0 failed, 4 expectations.
- Full dialer suite: 162 passed, 0 failed, 329 expectations.
- Dialer-server suite: 45 passed, 0 failed, 220 expectations.
- Dialer-server standalone build passed.
- Working source diff is limited to cleanup-failure hydration plus its focused test.
- A batch validation attempt ran from the main checkout because the wrapper dropped `taskSession`; direct task-scoped reruns passed.


- Canonical verify initially failed because the new test imported `bun:test`, while this package's review gate runs Jest. Existing dialer domain tests use test globals compatible with both runners; the test was aligned to that pattern.
