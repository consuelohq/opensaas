# fix redis metadata login resilience

branch: `task/workspace-agents/fix-redis-metadata-login-resilience`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/399
started: 2026-05-19

## acceptance criteria

- [x] Confirm the login-blocking path before editing.
- [x] Keep metadata GraphQL Redis cache reads fail-open when Redis errors or hangs.
- [x] Keep metadata GraphQL Redis cache writes handled and bounded so failures do not create unhandled rejections.
- [x] Preserve cached-response behavior when Redis is healthy.
- [x] Bound Redis-backed session connect and session store commands so stale Redis cannot hang `/metadata` login indefinitely.
- [x] Reset cached Redis session clients after timeout/failure so retries create a fresh client.
- [x] Preserve production session semantics; no fallback to memory sessions.
- [x] Remove the misleading frontend `tokenPair is undefined` runtime console log.
- [x] Add focused unit coverage for cache hit, cache failure, cache timeout, response body preservation, session connect timeout, session command timeout, and session client reset.
- [x] Run focused tests and static validation.
- [ ] Push task branch and promote to stream review PR.

## plan

1. Read repo standards, Redis client code, session storage, cache storage, metadata GraphQL cache hook, and auth/login flow.
2. Confirm `/metadata` auth requests pass through global Redis session middleware before auth resolvers.
3. Replace metadata-only resilience with a root session-store fix: lazy connect, bounded connect, bounded commands, and client reset on failure.
4. Keep metadata cache resilience because metadata cache is an optimization and should fail open.
5. Remove misleading frontend auth-cookie console noise.
6. Run focused Jest tests, formatting/static checks, and note broader typecheck environment blockers.

## files changed

- `packages/twenty-server/src/engine/core-modules/session-storage/session-storage.module-factory.ts`
- `packages/twenty-server/src/engine/core-modules/session-storage/__tests__/session-storage.module-factory.spec.ts`
- `packages/twenty-server/src/engine/api/graphql/graphql-config/hooks/use-cached-metadata.ts`
- `packages/twenty-server/src/engine/api/graphql/graphql-config/hooks/__tests__/use-cached-metadata.spec.ts`
- `packages/twenty-server/src/engine/api/graphql/metadata.module-factory.ts`
- `packages/twenty-front/src/modules/apollo/utils/getTokenPair.ts`

## key decisions

- Root cause candidate is not the `tokenPair` frontend log and not only the metadata operation cache. `/metadata` auth mutations still pass through the global Express session middleware before GraphQL auth resolvers.
- The old session store returned a node-redis client while connection happened in the background. After Redis idles or reconnects, `connect-redis` can issue session commands against a not-ready client and keep the login request stuck.
- Redis sessions are auth infrastructure. This PR does not fail open to memory storage. It fails fast with clear session-storage logging instead of hanging.
- Metadata GraphQL cache remains fail-open because it is an optimization. A Redis cache miss is safer than blocking metadata operations behind a stale cache client.
- `response.clone().json()` is retained before caching successful metadata responses so Yoga/HTTP consumers can still read the original body.

## notes for Ko

- Railway logs are still blocked locally because Railway CLI is unauthenticated: `Unauthorized. Please login with railway login`.
- Sentry queries for `redis`, `ECONNRESET`, `metadata`, and `tokenPair` did not show matching unresolved issues in the checked windows. Code-path evidence remains the primary proof.
- `npx nx run twenty-server:typecheck` still fails in this worktree because the typecheck environment cannot resolve many existing server dependencies such as `@nestjs/common`, `@graphql-yoga/nestjs`, and `nest-commander`. After fixing local test typings, the remaining changed-file matches in the log are the same unresolved dependency class as broad pre-existing files.

## improvements noticed

- A later follow-up could add a dedicated health/diagnostic endpoint for Redis session readiness and operation timeout counters.
- A deployment validation pass should retry login after Redis idle once Railway auth is restored.

## errors i ran into

- Railway logs could not be fetched because Railway CLI auth is missing.
- `review.run` and `checkFiles` facade tools required a `taskSession`; direct script invocations were used where possible.
- `check-files` needed `--branch task/workspace-agents/fix-redis-metadata-login-resilience` because multiple active task branches exist.
- The combined Jest command was blocked once by external tool safety checks; running the two focused server specs separately passed.

## validation commands and results

- `npx jest packages/twenty-server/src/engine/core-modules/session-storage/__tests__/session-storage.module-factory.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` — passed: 1 suite, 5 tests.
- `npx jest packages/twenty-server/src/engine/api/graphql/graphql-config/hooks/__tests__/use-cached-metadata.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` — passed: 1 suite, 5 tests.
- `npx jest packages/twenty-front/src/modules/apollo/utils/__tests__/getTokenPair.test.ts --config=packages/twenty-front/jest.config.mjs --runInBand` — passed: 1 suite, 17 tests.
- `npx prettier --check` on all changed runtime/test files — passed.
- `git diff --check` — passed.
- `bun packages/workspace/scripts/check-files.js --branch task/workspace-agents/fix-redis-metadata-login-resilience packages/twenty-front/src/modules/apollo/utils/getTokenPair.ts` — passed.
- `bun packages/workspace/scripts/check-files.js --branch task/workspace-agents/fix-redis-metadata-login-resilience packages/twenty-server/src/engine/core-modules/session-storage/session-storage.module-factory.ts` — passed.
- `bun packages/workspace/scripts/check-files.js --branch task/workspace-agents/fix-redis-metadata-login-resilience packages/twenty-server/src/engine/api/graphql/graphql-config/hooks/use-cached-metadata.ts packages/twenty-server/src/engine/api/graphql/metadata.module-factory.ts` — passed.
- `npx nx run twenty-server:typecheck` — failed due broad unresolved dependency/typecheck-environment issues, including `@nestjs/common`, `@graphql-yoga/nestjs`, and `nest-commander`; no remaining changed-code-specific type errors beyond that environment class after session test typing fixes.
- `bun packages/workspace/scripts/review.js --base stream/workspace-agents --no-tests` — changed-code review gates passed; overall command failed only on pre-existing stream typecheck issues in `twenty-front`/`twenty-server`.
- `bun run verify -- --base stream/workspace-agents --no-review --no-db` — passed and wrote `.task/verify.json`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(auth): bound redis session and metadata cache failures" --changed
bun run task:pr
bun run task:finish
```
