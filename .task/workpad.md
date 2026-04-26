# fix queue walkthrough lifecycle

branch: task/dialer/fix-queue-walkthrough-lifecycle
stream: stream/dialer
pr: 197
started: 2026-04-25

## acceptance criteria

- [x] start a fresh task from stream/dialer.
- [x] read AGENTS.md and CODING-STANDARDS.md before editing.
- [x] copy the handoff acceptance criteria into .task/workpad.md before coding.
- [x] inspect frontend queue skip, active parallel group termination, polling cleanup, and backend queue state machine.
- [x] inspect backend parallel group status/termination and stuck-dialing behavior.
- [x] make skip terminate any active parallel group immediately when parallelGroupId exists.
- [x] stop polling when a group is skipped, terminated, or terminal.
- [x] clear frontend active calls and active queue parallelGroupId before advancing the queue.
- [x] ensure backend queue item skip/advance/exhaust behavior remains terminal and idempotent.
- [x] add frontend timeout for groups stuck in dialing.
- [x] add backend timeout/failsafe for stale dialing groups.
- [x] provider-denied classification was already shipped in PR 191; this task did not reopen it because the active failure was stale lifecycle after skip.
- [x] add focused tests for the fixed lifecycle path.
- [x] run focused validation and document review blocker.
- [ ] publish with task:push, task:pr, and task:finish.
- [ ] if merged/deployed during this session, verify clean 5-contact production walkthrough; otherwise leave exact production verification steps and evidence.

## files changed

- packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts
- packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts
- packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts
- packages/dialer/src/services/parallel-dialer.ts
- packages/dialer/src/services/parallel-dialer.spec.ts
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts

## key decisions

- skip now calls cancelParallelDial before queue skip so active parallel groups are terminated and local polling is cleared first.
- polling state moved from React state to refs so clearPoll can always stop the live interval.
- client polling treats completed/failed group status and terminal call statuses as terminal and also terminates groups that remain dialing for 60 seconds.
- backend parallel group lookup now completes stale dialing groups after 60 seconds as a failsafe.
- queue skip now completes the backend queue if skip exhausts all callable work with no suppression.

## validation

- passed: bun run task:exec -- --area dialer git diff --check
- passed: bun run task:exec -- --area dialer yarn jest --config packages/twenty-front/jest.config.mjs useParallelDialer.test.ts --runInBand --no-coverage
- passed: bun run task:exec -- --area dialer yarn jest --config packages/dialer/jest.config.mjs parallel-dialer.spec.ts --runInBand --no-coverage
- blocked: bun run review -- --base origin/stream/dialer --no-tests --quiet timed out twice in the tool window; bun run task:exec -- --area dialer bun run review -- --mine --json --quiet failed with the existing multiple active tasks detector.

## production proof

- not run yet. after publish/merge/deploy, use a clean 5-contact queue fixture, not List 18, and capture HAR plus Railway logs for start, skip, retry, exhaust, queue id, and group ids.

## errors i ran into

- initial large workpad write command was blocked by tool safety, so i rewrote the workpad with a smaller command.
- a test insertion initially landed in helper objects; corrected by reconstructing the focused test file.
- node_modules symlink is required for focused Jest inside the worktree, but removed before publish so it is not committed.

- 2026-04-25 23:59:37 write: `.task/workpad.md`