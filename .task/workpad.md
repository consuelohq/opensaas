# fix parallel dial caller id conflict loop

branch: task/dialer/fix-parallel-dial-caller-id-conflict-loop
stream: stream/dialer
pr: 201
started: 2026-04-26

## acceptance criteria

- [x] start from stream/dialer.
- [x] inspect railway logs before browser testing.
- [x] reproduce the root cause from code: 409 caller_id_locked causes startparallelbatch false, autostarteditemidref reset, and retry loop.
- [x] move start sound so it only plays after a successful parallel group creation.
- [x] make startparallelbatch return a typed result instead of boolean.
- [x] handle 409 caller_id_locked as a blocked state that suppresses same-item autostart retries.
- [x] keep autostart blocked for the current item until queue item changes, skip/cancel/retry happens, or the queue is restarted.
- [x] add frontend tests for single post on 409 and no start sound on 409.
- [x] add backend logging/test coverage for caller_id_locked.
- [x] run focused tests and review.
- [ ] publish, merge, wait for railway deploy.
- [ ] verify in browser at the end with list 18 and railway logs open.

## plan

1. inspect railway status and targeted production logs before browser testing.
2. read the frontend/backend code ranges and caller-id lock implementation.
3. patch typed start result, delayed sound, blocked caller-id conflict handling, and same-item autostart suppression.
4. add focused frontend and backend coverage.
5. run prettier, focused tests, diff check, and review.
6. publish to stream/dialer, merge review pr, wait for railway deploy, verify logs and list 18 in browser.

## files changed

- packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts
- packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts
- packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts

## key decisions

- startparallelbatch now returns a discriminated result so caller-id conflicts are not collapsed into a generic false value.
- the dialing-started sound now plays only after the parallel group create response succeeds and a group id exists.
- caller_id_locked clears parallel state and returns a blocked result without reverting the queue item out of calling.
- the workspace hook uses the existing autostarteditemidref as the same-item block: blocked and failed typed results leave the guard set, while skipped results still clear it. skip, pause, resume, and restart already clear the guard intentionally.
- backend caller-id lock conflicts now emit a safe warning with queue id, user id, and only the caller-id suffix, plus retryaftermilliseconds in the conflict payload.

## validation

- passed: railway status/log inspection before browser testing. current deployed main was 61e5d10f before this task.
- passed: yarn prettier --write on changed frontend and backend files.
- passed: git diff --check.
- passed: yarn jest --config packages/twenty-front/jest.config.mjs useParallelDialer.test.ts --runInBand --no-coverage.
- blocked: yarn jest --config packages/twenty-server/jest.config.mjs parallel.service.spec.ts --runInBand --no-coverage fails before tests with cannot find module @nestjs/common from parallel.service.spec.ts.
- passed for my changes: bun run review -- --base origin/stream/dialer --no-tests --json --quiet returned yours: [].
- blocked/pre-existing: review/typecheck still reports existing twenty-shared relative date type errors and existing lint issues in the dialer migration files.

## notes for ko

- task tooling initially resolved dialer commands to stale pr #200 metadata inside a stream sync worktree. i changed only that stale metadata area to dialer-stale so the active task resolves to pr #201.
- no browser verification has run yet. browser comes after publish, merge, and railway deploy.

## improvements noticed

- task:fs should ignore stream worktrees or stale current task metadata entries whose worktreepath points somewhere else.
