# fix PR 2060 release readiness test

branch: `task/explore/fix-pr-2060-release-readiness-test`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2284
started: 2026-08-29

## acceptance criteria

- [x] Keep `OPENROUTER_API_KEY` required for Workspace Edge because the PR's hosted semantic embedding route depends on it.
- [x] Update the stale release-readiness test fixture so the optional-dashboard-disabled success case supplies every required non-dashboard secret.
- [x] Preserve the negative required-secret test and its fail-closed behavior.
- [x] Run the focused readiness test, then review/verify and merge this task into `stream/explore`.

## Test-first contract

behavior under test: Workspace Edge deployment readiness should succeed with the optional internal dashboard disabled only when all always-required secrets, including `OPENROUTER_API_KEY`, are configured; missing required secrets must still fail before deployment.
existing local pattern: `packages/os/tests/cloudflare-worker-release-readiness.test.ts` injects a `listSecrets` fixture into `deployCloudflareWorker` and asserts deploy/no-deploy behavior.
new or changed tests: fixture-only correction unless source inspection shows product logic is wrong; no weakening of `requiredSecrets`.
focused red command: already executed by the stream publish gate through `stream.sync`; `packages/os/tests/cloudflare-worker-release-readiness.test.ts` failed 1/3.
expected red failure: `allows deployment with the optional internal dashboard disabled` throws `Workspace edge secret OPENROUTER_API_KEY is not configured` because the success fixture still mocks the pre-embedding secret set.
no-test waiver: not applicable; the stream publish gate is the red test, and the same focused test file will be rerun green after the fixture correction.

## red evidence

- stream verification selected `OS one-click managed cloud contracts`.
- 13/14 files and 104/105 tests passed in that suite.
- sole failure: `tests/cloudflare-worker-release-readiness.test.ts > allows deployment with the optional internal dashboard disabled`.
- thrown from `assertRequiredCloudflareWorkerSecrets`: `Workspace edge secret OPENROUTER_API_KEY is not configured`.

- 2026-08-29 04:44:54 write: `.task/explore/fix-pr-2060-release-readiness-test/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 04:44:54 fs.write: `.task/explore/fix-pr-2060-release-readiness-test/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/tests/cloudflare-worker-release-readiness.test.ts`

## workspace-owned: validation evidence

- 2026-08-29 04:45:54 `review.run`: passed — OK
- 2026-08-29 04:46:11 `verify`: passed — OK


## files changed

- packages/os/tests/cloudflare-worker-release-readiness.test.ts — added OPENROUTER_API_KEY to the Workspace Edge success fixture only; production requirements unchanged.

## validation

- focused readiness file: 1 file / 3 tests passed.
- destructive-literal preflight: clean.
- review.run --strict --no-tests: 0 issues, 0 blockers.
- verify against origin/stream/explore: passed; publishValid=true; 0 DB risks.
