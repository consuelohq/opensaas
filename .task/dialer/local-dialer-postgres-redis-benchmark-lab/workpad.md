# Local Dialer Postgres Redis benchmark lab

branch: `task/dialer/local-dialer-postgres-redis-benchmark-lab`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1988/local-dialer-postgres-redis-benchmark-lab
github pr: https://github.com/consuelohq/opensaas/pull/1988
started: 2026-08-15

## acceptance criteria

- [x] Provide a repeatable local dialer lab that starts isolated PostgreSQL and Redis instances without Docker, Railway, production credentials, Twilio, or CRM credentials.
- [x] Run the real `@consuelo/dialer-server` migrations against a clean local PostgreSQL database.
- [x] Seed deterministic synthetic/pseudonymous dialer histories suitable for predictive-model correctness tests and benchmarks.
- [x] Expose reproducible benchmark commands for at least candidate ranking latency, durable event/attempt ingestion, model aggregation/rebuild work, and Redis coordination primitives.
- [x] Keep benchmark output machine-readable enough to compare runs while avoiding flaky hard latency thresholds in normal PR validation.
- [x] Ensure startup/teardown cleans its own isolated processes/data directories and does not reuse or mutate developer/global Postgres or Redis state.
- [x] Add focused tests proving command/config generation, isolation, deterministic fixtures, and cleanup behavior.
- [x] Document how D1/D2/D3 agents should use the lab and which results are correctness gates vs observational benchmarks.

## plan

1. Inspect existing dialer-server migrations, local runtime validation, workspace `dev` tooling, and any current benchmark/fixture patterns.
2. Write focused RED tests for the lab contract before implementing the harness.
3. Implement the smallest reusable local-service harness and deterministic fixture/benchmark runner using existing repo patterns.
4. Prove it against real local PostgreSQL + Redis processes on isolated ports; rerun for idempotence/cleanup.
5. Run focused tests, dialer-server tests/typecheck/build as affected, workspace review, and full verify before publish.

## Test-first contract

behavior under test: a developer can run one local command that provisions isolated PostgreSQL + Redis, migrates the dialer schema, loads deterministic synthetic observations, runs correctness/benchmark scenarios, emits structured results, and tears down without touching external services.
existing local pattern: `packages/dialer-server` already owns `db:migrate` and local runtime validation; workspace engineering guidance prefers service-backed `dev` tooling. Exact reusable helpers/locations will be confirmed before implementation.
new or changed tests: focused harness tests for isolated ports/data paths, deterministic seed generation, migration/benchmark command orchestration, structured output, and teardown/error cleanup; add integration proof with real local PostgreSQL/Redis outside the ordinary unit suite.
focused red command: to be finalized after locating the closest existing test runner; expected to target a new dialer-server local-lab test only.
expected red failure: the lab module/command does not yet exist, so the focused contract should fail on missing import/command or missing generated plan before implementation.
no-test waiver: not applicable.

## current status

- D0 implementation and validation are complete; no production infrastructure or credentials were touched.
- The local lab provisions isolated PostgreSQL 16 + Redis, migrates the real dialer schema, runs deterministic synthetic benchmarks, and tears both services/data down.
- Final post-fix validation: `lab:verify` 1/1 passed; dialer-server 142 passed / 1 intentional skip; typecheck passed; build passed; strict review has zero D0 findings; canonical verify is publish-valid.
- D0 remains intentionally independent of OS rollout and Twenty cleanup.

## files changed

- `packages/dialer-server/README.md`
- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`


## workspace-owned: files changed

- `packages/dialer-server/README.md`
- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`

## workspace-owned: activity log

- 2026-08-15 02:23:16 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:24:40 fs.write: `packages/dialer-server/src/lab/local-dialer-lab.test.ts`
- 2026-08-15 02:24:49 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:26:06 fs.write: `packages/dialer-server/src/lab/local-dialer-lab.ts`
- 2026-08-15 02:26:15 fs.write: `packages/dialer-server/src/lab/local-dialer-lab.test.ts`
- 2026-08-15 02:26:50 fs.write: `packages/dialer-server/scripts/local-dialer-lab.ts`
- 2026-08-15 02:34:47 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:36:21 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:36:52 fs.write: `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- 2026-08-15 02:37:10 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:41:08 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:42:57 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:45:24 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/write-probe.txt`
- 2026-08-15 02:45:51 fs.write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
- 2026-08-15 02:50:20 fs.trash: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/write-probe.txt`

## workspace-owned: validation evidence

- 2026-08-15 02:38:06 `review.run`: passed — OK
- 2026-08-15 02:42:07 `review.run`: passed — OK
- 2026-08-15 02:49:45 `review.run`: passed — OK
- 2026-08-15 03:10:54 `review.run`: passed — OK
- 2026-08-15 03:10:55 `review.run`: passed — OK
- 2026-08-15 03:12:01 `review.run`: passed — OK
- 2026-08-15 03:12:11 `review.run`: passed — OK
- 2026-08-15 03:12:41 `review.run`: passed — OK
- 2026-08-15 03:12:54 `verify`: passed — OK
- 2026-08-15 03:13:25 `verify`: passed — OK

## key decisions

- The lab must be provider-free and production-safe: synthetic data only, local Postgres/Redis only.
- Performance numbers are observational by default; correctness and deterministic behavior are the required PR gates.
- Do not introduce a second package-manager migration or CI redesign in D0.

## notes for ko

- D0 can proceed in parallel with current OS work because it stays inside the dialer task worktree and local services.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 02:23:16 write: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`

- 2026-08-15 02:24:40 write: `packages/dialer-server/src/lab/local-dialer-lab.test.ts`

### RED evidence

- `bun test packages/dialer-server/src/lab/local-dialer-lab.test.ts` fails as expected because `./local-dialer-lab` does not exist yet.
- Focused RED contract is now established before production implementation.

- 2026-08-15 02:24:49 append: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/local-service-harness.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- `packages/dialer/src/types.ts`
- `packages/workspace/TOOLS.md`

- 2026-08-15 03:13:19 apply-patch: `.task/dialer/local-dialer-postgres-redis-benchmark-lab/workpad.md`
