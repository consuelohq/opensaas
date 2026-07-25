# support pgvector in docker compose acceptance

branch: `task/os-distribution/support-pgvector-in-docker-compose-acceptance`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1660/support-pgvector-in-docker-compose-acceptance
github pr: https://github.com/consuelohq/opensaas/pull/1660
started: 2026-07-25

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/twenty-docker/docker-compose.yml`
- `packages/workspace/tests/docker-compose-pgvector.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-25 17:28:13 `review.run`: passed — OK
- 2026-07-25 17:28:20 `verify`: passed — OK
- 2026-07-25 17:45:22 `review.run`: passed — OK
- 2026-07-25 17:45:30 `verify`: passed — OK
- 2026-07-25 17:45:42 `verify`: passed — OK
- 2026-07-25 17:47:10 `verify`: passed — OK

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
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## goal

Make the canonical Docker Compose acceptance database support the existing knowledge-base migration's required `vector` extension, without changing application migration behavior.

## acceptance criteria

- [x] Add a failing repository contract proving the canonical Compose database image provides pgvector.
- [x] Change only the canonical database image/configuration needed by Docker Compose acceptance.
- [x] Preserve PostgreSQL compatibility and existing service wiring by using the same pgvector-capable image as repository CI database services.
- [x] Run focused contract, workflow policy, review, and full verification.
- [ ] Merge into `stream/os-distribution` before retrying PR #1651's Docker lane.

## test-first contract

The CI-owned `packages/twenty-docker/docker-compose.yml` database service must use the repository's established PostgreSQL image that includes pgvector; plain `postgres:16` is invalid because migration `CreateKnowledgeBase1773900000000` executes `CREATE EXTENSION IF NOT EXISTS vector`.

## observed failure

PR #1651's Docker Compose CI completed earlier migrations, then failed because `/usr/share/postgresql/16/extension/vector.control` did not exist in the plain PostgreSQL image.

## plan

1. Inspect canonical compose/workflow ownership and existing image precedent. CI resolves Compose from `packages/twenty-docker/`, so that file is the acceptance authority.
2. Add a focused red contract.
3. Replace only the incompatible database image.
4. Validate YAML, migration compatibility, review, and verify.

## validation evidence

- RED: `bunx vitest run packages/workspace/tests/docker-compose-pgvector.test.ts` failed because the CI-owned Compose database used `postgres:16`, which does not ship `vector.control`.

## files changed

- `packages/workspace/tests/docker-compose-pgvector.test.ts`
- `packages/twenty-docker/docker-compose.yml`

- GREEN: focused pgvector contract passed 1/1.
- GREEN: workflow policy plus pgvector contracts passed 5/5.
- GREEN: repository YAML parser resolved the database image as `twentycrm/twenty-postgres-spilo` with all four services intact.
- GREEN: strict review reported zero owned, pre-existing, or blocking findings (`trc_93873471bf9d`).
- GREEN: full verification is publish-valid with review and database guardrails passing (`trc_86d3f112d4e1`).
- ENVIRONMENT LIMIT: the local task lane has no Docker binary, so full Compose startup is delegated to the authoritative GitHub Docker Compose job after publication.

## remaining risk

- The pgvector-capable image follows the repository's existing CI precedent and defaults to its published tag. GitHub Compose acceptance must prove image pull, migrations, and service health before this task merges.

## bounded Compose acceptance wait

Start: 2026-07-25T17:41:10.699264+00:00
Wait reason: PR #1660 has zero failures and only the authoritative `CI Docker Compose / test` job remains; its current step is `Run compose`, started at 2026-07-25T17:29:44Z.
Duration: 30 seconds per poll, up to 3 additional polls.
Resume action: immediately query PR #1660 checks and the live job step.
Expected signal: Compose job completes successfully, proving image pull, migrations including `vector`, and service health.
Fallback: if it fails, extract the exact log tail; if it remains running after the bounded window, leave it unmerged and report the active gate.

- Poll 1 observed: still in `Run compose`, with checkout complete and no failures. The workflow allows 30 minutes and includes up to five minutes each for database and server health after image builds. Decision: continue bounded polling; do not merge without the live Compose signal.

- Poll 2 observed: still in `Run compose`, no failure or step transition. Elapsed time remains below the workflow's 30-minute cap; continue one final short poll before classifying it as an active long-running gate.


## authoritative Compose failure and correction

- RED live acceptance: GitHub built both application images successfully, then the database became unhealthy. `twentycrm/twenty-postgres-spilo` launched Patroni and failed with `PatroniFatalException: Can not find suitable configuration of distributed configuration store` (`trc_26c1178fd5c1`).
- Disposition: the image includes extensions but is an HA/Patroni image, not compatible with this standalone four-service Compose topology.
- Corrected contract: use the official standalone `pgvector/pgvector:0.8.5-pg16` image, pinning both pgvector and PostgreSQL major versions while retaining the standard Postgres environment and healthcheck contract.
- RED corrected contract: focused test failed 1/1 while Compose still used the incompatible Spilo image (`trc_5c2311aeb6fb`).

- GREEN corrected focused contracts after stream synchronization: workflow policy plus pgvector Compose contract passed 6/6 (`trc_6947bb5afb77`).
- GREEN corrected YAML contract: standalone image is exactly `pgvector/pgvector:0.8.5-pg16`; standard Postgres environment and `pg_isready` healthcheck remain intact (`trc_6985b59731f6`).
- GREEN corrected strict review: zero owned, pre-existing, or blocking findings (`trc_0010cb50b4d7`).
- GREEN corrected full verification: publish-valid against the current distribution stream including the dependency-cache repair (`trc_16a9a2569373`).
- Remaining authoritative gate: rerun GitHub `CI Docker Compose` on the corrected image and require successful database extension migration plus server health before merge.
