# fix dialer production docker build type boundary

branch: `task/dialer/fix-dialer-production-docker-build-type-boundary`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1896/fix-dialer-production-docker-build-type-boundary
github pr: https://github.com/consuelohq/opensaas/pull/1896
started: 2026-08-12

## acceptance criteria

- [x] `@consuelo/dialer` production compilation excludes `*.test.ts` and `*.spec.ts` sources, so Bun-only test code cannot break or leak into published output.
- [x] The exact Dialer TypeScript build/typecheck boundary passes after the repair and the existing Dialer tests still pass.
- [x] The Twenty server dependency build path that previously failed on `redis-parallel-store.test.ts` no longer fails for Dialer typing.
- [x] Runtime dialing behavior is unchanged; this task changes build/test compilation boundaries only.
- [x] The unrelated `stream/dialer` sync conflicts in workspace test-selection files are not silently resolved in this task.

## plan

1. Reproduce the compiler including Bun-only Dialer tests and capture the failing/included source evidence.
2. Follow the existing repo build-config pattern to separate production compilation from test sources without teaching the published Dialer package about Bun globals.
3. Run the focused Dialer build/typecheck/test gates, then the affected Twenty server build path.
4. Inspect the diff, run strict review and full verify against `origin/main`, then publish the task branch.

## current status

- Discovery confirms `packages/dialer/tsconfig.json` includes all of `src`, which currently contains 16 `*.spec.ts`/`*.test.ts` files. `redis-parallel-store.test.ts` imports `bun:test` and uses `Bun.sleep`, matching the post-merge Docker failure.
- `packages/twenty-front/tsconfig.build.json` already establishes the local pattern of excluding test/spec sources from production compilation.
- `stream.sync` for `stream/dialer` was attempted first and stopped on five real workspace test-selection conflicts. Those conflicts are outside this repair; the task therefore starts from current `main` and validates against `origin/main`.
- Implementation is complete: the package now has a build-only TypeScript config, while the ordinary `tsconfig.json` continues to typecheck test sources.
- Focused and affected dependency builds are green; task is ready for strict review/verify.
- CodeRabbit correctly identified that the Nx `build` target still bypassed the package build script. A follow-up audit also found both Twenty production Dockerfiles directly running bare Dialer `tsc --declaration`. All production entrypoints now delegate to `yarn build`, making the package script and `tsconfig.build.json` the single build boundary.
- The full Docker Compose gate then proved the Dialer fix inside both server/worker images and exposed a separate latent compose defect: the server completed the Dialer build, started, and failed migration `CreateKnowledgeBase1773900000000` because the compose DB was plain `postgres:16` without the `vector` extension. The compose DB now uses the official PG16 pgvector image so the existing migration and local Docker topology agree.

## files changed

- `packages/dialer/project.json`
- `packages/twenty-docker/twenty/Dockerfile`
- `packages/twenty-docker/twenty/Dockerfile.worker`
- `packages/twenty-docker/docker-compose.yml`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-12 19:03:49 `review.run`: passed — OK
- 2026-08-12 19:05:33 `verify`: passed — OK
- Node-only build-program proof: `tsconfig.build.json` has 0 test/mock inputs and 0 diagnostics.
- General Dialer typecheck: pass; its normal config still covers 18 test/mock sources.
- Dialer test suite: 171 pass, 0 fail across 16 files.
- Dialer production build: pass; 172 emitted files, 0 test/mock artifacts.
- Twenty server dependency build: pass with cache disabled, including `@consuelo/dialer:build`.
- Strict review: 0 task-owned findings, 0 blockers. It reports 27 pre-existing repo findings (17 ESLint, 10 typecheck) and pre-existing missing `twenty-eslint-rules` ESLint module noise outside the task delta.
- Full verify against `origin/main`: passed, 3/3 selected suites green, DB scan clean, `publishValid: true`.
- 2026-08-12 19:06:21 `verify`: passed — OK
- 2026-08-12 19:06:42 `review.run`: passed — OK
- 2026-08-12 19:09:57 `verify`: passed — OK
- 2026-08-12 19:19:49 `review.run`: passed — OK
- 2026-08-12 19:21:34 `verify`: passed — OK
- 2026-08-12 19:41:10 `review.run`: passed — OK
- 2026-08-12 19:42:35 `verify`: passed — OK
- 2026-08-12 19:44:48 `verify`: passed — OK

