# DEV-1499 local setup and scenario validation

branch: `task/dialer/dev-1499-local-setup-and-scenario-validation`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/326
started: 2026-05-05

## acceptance criteria

- [x] Phase 0 local database reset passes with Brew Postgres 17, pgvector, and Redis.
- [x] Current dialer scenario command shape and baseline pass/fail behavior are recorded.
- [ ] DEV-1499 open questions are answered from code evidence before product refactor work begins.

## plan

1. Establish local infrastructure truth and run the fresh database reset.
2. Inspect and run the existing dialer scenario to capture baseline behavior.
3. Answer the DEV-1499 open questions from current code before editing call-start architecture.

## files changed

- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/consuelo-api.module.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/twenty-shared/src/utils/filter/dates/utils/resolveRelativeDateFilter.ts`
- `packages/twenty-shared/src/utils/filter/dates/utils/resolveRelativeDateFilterStringified.ts`
- `packages/twenty-shared/src/utils/filter/dates/utils/resolveRelativeDateTimeFilterStringified.ts`
- `packages/workspace/scripts/run-dialer-scenario.ts`


## key decisions

- Treat the `twenty-shared:build` failure as a Phase 0 prerequisite blocker because `npx nx database:reset twenty-server` cannot reach migrations until dependent builds pass.
- The current `packages/workspace/scripts/run-dialer-scenario.ts` script is a REST queue lifecycle harness. It is baseline evidence only; the final DEV-1499 acceptance contract is GraphQL `startDialerCall` delegating to `DialerCallStartService`.
- The old expectation that contact 3 should be suppressed after contact 2 answered is not DEV-1499 acceptance unless the scenario explicitly seeds a real backend callability blocker.
- Predictive dialing should select the next callable targets from the backend. A contact should only be skipped, deduped, or reduced when the scenario intentionally seeds and documents DNC, invalid phone, duplicate target, cooldown/cadence, attempt cap, caller-ID capacity, or another concrete backend blocker.
- Do not spend time fixing contact 3 suppression unless code evidence proves that rule still belongs in backend callability.
- Use a workspace-scoped token for local scenario calls. The sign-in token from `/metadata` is workspace-agnostic and fails guarded REST calls with 403.
- `http://localhost:3000` resolves to the YCombinator seed workspace locally. Scenario data and auth for this run use workspace `3b8e6458-5fc1-4e63-8563-008ccddaa6db`.
- Signed-in workspace mutations in this app use the metadata GraphQL schema pattern. `startDialerCall` is a `@MetadataResolver()` mutation, called through `/metadata` locally by the scenario runner. The scenario first signs in, selects the desired workspace login token, exchanges it with `getAuthTokensFromLoginToken`, then calls `startDialerCall` with a workspace-scoped user token.

## GraphQL pattern evidence

- Pattern files inspected before resolver wiring:
  - `packages/twenty-server/src/modules/dashboard/chart-data/resolvers/bar-chart-data.resolver.ts`
  - `packages/twenty-server/src/engine/core-modules/auth/auth.resolver.ts`
  - `packages/twenty-server/src/engine/api/graphql/graphql-config/graphql-config.service.ts`
  - `packages/twenty-server/src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator.ts`
- Resolver pattern used:
  - `@MetadataResolver()`
  - `@UseGuards(WorkspaceAuthGuard)` at class level
  - `@UseGuards(NoPermissionGuard)` on the mutation
  - `@AuthWorkspace()` and `@AuthUser()` to require signed-in workspace/user context
- API-key-only auth should be rejected by the `@AuthUser()` requirement because API-key auth does not provide a signed-in user.
- No new app-facing REST call-start bridge was added. Existing REST paths remain legacy/quarantined for later frontend migration.

## local setup evidence

- Brew Postgres 17 is running and `CREATE EXTENSION IF NOT EXISTS vector` succeeded in the local `default` database.
- Brew Redis is running; `redis-cli -u redis://localhost:6379 ping` returned `PONG`.
- DB backup succeeded before reset at `.agent/backups/backup-2026-05-05-171018.sql.gz` after putting `/opt/homebrew/opt/postgresql@17/bin` first in `PATH`.
- `npx nx database:reset twenty-server` succeeded after fixing prerequisite build/install blockers. Nx reported success for `database:reset` and its dependent tasks.
- Local `twenty-server` required `APP_SECRET`, `PG_DATABASE_URL`, `DATABASE_URL`, `REDIS_URL`, `SERVER_URL`, and `NODE_ENV=development`; `/healthz` returned database and Redis `up`.

## scenario baseline

- First scenario transcript: `/private/tmp/dev-1499-dialer-scenario-baseline.json`. Result: 403 at `voice-status-user-token` because the token was workspace-agnostic.
- Workspace-token transcript before SQL lock fix: `/private/tmp/dev-1499-dialer-scenario-baseline-workspace-token.json`. Result: 500 at queue start. Server error was `FOR UPDATE is not allowed with aggregate functions`.
- Runtime patch: `QueuesService.selectNextCallableItem` now uses `FOR UPDATE OF qi SKIP LOCKED`, which scopes the row lock to `queue_items` and avoids the Postgres aggregate lock error from the lateral ledger query.
- After-lock-fix transcript: `/private/tmp/dev-1499-dialer-scenario-after-lock-fix.json`. Result: scenario progressed through auth, voice status, queue creation, first item, and no-answer handling; it failed on the old answered-contact suppression expectation.
- Current behavior failure: `contact 2 answered next item: expected contact a49f5b5c-0a06-4417-8432-be179dc69b8a, got 63da814d-8b0c-4143-90bb-0089e55c0935`.
- DB state after failure on queue `752dbc72-0b5c-401a-8c20-dcdb0dad33dd`: contact 1 completed with `no-answer`, contact 2 completed with `answered`, contact 3 moved to `calling`, contact 4 stayed `pending`, contact 5 stayed `pending`. This records current behavior only. Under the DEV-1499 correction, contact 3 advancing is acceptable unless the scenario explicitly seeded a callability blocker for contact 3.

