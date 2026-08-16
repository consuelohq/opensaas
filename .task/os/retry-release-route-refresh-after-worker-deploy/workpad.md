# Retry release route refresh after Worker deploy

branch: `task/os/retry-release-route-refresh-after-worker-deploy`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2056/retry-release-route-refresh-after-worker-deploy
github pr: https://github.com/consuelohq/opensaas/pull/2056
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 08:51:29 fs.write: `.task/os/retry-release-route-refresh-after-worker-deploy/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 09:00:21 `review.run`: passed — OK
- 2026-08-15 09:00:38 `verify`: passed — OK
- 2026-08-15 09:00:53 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: after Device Authority Worker deploy, release-managed workspace route refresh must tolerate the short Cloudflare propagation window by retrying transient endpoint failures (at minimum HTTP 404, network errors, rate limits, and server errors) with bounded backoff, while failing promptly on permanent auth/payload errors; once the endpoint is live, the same release run must advance the D1 workspace route before reporting success.
existing local pattern: the release operator already injects `sleepImpl` for bounded polling/retry seams and `fetchWithDefaults` owns request timeout behavior; Device Authority health/device-flow checks use bounded attempts instead of treating propagation as immediate.
new or changed tests: extend the Device Authority release contract so the route-refresh endpoint returns 404 for early attempts then 200 and assert retry/sleep behavior; add a permanent 401 case proving auth failures are not retried.
focused red command: `cd packages/os && bun run test -- tests/os-device-authority-release-contract.test.ts`
expected red failure: current release throws on the first transient 404 immediately after Worker deploy instead of retrying through propagation.
no-test waiver: not applicable.

## Acceptance criteria

- [x] Reproduce the propagation race in a focused test before implementation.
- [x] Retry only transient route-refresh failures with bounded attempts and injected sleep.
- [x] Permanent 4xx auth/payload failures fail promptly without retrying.
- [x] Focused + related release tests, typecheck, Worker bundle dry-run, strict review, and formal verify pass.
- [ ] Ship through `stream/os` to `main`, reconciling current main ancestry if required.
- [ ] Re-run the real production release and verify the D1 trace route advances to the new snapshot.
- [ ] Wait for the final runtime publish, promote that exact dev bundle to canary, run Ko's normal saved-channel update, and verify local tracing Sites + runtime converge to the final release.

## Validation evidence

- Production failure root cause: main release `31875159286` deployed Worker version `bc472b9d-a739-487a-80e5-f58e72d9d65f`, then its first route-refresh POST immediately received transient HTTP 404. A later live probe to the same path returned the expected Hono 401, proving deployment propagation rather than missing code (`trc_f0a3714badf5`, `trc_e5a5746ab1ed`).
- Focused RED: the release contract failed when the first route-refresh response was transient because the release exited immediately instead of retrying (`trc_f053f08e89fb`).
- GREEN: release route refresh now makes up to 12 attempts with 1s injected sleeps for network failures and transient HTTP 404/408/425/429/5xx; a contract drives network error → 404 → 429 → 503 → 200 and succeeds, while HTTP 401 fails on the first attempt with no sleep (`trc_082fb5c8e834`, `trc_51214e156a9b`).
- Related validation: Device Authority release + managed-cloud tests pass 21/21, production workflow contract passes 3/3, OS typecheck/syntax passes, Worker dry-run bundles with the D1 binding, and OS device-auth release dry-run completes with the planned route refresh (`trc_51214e156a9b`).
- Strict review reports 0 issues / 0 blockers (`trc_b881c210561d`). Formal verification passed with `publishValid=true` and a clean DB guard (`trc_112b37d5b4e9`).

- 2026-08-15 08:51:29 append: `.task/os/retry-release-route-refresh-after-worker-deploy/workpad.md`

- 2026-08-15 08:52:08 apply-patch: `packages/os/tests/os-device-authority-release-contract.test.ts`
- 2026-08-15 08:52:27 apply-patch: `packages/workspace/scripts/os-release-device-auth.ts`
- 2026-08-15 08:52:46 apply-patch: `packages/os/tests/os-device-authority-release-contract.test.ts`

- 2026-08-15 08:53:08 apply-patch: `.task/os/retry-release-route-refresh-after-worker-deploy/workpad.md`

- 2026-08-15 09:00:43 apply-patch: `.task/os/retry-release-route-refresh-after-worker-deploy/workpad.md`
