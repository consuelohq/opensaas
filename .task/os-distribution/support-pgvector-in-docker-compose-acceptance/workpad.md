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

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-25 17:28:13 `review.run`: passed — OK
- 2026-07-25 17:28:20 `verify`: passed — OK

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