## key decisions

- Fix the production/test compilation boundary rather than adding Bun typings just to make production `tsc` accept test-only code.
- Do not resolve unrelated `stream/dialer` workspace conflicts as part of this side quest.
- Use a dedicated `tsconfig.build.json` rather than exclusions in the general config. This preserves normal test typechecking (`18` test/mock sources remain in the general TypeScript program) while keeping production emit Node-safe and test-free.
- Route Nx and both Twenty Docker production builds through the package `yarn build` script instead of repeating TypeScript flags in three places. The package script is now the single source of truth for production Dialer compilation.
- Keep PostgreSQL 16 in Docker Compose while supplying the extension the server already requires. `pgvector/pgvector:pg16` derives from the matching PostgreSQL image and avoids making the application migration conditional on an invalid local database topology.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- `stream.sync` could not merge current `main` into `stream/dialer` because of real conflicts in workspace test-selection implementation/config/tests. No stream merge was completed. This task was isolated from `main` instead of widening scope.
- One parallel validation batch hit an MCP network error. It was retried as the smallest independent calls; the exact Twenty build and diff inspection then completed normally.
- Promotion preflight confirmed this is not a safe normal stream handoff: `stream/dialer...task` is diverged by 62/27 commits and about 300 files, and PR #1896 is `DIRTY`. By contrast `main...task` is cleanly ahead by two task commits with only the task metadata plus the two intended Dialer build files. The scope-preserving hotfix path is therefore to retarget this already-main-based task PR to `main`, not resolve unrelated stale-stream conflicts.
- The first PR CI `Consuelo / verify` failure was infrastructure-only: `oven-sh/setup-bun@v2` retried the Bun 1.3.14 download and failed on repeated `socket hang up` errors before repository verification began. A fresh task push will replace that stale CI result; the gate is not being bypassed.
- An Nx validation inspected an already-populated local `packages/dialer/dist` and saw stale test/mock artifacts left by earlier pre-fix bare `tsc` runs. The authoritative clean-output proof compiles into a fresh temporary directory: 172 production files emitted, 0 test/mock artifacts. Fresh Docker stages also start without those stale outputs.
- Docker Compose CI on the first production-entrypoint revision built both images past Dialer successfully, then the server exited at `CREATE EXTENSION IF NOT EXISTS vector` with `/usr/share/postgresql/16/extension/vector.control` missing. This is a pre-existing compatibility gap: the knowledge-base migration dates to April 2026 while `packages/twenty-docker/docker-compose.yml` had remained on plain `postgres:16` since before that migration. Touching the Twenty Dockerfiles caused CI to exercise the dormant compose path.
- Local Docker CLI validation is unavailable in the task runtime (`docker` is not in PATH). The actual GitHub Docker Compose workflow remains the authoritative runtime validation for the image change; local validation is limited to repo syntax/review/verify before pushing.

## Test-first contract

