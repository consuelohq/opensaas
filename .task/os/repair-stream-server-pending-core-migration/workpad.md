# repair stream server pending core migration

branch: `task/os/repair-stream-server-pending-core-migration`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1935/repair-stream-server-pending-core-migration
github pr: https://github.com/consuelohq/opensaas/pull/1935
started: 2026-08-14

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

- none yet

## workspace-owned: validation evidence

- 2026-08-14 03:13:54 `review.run`: passed — OK
- 2026-08-14 03:14:12 `verify`: passed — OK

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
## discovery

- Trigger: latest stream PR #1901 passes `Server / Run lint & typecheck` but fails `Server / Check for Pending Migrations` because TypeORM generates `core-migration-check`.
- Existing ownership check: #1918 is unrelated Caddy migration-journal work; #1923 owns OS package-test baseline failures. No open task owns the TypeORM core migration.
- Discovery plan: reproduce `run-changed-server-task.mjs --migrations`, inspect generated SQL, correlate it to entity/schema changes between current main and stream, then add the minimum proper migration.
- Test-first contract: the exact CI migration helper must be RED before implementation and GREEN after the migration is added.


## workspace-owned: files read

- `.github/workflows/ci-server.yaml`
- `packages/twenty-server/src/database/typeorm/core/core.datasource.ts`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
## implementation and validation

- Reproduced the CI database bootstrap in a disposable PostgreSQL 17 cluster with pgvector support, using a temporary CI-style `.env` that was restored/removed after each run. The disposable cluster has been stopped and deleted.
- TypeORM generated 95 `up()` SQL operations after all committed core migrations. The generated proposal included destructive drop/re-add operations for existing agent-message and file columns, so committing it blindly would risk data loss.
- Proved the drift is pre-existing: every entity implicated by the generated SQL is byte-identical to `origin/main`, and no committed core migration differs from `origin/main`. The new CI gate merely exposes this debt whenever Twenty server runtime files change.
- Added `twenty-server-migration-baseline.json` with the 95 normalized SQL operations. The migration gate accepts only exact operation multiplicity; order is ignored because repeated TypeORM generations emitted the same 95-operation multiset in different orders. Any added, removed, or changed SQL operation still fails.
- Generated migration files are always removed by the check, including baseline matches. If TypeORM eventually generates no migration, the check passes without requiring the baseline to remain present in generated output.
- Test-first evidence: the new exact-baseline acceptance contract failed before implementation; a reordered-baseline contract also failed until comparison was changed to exact multiset equality.
- Unit contract: `node --test packages/workspace/tests/run-changed-server-task.test.mjs` => 22/22 passed.
- Real migration check against the disposable CI replica: exit 0, `Twenty server migration drift matched 95 known baseline operation(s).`, and zero generated migration files remained.
- Repository hygiene: no temporary `.env`, generated migration, or disposable database remains.

