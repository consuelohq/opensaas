# fix stream server typecheck regressions

branch: `task/os/fix-stream-server-typecheck-regressions`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1929/fix-stream-server-typecheck-regressions
github pr: https://github.com/consuelohq/opensaas/pull/1929
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

- 2026-08-14 00:39:23 `review.run`: passed — OK
- 2026-08-14 00:41:06 `review.run`: passed — OK
- 2026-08-14 00:42:50 `verify`: failed — COMMAND_FAILED
- 2026-08-14 02:30:42 `verify`: failed — COMMAND_FAILED
- 2026-08-14 02:32:59 `review.run`: passed — OK
- 2026-08-14 02:34:07 `review.run`: passed — OK
- 2026-08-14 02:35:25 `verify`: failed — COMMAND_FAILED
- 2026-08-14 02:37:28 `review.run`: passed — OK
- 2026-08-14 02:38:50 `verify`: failed — COMMAND_FAILED
- 2026-08-14 02:39:35 `verify`: passed — OK
- 2026-08-14 02:39:54 `verify`: passed — OK

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

- CI Server on stream PR #1901 now fails only on two genuine new TypeScript diagnostics after #1924: `twenty-dialer-call-start.infrastructure.ts:179:32:TS2339` and `twenty-parallel.infrastructure.ts:40:11:TS2739`.
- Do not add these to the TypeScript baseline. Repair the source, then rerun the exact changed-server helper and focused server tests.

## workspace-owned: files read

- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/package.json`
- `packages/dialer/src/application/adapter-application.spec.ts`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/dialer.ts`
- `packages/dialer/src/errors/dialer-errors.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/ports/parallel-compatibility.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/parallel.controller.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-dialer-call-start.infrastructure.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-adapter-boundary.contract.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts`
- `packages/twenty-server/tsconfig.json`
- `tsconfig.json`

## implementation and validation

- Repaired the Twenty dialer-call adapter to consume `input.targets.length`, honor `preferLocalPresence`, and resolve distinct caller IDs from the remaining number pool using the canonical dialer-server algorithm.
- Added `retryPendingCleanup` delegation to the current parallel service. `startCallRecording` is an explicit typed unsupported capability in the Twenty compatibility adapter because Twenty has no recording-status webhook/persistence route; no fake callback URL was invented.
- Updated the existing live-path test fixture to mock and assert local-presence caller-ID resolution.
- Focused RED: adapter boundary contract failed on stale `input.targetCount` mapping (`trc_fae76bb25e3d`).
- Focused GREEN: dialer call-start + adapter-boundary suites 16/16 (`trc_1322004486ee`).
- Worktree dependency-resolution issue: shared `node_modules` points `@consuelo/dialer` at the main checkout. An ephemeral tsconfig mapped to this task worktree’s freshly built `packages/dialer/dist`; both repaired adapter files then had zero diagnostics (`trc_e0a855f01eb2`).
- Full standard TypeScript comparison under the correct task-local dialer declaration surface has zero unexpected diagnostics versus #1924 baseline; 75 historical diagnostics resolve and only 10 remain (`trc_735416e82fc8`).
## Final validation

- Repaired Twenty dialer adapter drift exposed by the new baseline-aware CI Server gate: caller-ID runtime now consumes `targets`/`preferLocalPresence`, parallel runtime implements the new recording/cleanup port members, and the live-path fixture verifies local-presence selection.
- Cleaned only mechanical lint debt in the two touched infrastructure files using the exact `packages/twenty-server/eslint.config.mjs` config; package-config ESLint is 0 errors / 0 warnings.
- Focused adapter tests: 2 suites, 16 tests passed.
- Full selected Twenty server suites: 447 suites / 3,526 tests passed in each selected target.
- Strict review: 0 task-owned blockers, 0 related pre-existing blockers.
- Guarded verify: `publishValid: true`, DB risk 0, verify stamp written.
- Known project-level typecheck finding remains classified pre-existing because task worktrees share main-checkout `node_modules`; task-local dialer declaration validation reported 0 unexpected diagnostics in the repaired adapter files.

