# Own dialer database boundary

branch: `task/dialer/own-dialer-database-boundary`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1821/own-dialer-database-boundary
github pr: https://github.com/consuelohq/opensaas/pull/1821
started: 2026-08-10

## acceptance criteria

- [x] `@consuelo/dialer-server` has a Consuelo-owned, versioned Postgres migration/bootstrap entrypoint.
- [x] A clean Postgres database can be initialized for the deployed standalone runtime without executing `twenty-server` migrations.
- [x] The owned schema covers current standalone persistence: LeadConnector installations, dialer call/session/transcript/settings tables, attempt ledger, and LeadConnector outcome learning tables/indexes.
- [x] Existing databases are adopted idempotently; rerunning migrations does not recreate or destroy data.
- [x] `dialer-server` no longer queries `core.workspace_settings` or `core.contact_attempt_hazard_hourly_mv`.
- [x] Predictive ranking uses standalone LeadConnector outcome learning plus dialer-owned workspace economics/defaults.
- [x] No auth changes, Twenty package deletion, licensing changes, or Yarn/Bun migration in this PR.
- [x] Focused tests, dialer-server test suite, typecheck, build, strict review, and a clean-Postgres schema proof pass before publish.

## plan

1. Write focused failing contracts for a versioned Consuelo database migration runner and for predictive ranking with no `core.*` SQL.
2. Add dialer-owned economics columns to `dialer_workspace_settings` and remove the legacy `core.*` predictive reads.
3. Add a versioned migration runner that composes the existing Consuelo-owned LeadConnector, learning, and call-operations schema initializers and records applied migrations.
4. Wire the Railway Postgres composition through the migration runner while preserving injected-resource tests and idempotent component initialization.
5. Add a `db:migrate` entrypoint for explicit deployment/clean-database initialization.
6. Validate against a fresh local Postgres database, then run package tests/typecheck/review and publish PR 1.

## test-first contract

- New migration contract starts with an empty migration ledger, runs the standalone schema migration, and observes all required Consuelo tables/indexes plus an applied migration record.
- Running the migration contract a second time skips the already-applied migration.
- Predictive ranking contract records all SQL and fails if any query touches `core.*`; economics are read from `dialer_workspace_settings` and learned hazard data comes from `consuelo_lead_connector_call_outcomes`.
- RED is expected before implementation because no versioned migration runner exists and predictive ranking currently queries both legacy `core.*` objects.

## current status

- Implementation complete and review-clean for PR 1.
- `dialer-server` now owns a versioned migration ledger and composes the three existing Consuelo schema initializers behind one migration boundary.
- Predictive ranking no longer reads Twenty's `core.workspace_settings` or `core.contact_attempt_hazard_hourly_mv`.
- Clean PostgreSQL 16 proof passed without a `core` schema and preserved data across a second migration run.

## files changed

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/call-operations/persistence.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/scripts/migrate-database.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`


## workspace-owned: files changed

- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/migrate-database.ts`
- `packages/dialer-server/src/call-operations/persistence.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`

## workspace-owned: activity log

- 2026-08-10 03:32:39 fs.write: `.task/dialer/own-dialer-database-boundary/workpad.md`
- 2026-08-10 03:33:18 fs.write: `packages/dialer-server/src/database/migrations.test.ts`
- 2026-08-10 03:33:19 fs.write: `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- Audited legacy Twenty dialer migration against standalone runtime SQL.
- Confirmed `loadDialerServerRuntime` composes dialer, call-operations, and LeadConnector runtime layers.
- Confirmed standalone caller-ID locking uses Redis, not legacy `caller_id_locks`.

## workspace-owned: validation evidence

- RED: focused migration test failed because `src/database/migrations.ts` did not exist; predictive ranking test failed on the legacy `core.*` query.
- GREEN: focused migration/ranking contracts: 3 pass, 0 fail.
- Full `packages/dialer-server/src` suite: 72 pass, 0 fail, 375 assertions.
- `bun run --cwd packages/dialer-server typecheck`: exit 0.
- `bun run --cwd packages/dialer-server build`: exit 0; compiled standalone binary.
- Strict review: 0 issues owned by this change; two pre-existing `twenty-sdk/cli` type errors remain for PR 3.
- PostgreSQL 16 clean-database proof: `db:migrate` created all nine standalone tables with no `core` schema, economics columns present, second run kept one ledger record and preserved a sentinel row.
- 2026-08-10 03:37:58 `review.run`: passed — OK
- 2026-08-10 03:37:58 `review.run`: passed — OK
- 2026-08-10 03:39:23 `review.run`: passed — OK
- 2026-08-10 03:39:52 `review.run`: passed — OK

## key decisions

- Do not port Twenty's `calls`, `contacts`, `call_queues`, `queue_items`, subscription, usage, phone-number, or user-settings tables into the standalone dialer schema; they are not current dialer-server dependencies.
- Do not preserve `core.contact_attempt_hazard_hourly_mv`; it is built from legacy CRM queue tables. Use the already-recorded standalone LeadConnector outcomes model instead.
- Do not preserve `core.workspace_settings` for predictive economics; move the optional economics values onto `dialer_workspace_settings` with existing defaults when unset.
- Adopt existing production tables idempotently rather than destructive rebuilds.

## notes for ko

- Production runtime scope supplied by Ko is dialer-server + Postgres + Redis; no Twenty production service is part of the target boundary.

## improvements noticed

- The current local-runtime validator covers LeadConnector persistence and mock dialing but not call-history schema; add a dedicated clean-database migration proof instead of widening unrelated scenario behavior.

## issues and recovery

- Repository semantic search for `initializeLeadConnectorPersistence` was noisy; a task-scoped source scan located the canonical implementation in `packages/lead-connector/src/infrastructure/persistent-stores.ts`.
- Initial workpad overwrite was rejected because the file already existed; retried with explicit force.
- Initial local PostgreSQL attempt found no running service; an isolated PostgreSQL 16 cluster was created under `/tmp` instead. The first startup hit a locale issue, then succeeded with `LC_ALL=C`/`--locale=C`; the cluster was stopped and deleted after the proof.
- The first review diff against the stream ref included unrelated stream history. Working-tree diff confirmed this task itself is limited to the dialer-server changes plus generated task metadata.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(dialer): own database boundary" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/validate-local-runtime.ts`
- `packages/dialer-server/src/application.ts`
- `packages/dialer-server/src/call-operations/persistence.test.ts`
- `packages/dialer-server/src/call-operations/persistence.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- `packages/lead-connector/src/persistent-stores.contract.test.ts`
- `packages/twenty-server/src/database/typeorm/core/migrations/common/1774090000000-create-consuelo-dialer-runtime-tables.ts`
- `packages/twenty-server/src/database/typeorm/core/migrations/common/1774100000000-create-contact-attempt-hazard-hourly-view.ts`
- `packages/twenty-server/src/database/typeorm/core/migrations/common/1774200000000-add-dialer-config-to-workspace-settings.ts`
- `packages/workspace/senior-engineer.md`

- 2026-08-10 03:40:55 apply-patch: `.task/dialer/own-dialer-database-boundary/workpad.md`