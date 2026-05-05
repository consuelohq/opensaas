# fix fresh db agent automation migration

branch: task/dialer/fix-agent-automation-migration
stream: stream/dialer

## acceptance criteria

- [ ] Fresh local database reset no longer fails on missing core.agentSkill during agent automation migration.
- [ ] Preserve agent feature schema by letting canonical later agent migrations create active tables.
- [ ] Do not delete agent functionality or rewrite broad migration history.
- [ ] Push task branch and create/update stream review PR if validation succeeds.

## plan

1. Patch the old agent automation migration into an explicit compatibility no-op.
2. Validate formatting and fresh DB reset.
3. Publish if successful.

## files changed

- pending

## key decisions

- The earlier migration references core.agentSkill before that table exists.
- A later canonical migration creates agentSkill, then agentAutomation in the correct order.

## notes for ko

- This fixes the migration-order failure seen locally and in Railway.

## implementation update

- Patched stale agent migrations so fresh DBs keep the active core agent conversation schema and add the AI agent execution tables needed by the dev seeder.
- Patched prebuilt skill seeding so text-array fields are passed as proper arrays and string parameters are cast explicitly.
- Added `1774090000000-create-consuelo-dialer-runtime-tables.ts` to port the remaining Consuelo dialer runtime tables from old `packages/api/src/migrations` into the TypeORM core migration flow.
- The new dialer runtime migration creates unqualified/public tables used by current raw SQL services: `caller_id_locks`, `area_code_locations`, `calls`, `contacts`, `call_queues`, `queue_items`, `contact_attempt_ledger`, `workspace_subscriptions`, `workspace_usage`, `workspace_phone_numbers`, and `user_settings`.
- Kept `core.contact_attempt_hazard_hourly_mv` intact. The materialized view now has its base tables during fresh reset.

## validation update

- Brew local infra is now the local default for this task: `postgresql@17`, `pgvector`, and `redis` are installed and running.
- `CREATE EXTENSION vector` works on the local `default` database.
- `PG_DATABASE_URL=postgres://postgres@localhost:5432/default DATABASE_URL=postgres://postgres@localhost:5432/default REDIS_URL=redis://localhost:6379 npx nx database:reset twenty-server` exits 0.
- Grep of the latest reset log found no migration/query failures.
- SQL checks confirm the new runtime tables, agent execution tables, and hazard materialized view exist after reset.

## codex review follow-up

Accepted Codex review items and patched them:

- Made `CreateConsueloDialerRuntimeTables1774090000000.down()` non-destructive because this is an adoption migration and may adopt pre-existing production data tables.
- Made `RefactorAgentChatEntities1764100000000.down()` non-destructive because thread/turn-based agent messages may have `conversationId = NULL` after the forward migration.
- Added explicit `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...` repair statements for legacy additive columns so partial old-SQL-stack databases are repaired, not silently skipped.
- Added old call-history indexes: `idx_calls_workspace_outcome`, `idx_calls_workspace_date`, and `idx_calls_history_query`.
- Ported `contact_attempt_ledger` backfill from the old SQL migration so production databases with existing queue/call history do not lose historical cadence state.
- Added minimal `core.workspace_settings` compatibility table with `dialer_config` for cadence/stopping economics paths that read `core.workspace_settings` directly.

## codex follow-up validation

- Reran `npx prettier --write` on changed migration files.
- Reran `git diff --check`.
- Reran fresh Brew-backed database reset:
  `PG_DATABASE_URL=postgres://postgres@localhost:5432/default DATABASE_URL=postgres://postgres@localhost:5432/default REDIS_URL=redis://localhost:6379 npx nx database:reset twenty-server`
- Reset exits 0.
- Grep of latest reset log found no actual migration/query failures.
- SQL checks confirmed:
  - agent execution tables exist.
  - hazard materialized view exists.
  - public dialer runtime tables exist.
  - `core.workspace_settings` exists.
  - additive retry/subscription columns exist.
  - call-history indexes exist.