## Phase 1 GraphQL scenario evidence

- Scenario command shape:
  - `CONSUELO_SCENARIO_MODE=single|predictive|both`
  - `CONSUELO_SCENARIO_CALL_MODE=mock|twilio-test|live`
  - `CONSUELO_SCENARIO_LIVE_CALLS_ENABLED=true` is required for live mode
  - `CONSUELO_SCENARIO_SAFE_TO_NUMBERS` and `CONSUELO_SCENARIO_SAFE_FROM_NUMBERS` are required for live mode
  - `CONSUELO_SCENARIO_WORKSPACE_ID` selects the local seed workspace when multiple workspaces share the local origin
- Non-live runtime evidence against local `twenty-server`:
  - `CONSUELO_SCENARIO_MODE=single`, `CONSUELO_SCENARIO_CALL_MODE=mock`: passed, transcript `/tmp/dev-1499-single-mock.json`, `actualFanout=1`, `status=mocked`, one call.
  - `CONSUELO_SCENARIO_MODE=predictive`, `CONSUELO_SCENARIO_CALL_MODE=mock`: passed, transcript `/tmp/dev-1499-predictive-mock.json`, `actualFanout=2`, `status=mocked`, two calls.
  - `CONSUELO_SCENARIO_MODE=both`, `CONSUELO_SCENARIO_CALL_MODE=mock`: passed, transcript `/tmp/dev-1499-both-mock.json`, single step `actualFanout=1`, predictive step `actualFanout=2`.
- Live fail-closed evidence:
  - `CONSUELO_SCENARIO_CALL_MODE=live` without `CONSUELO_SCENARIO_LIVE_CALLS_ENABLED=true` fails before GraphQL with `Live scenario mode requires CONSUELO_SCENARIO_LIVE_CALLS_ENABLED=true.`, transcript `/tmp/dev-1499-live-fail-closed.json`.
- Live validation blocker:
  - `security find-generic-password -a "$USER" -s "consuelo_twilio_live_account_sid" -w` returned `SecKeychainSearchCopyNext: The specified item could not be found in the keychain`.
  - `consuelo_twilio_live_auth_token` is also missing from Keychain by service lookup.
  - `consuelo_scenario_safe_to_numbers` and `consuelo_scenario_safe_from_numbers` are present, but full live validation cannot run without the Twilio account SID/auth token in the server process environment.
  - Public callback reachability is still unresolved for local live validation because the local server currently advertises `API_BASE_URL=http://127.0.0.1:3000`, which Twilio cannot call back from outside the machine.

## validation evidence

- `workspace checkFiles` passed for:
  - `packages/workspace/scripts/run-dialer-scenario.ts`
  - `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
  - `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts`
  - `packages/twenty-server/src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver.ts`
  - `packages/twenty-server/src/engine/core-modules/consuelo-api/consuelo-api.module.ts`
  - `packages/dialer/src/services/parallel-dialer.ts`
- `npx prettier --check` passed for all changed TypeScript scenario/service/resolver/dialer files.
- `git diff --check` passed.
- `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` passed: 2 suites, 22 tests.
- `npx jest packages/dialer/src/services/parallel-dialer.spec.ts --config=packages/dialer/jest.config.mjs --runInBand` passed: 1 suite, 36 tests.
- `npx nx typecheck @consuelo/dialer` passed.
- `workspace review.run '{"branch":"task/dialer/dev-1499-local-setup-and-scenario-validation","base":"stream/dialer","noTests":true}'` returned `ok: true`. It still printed pre-existing `twenty-server` and `twenty-shared` typecheck failures outside the changed dialer surface, including workflow `unknown` catch typing, workspace-member strict property initialization, queue-worker unknown typing, and `twenty-shared/scripts/generateBarrels.ts` implicit return type.

## notes for ko

- DEV-1499 Linear task was read in full. First implementation work stays in Phase 0 until local reset and current scenario baseline are known.
- Task worktree has `node_modules` symlinked to `/Users/kokayi/Dev/opensaas/node_modules`.
- The next phase should answer the DEV-1499 open questions from code evidence before product refactor work begins.

## errors i ran into

- `workspace stream.sync '{"area":"dialer"}'` was initially blocked by stale Git worktree metadata for missing `/private/tmp` paths. `git worktree prune` cleared the stale metadata after ko approved it.
- First DB backup attempt failed because `DATABASE_PUBLIC_URL` was missing. Retried with local `postgres://postgres@localhost:5432/default`.
- Second DB backup attempt failed because default `pg_dump` was Postgres 16 while the server is Postgres 17. Retried with `/opt/homebrew/opt/postgresql@17/bin` first in `PATH`; backup succeeded.
- Fresh reset command reached `twenty-shared:build` and failed before migrations. Errors were TypeScript narrowing failures in relative date filter utilities that imported `isDefined` from `class-validator`.
- Local server start failed without `APP_SECRET`; adding the local dev secret let Nest start.
- Sandboxed localhost curl could not connect to the server; unsandboxed curl reached `/healthz`.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
