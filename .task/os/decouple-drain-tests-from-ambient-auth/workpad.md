# decouple drain tests from ambient auth

branch: `task/os/decouple-drain-tests-from-ambient-auth`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2153/decouple-drain-tests-from-ambient-auth
github pr: https://github.com/consuelohq/opensaas/pull/2153
started: 2026-08-17

## acceptance criteria

- [x] Response-accounting tests validate request/body lifecycle rather than an unrelated fallback HTTP status.
- [x] Tests pass locally without depending on the fallback status; GitHub CI will re-prove the ambient-auth case after stream promotion.
- [x] Current lifecycle selector, strict review, and formal verify remain green.

## plan

1. Remove only the two status-code assertions that are orthogonal to response accounting; retain body/null and `activeRequests` assertions.
2. Run focused health/worker tests and the current lifecycle selector.
3. Review/verify, merge into `stream/os`, sync stream with latest `main`, then let #2152 rerun CI.

## current status

- CI RED on stream PR #2152: `Consuelo / verify` failed only two `health-readiness.test.ts` assertions because GitHub ambient auth returned 401 for `/not-a-real-route`; local execution returns 404. Product request-accounting behavior was not the failing signal.

## files changed

- `packages/os/tests/health-readiness.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-17 00:51:09 `review.run`: passed — OK
- 2026-08-17 00:51:26 `verify`: passed — OK

## key decisions

- Keep the tests causal: assert body lifecycle and worker accounting only. Do not encode the environment-dependent auth/fallback status in these drain tests.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- `stream/os` moved into this task at `4322cbd9...` and is currently three commits behind `main`; after this task is merged, sync the stream before merging the stream review PR so no newer main work is omitted.

## Test-first contract

behavior under test: response-accounting regressions must be invariant to ambient auth configuration; a non-HEAD response keeps `activeRequests=1` until its body settles, and HEAD releases immediately when Hono discards the body.

existing local pattern: `health-readiness.test.ts` uses `/not-a-real-route` only as a convenient body-producing request; the test's purpose is worker accounting, not fallback routing or authorization.

new or changed tests: remove `response.status === 404` from the two response-accounting cases while preserving `response.body`, body consumption, and `activeRequests` assertions.

focused red command: GitHub `Consuelo / verify` on PR #2152, run 31982729009 / job 95252496389.

expected red failure: CI received 401 instead of 404 at lines 129 and 168 while the request-accounting assertions remained the relevant contract (`trc_aa0a772aca6e`).

no-test waiver: none; CI is the focused RED and local/current selector GREEN must follow.

## Validation evidence

- Focused GREEN: 21/21 across health/readiness + worker-pool lifecycle (`trc_516150817286`).
- Strict review: 0 issues / 0 blockers / 0 documentation gaps (`trc_d2e94241e748`).
- Full formal verify against `origin/stream/os`: `publishValid: true`, DB guard clean (`trc_6ddb8a153237`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-17 00:50:25 apply-patch: `.task/os/decouple-drain-tests-from-ambient-auth/workpad.md`
- 2026-08-17 00:50:34 apply-patch: `packages/os/tests/health-readiness.test.ts`

- 2026-08-17 00:51:35 apply-patch: `.task/os/decouple-drain-tests-from-ambient-auth/workpad.md`