- Behavior under test: the production Dialer TypeScript compiler must not include Bun-only `*.test.ts` or `*.spec.ts` sources.
- Existing local pattern: `packages/twenty-front/tsconfig.build.json` explicitly excludes `*.test.*`, `*.spec.*`, `__tests__`, and mocks from build compilation.
- Changed test/config proof: use TypeScript's own `--listFiles`/diagnostics as the executable contract, then verify no test/spec file is in the production build program. A synthetic unit test would only duplicate TypeScript config resolution, so this config-only build repair uses that compiler proof instead of adding a product-behavior test.
- Focused red command: run `tsc -p packages/dialer/tsconfig.json --noEmit --listFiles` through the task-scoped command runner and summarize Dialer test/spec inclusion plus Bun diagnostics.
- Expected red: `redis-parallel-store.test.ts` is part of the program and the clean Node-oriented compiler reports missing `bun:test` / `Bun`, matching the Docker failure mode.
- RED evidence: ordinary local `--listFiles` included all 16 Dialer test/spec sources. The Node-oriented reproduction `npx tsc -p packages/dialer/tsconfig.json --noEmit --types node` failed exactly on `redis-parallel-store.test.ts` with missing `bun:test` and three missing `Bun` globals, reproducing the Docker failure class.
- First GREEN attempt excluded `*.spec.ts`/`*.test.ts` successfully but exposed the same boundary problem in `src/__mocks__/ioredis.ts` and `src/__mocks__/twilio.ts`: Node-only compilation then failed on Jest globals from those test-only mocks. The production exclusion therefore also needs the repo-standard `__mocks__` boundary.
- Final GREEN compiler proof: `npx tsc -p packages/dialer/tsconfig.build.json --noEmit --types node --listFiles` exits 0 with zero test/mock files and zero diagnostics.
- General typecheck preservation proof: `npx tsc -p packages/dialer/tsconfig.json --noEmit --listFiles` exits 0 and still includes 18 test/mock sources.
- `yarn workspace @consuelo/dialer typecheck`: pass.
- `bun test packages/dialer/src`: 171 pass, 0 fail across 16 files; destructive-literal preflight found zero findings.
- `yarn workspace @consuelo/dialer build`: pass, 172 emitted files, zero test/mock artifacts.
- Exact affected dependency path `npx nx run twenty-server:build --skip-nx-cache`: pass; `@consuelo/dialer:build` runs and the full Twenty server dependency build completes successfully.
- Review follow-up: `npx nx run @consuelo/dialer:build --skip-nx-cache` passes and shows the Nx target invoking `yarn build`.
- Review follow-up: both `packages/twenty-docker/twenty/Dockerfile` and `.worker` now invoke `yarn build` for Dialer; repository search finds no remaining production bare Dialer `tsc` invocation. The remaining `tsc --noEmit` in `project.json` is intentionally the test-inclusive typecheck target.
- Review follow-up fresh-output proof: `npx tsc -p tsconfig.build.json --declaration --outDir <fresh-temp>` emits 172 files and 0 test/mock artifacts.
- Review follow-up `npx nx run twenty-server:build --skip-nx-cache`: pass with `@consuelo/dialer:build -> yarn build`; no `bun:test`, `Bun`, or `redis-parallel-store.test.ts` diagnostics.
- Review follow-up Dialer suite: 171 pass, 0 fail, 362 assertions.
- Docker Compose failure evidence: `@consuelo/dialer:build -> yarn build` completed in-image; failure occurred later during server startup at migration `CreateKnowledgeBase1773900000000` because PostgreSQL could not load the `vector` extension.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/ci-test-docker-compose.yaml`
- `package.json`
- `packages/dialer/package.json`
- `packages/dialer/project.json`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/dialer/tsconfig.json`
- `packages/twenty-docker/docker-compose.yml`
- `packages/twenty-docker/twenty/Dockerfile`
- `packages/twenty-docker/twenty/Dockerfile.worker`
- `packages/workspace/scripts/lib/git.js`

- 2026-08-12 19:39:34 apply-patch: `packages/twenty-docker/docker-compose.yml`
- 2026-08-12 19:39:34 apply-patch: `.task/dialer/fix-dialer-production-docker-build-type-boundary/workpad.md`

- 2026-08-12 19:40:13 apply-patch: `.task/dialer/fix-dialer-production-docker-build-type-boundary/workpad.md`
