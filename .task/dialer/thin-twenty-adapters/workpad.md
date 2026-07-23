

## Acceptance criteria

- [x] Preserve GraphQL mutation names, DTOs, callback/TwiML URLs, scenario modes, allowlists, redaction, workspace ownership, persistence, capacity, and locks.
- [x] GraphQL and REST adapters invoke shared dialer application contracts exactly once.
- [x] Generic start/callback lifecycle behavior lives in packages/dialer; Twenty retains repository/auth/Nest translation only.
- [x] Twenty repository implementations propagate workspace identity and satisfy explicit application ports.
- [x] Typed dialer failures map to existing Nest GraphQL/HTTP errors.
- [x] PR #1592 lifecycle and PR #1593 domain/Effect suites pass unchanged.
- [x] Complete dialer, affected Twenty, resolver/controller, and legacy API tests pass.
- [ ] Typecheck/build/review/verify pass; task merges into stream/dialer; no live call is placed.

## Plan

1. Characterize the current adapters with exact-once and boundary tests.
2. Add a transport-independent start-call orchestration contract and callback lifecycle contract in packages/dialer.
3. Implement explicit Twenty repositories/adapters for target, queue, call-row, caller-ID, locks, strategy, telemetry, and provider runtime concerns.
4. Reduce DialerCallStartService and ParallelService to input/error/log translation around shared use cases.
5. Preserve existing resolver/controller contracts and run the full regression/verification ladder.

## Test-first contract

- Behavior under test:
  - GraphQL input plus workspace/user context reaches one shared start application invocation.
  - Twilio payload reaches one shared callback application invocation after the existing signature guard boundary.
  - every Twenty persistence operation receives the authenticated workspace identity.
  - typed provider/state/transition failures preserve current public Nest errors.
  - Twenty adapters do not claim winners, interpret AMD, terminate losing legs, or claim telemetry themselves.
  - Twenty repository implementations structurally satisfy package dialer port contracts.
- Existing pattern:
  - packages/dialer/src/application/parallel-application.spec.ts uses deterministic Effect Layers.
  - existing Twenty service/resolver specs preserve public behavior and repository SQL contracts.
- New/changed tests:
  - package application adapter contracts for start and callback orchestration.
  - Twenty adapter tests for exact-once delegation, workspace propagation, and typed error mapping.
  - new ParallelController contract spec for payload translation and one service invocation.
- Focused red command:
  - dialer application adapter specs plus affected Twenty adapter specs through their existing Jest configs.
- Expected red failure:
  - shared start/callback application facade and explicit Twenty port adapters do not exist; current ParallelService still performs callback lock/telemetry lifecycle locally.
- No-test waiver: none.

## Baseline validation

- packages/dialer: 13 suites, 153/153 tests passed.
- Twenty dialer services/resolver/signature guard: 4 suites, 41/41 tests passed.
- Legacy packages/api parallel adapter: 1 suite, 3/3 tests passed.
- No live call was placed.

- 2026-07-23 19:18:51 write: `packages/dialer/src/application/adapter-application.spec.ts`

## files changed

- `packages/dialer/src/application/adapter-application.spec.ts`
- `packages/dialer/src/application/parallel-compatibility-application.ts`
- `packages/dialer/src/application/process-parallel-callback.ts`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`
- `packages/dialer/src/ports/parallel-compatibility.ts`
- `packages/twenty-server/jest.dialer-source-resolver.cjs`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-adapter-boundary.contract.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`

## workspace-owned: files changed

- `packages/dialer/src/application/adapter-application.spec.ts`
- `packages/dialer/src/application/parallel-compatibility-application.ts`
- `packages/dialer/src/application/process-parallel-callback.ts`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`
- `packages/dialer/src/ports/parallel-compatibility.ts`
- `packages/twenty-server/jest.dialer-source-resolver.cjs`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-adapter-boundary.contract.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`

## workspace-owned: activity log

