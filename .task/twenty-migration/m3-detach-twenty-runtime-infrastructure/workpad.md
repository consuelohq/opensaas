## Test-first contract

behavior under test: Consuelo-owned executable/deploy entry points no longer start, deploy, generate, or automatically publish the legacy Twenty runtime while the Twenty source tree remains available for M4.
existing local pattern: packages/workspace static architecture/workflow contract tests read repository manifests and workflows directly with Vitest; Consuelo CI already treats dialer-server as the current backend and builds packages/dialer-server/Dockerfile.
new or changed tests: packages/workspace/tests/twenty-migration-runtime-boundary.test.ts will guard root start/Compose, CLI command registration/generator output, Cursor bootstrap, and legacy Docker workflow triggers.
focused red command: yarn vitest run packages/workspace/tests/twenty-migration-runtime-boundary.test.ts
expected red failure: current root start/Compose, CLI dev/deploy/generator, Cursor bootstrap, and automatic legacy image workflow still contain Twenty executable references.
no-test waiver: not applicable.

Scope decisions:
- keep packages/twenty-* physically present for M4; legacy Twenty CI may remain only when scoped to packages/twenty-*.
- remove obsolete consuelo dev/deploy registrations rather than silently redefining them around monorepo-only deployment paths.
- root local development becomes Postgres + Redis through docker-compose.yml and dialer-server through the root start script.
- keep Yarn as the root dependency manager; Bun lockfile/package-manager cutover remains M6.

## workspace-owned: files read

- `.vscode/launch.json`
- `.vscode/tasks.json`
- `.vscode/twenty.code-workspace`
- `packages/cli/package.json`
- `packages/cli/src/generators/env.ts`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/workspace/package.json`

## workspace-owned: validation evidence

- 2026-08-15 07:55:30 `review.run`: passed — OK
- 2026-08-15 07:55:45 `verify`: failed — COMMAND_FAILED
- 2026-08-15 07:56:32 `review.run`: passed — OK
- 2026-08-15 07:56:54 `verify`: passed — OK

## M3 validation summary

- RED proof: 5/5 runtime-boundary contracts failed before production edits for the expected Twenty executable paths.
- GREEN proof: 5/5 runtime-boundary contracts pass after detachment.
- inherited CLI suite: 10/10 tests pass (8 OS auth + 2 M2 isolation contracts).
- CLI TypeScript: `npx tsc --noEmit -p packages/cli/tsconfig.json` passes.
- CLI build: `yarn workspace @consuelo/cli build` passes.
- formatting and `git diff --check`: pass.
- Compose and edited workflow YAML parse successfully through the repository `yaml` package.
- active Consuelo executable scan finds no Twenty runtime references outside intentionally isolated legacy Twenty CI/rules.
- strict review: 0 M3 issues / 0 blockers; one non-blocking docs heuristic maps to the separate OS lifecycle CLI and is intentionally unchanged.
- canonical verify: publish-valid.
- environment limitation: Docker CLI is not installed in this task execution host, so `docker compose config` could not be executed. No Railway or production infrastructure was touched.

- 2026-08-15 07:57:04 append: `.task/twenty-migration/m3-detach-twenty-runtime-infrastructure/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 07:57:04 fs.write: `.task/twenty-migration/m3-detach-twenty-runtime-infrastructure/workpad.md`
