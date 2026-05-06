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
- `packages/twenty-shared/src/utils/filter/dates/utils/resolveRelativeDateFilter.ts`
- `packages/twenty-shared/src/utils/filter/dates/utils/resolveRelativeDateFilterStringified.ts`
- `packages/twenty-shared/src/utils/filter/dates/utils/resolveRelativeDateTimeFilterStringified.ts`

## key decisions

- Treat the `twenty-shared:build` failure as a Phase 0 prerequisite blocker because `npx nx database:reset twenty-server` cannot reach migrations until dependent builds pass.
- Keep this phase anchored on the existing `packages/workspace/scripts/run-dialer-scenario.ts` behavior. The script is a REST queue lifecycle harness today, so the captured failure is baseline evidence for the later GraphQL acceptance contract work.
- Use a workspace-scoped token for local scenario calls. The sign-in token from `/metadata` is workspace-agnostic and fails guarded REST calls with 403.
- `http://localhost:3000` resolves to the YCombinator seed workspace locally. Scenario data and auth for this run use workspace `3b8e6458-5fc1-4e63-8563-008ccddaa6db`.

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
- After-lock-fix transcript: `/private/tmp/dev-1499-dialer-scenario-after-lock-fix.json`. Result: scenario progressed through auth, voice status, queue creation, first item, and no-answer handling; it failed on the answered-contact suppression step.
- Current behavior failure: `contact 2 answered next item: expected contact a49f5b5c-0a06-4417-8432-be179dc69b8a, got 63da814d-8b0c-4143-90bb-0089e55c0935`.
- DB state after failure on queue `752dbc72-0b5c-401a-8c20-dcdb0dad33dd`: contact 1 completed with `no-answer`, contact 2 completed with `answered`, contact 3 moved to `calling`, contact 4 stayed `pending`, contact 5 stayed `pending`. This records that the current queue service advances to contact 3 instead of suppressing contact 3 after contact 2 answers.

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