- 2026-07-23 19:18:51 fs.write: `packages/dialer/src/application/adapter-application.spec.ts`
- 2026-07-23 19:19:43 write: `packages/dialer/src/ports/dialer-call-start.ts`
- 2026-07-23 19:19:43 fs.write: `packages/dialer/src/ports/dialer-call-start.ts`
- 2026-07-23 19:20:01 write: `packages/dialer/src/application/start-dialer-call.ts`
- 2026-07-23 19:20:01 fs.write: `packages/dialer/src/application/start-dialer-call.ts`
- 2026-07-23 19:20:19 write: `packages/dialer/src/ports/parallel-compatibility.ts`
- 2026-07-23 19:20:19 fs.write: `packages/dialer/src/ports/parallel-compatibility.ts`
- 2026-07-23 19:20:30 write: `packages/dialer/src/application/process-parallel-callback.ts`
- 2026-07-23 19:20:30 fs.write: `packages/dialer/src/application/process-parallel-callback.ts`
- 2026-07-23 19:21:57 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- 2026-07-23 19:21:57 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- 2026-07-23 19:23:04 write: `packages/twenty-server/jest.dialer-source-resolver.cjs`
- 2026-07-23 19:23:04 fs.write: `packages/twenty-server/jest.dialer-source-resolver.cjs`
- 2026-07-23 19:24:29 write: `packages/dialer/src/ports/parallel-compatibility.ts`
- 2026-07-23 19:24:29 fs.write: `packages/dialer/src/ports/parallel-compatibility.ts`
- 2026-07-23 19:25:04 write: `packages/dialer/src/application/parallel-compatibility-application.ts`
- 2026-07-23 19:25:04 fs.write: `packages/dialer/src/application/parallel-compatibility-application.ts`
- 2026-07-23 19:25:23 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- 2026-07-23 19:25:23 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- 2026-07-23 19:27:48 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- 2026-07-23 19:27:48 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- 2026-07-23 19:28:51 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.spec.ts`
- 2026-07-23 19:28:51 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.spec.ts`
- 2026-07-23 19:29:07 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-adapter-boundary.contract.spec.ts`
- 2026-07-23 19:29:07 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-adapter-boundary.contract.spec.ts`

## workspace-owned: validation evidence

- 2026-07-23 19:33:16 `review.run`: passed — OK
- 2026-07-23 19:34:20 `review.run`: passed — OK

## workspace-owned: files read

- none yet


## Implementation summary

- Added transport-independent Effect application contracts for dialer starts and parallel compatibility operations in `packages/dialer`.
- Added explicit target, call-row, runtime, lock, provider, strategy, state, telemetry, and workspace-aware port contracts.
- Moved direct/queue orchestration, capacity calculation, caller-ID coordination, callback lock release, telemetry claiming, status projection, TwiML lifecycle, and termination decisions into `packages/dialer`.
- Reduced `DialerCallStartService` and `ParallelService` to Nest compatibility adapters that run shared Effects and translate typed failures, logs, Sentry context, and public responses.
- Added Twenty infrastructure implementations for SQL/contact/queue/call-row persistence, scenario modes, allowlists, provider construction, Redis/state, caller-ID locks, strategy resolution, and posterior telemetry.
- Preserved GraphQL mutation names and DTOs, REST/Twilio URLs, Twilio signature guard, scenario modes, safe-number behavior, workspace ownership, and legacy imperative service methods.
- Added exact-once resolver/controller tests and source-boundary ratchets preventing winner, AMD, losing-leg termination, telemetry claim, or lock decisions from returning to transport adapters.

## Final validation evidence

- Complete `packages/dialer`: 14 suites, 157/157 tests passed.
- Twenty start/parallel services, resolver, REST controller, signature guard, and architecture contract: 6 suites, 49/49 tests passed.
- Legacy `packages/api` parallel adapter: 1 suite, 3/3 tests passed.
- `packages/dialer` typecheck: passed.
- `packages/dialer` build: passed.
- `twenty-server` Nx build: passed; Nest compiled 4,892 files with SWC.
- Task-local source-mapped Twenty typecheck: zero errors in every changed adapter path.
- Repository review: zero introduced issues and zero blockers.
- Project-wide Twenty typecheck remains red only in the inherited Twenty baseline outside changed paths.
- DEV-1605 reproduced: ESLint references the deleted `packages/twenty-eslint-rules` package; no lint weakening or package restoration was performed.
- No live Twilio call was placed.

## Known gaps and non-goals

- The old `packages/api` parallel adapter remains for compatibility and was not used as the architectural foundation.
- No Hono/Bun server, Railway deployment, Worker deployment, LeadConnector extraction, embedded UI, or GraphQL-to-REST migration was attempted.
- The project-wide Twenty typecheck and ESLint baseline remain externally blocked by inherited repository issues; the production build and all changed-path checks pass.
