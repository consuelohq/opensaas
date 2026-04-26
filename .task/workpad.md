# fix pr 198 review findings

branch: task/dialer/fix-pr-198-review-findings
stream: stream/dialer
pr: 200
review pr: 198
started: 2026-04-26

## acceptance criteria

- [x] start a fresh task from stream/dialer.
- [x] read AGENTS.md and CODING-STANDARDS.md before editing.
- [x] fetch codex review comments for PR #198 with pr-review.
- [x] fix frontend polling so non-ok status responses stop polling and fail/clear dial state instead of looping forever.
- [x] fix provider-denied customer call classification so message-only Twilio geo/account authorization failures still map to 400.
- [x] add or update focused tests for both review findings.
- [x] run focused validation and review/typecheck where available.
- [ ] publish with task:push, task:pr, task:prs, and task:finish.
- [ ] ship review PR #198 to main, wait for deploy, check railway, test production, then compact.

## plan

1. inspect current frontend polling and backend provider classification code on stream/dialer.
2. patch only the two codex p1 review findings.
3. add/update focused tests around non-ok polling and message-only provider denial.
4. run focused tests plus review/typecheck as far as the branch allows.
5. publish into stream/dialer and ship review PR #198.
6. wait for deploy, check railway status/logs, run browser verification, and draft compact.

## files changed

- packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts
- packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts

## key decisions

- frontend non-ok status polling now clears the poll interval, terminates the remote group, and fails the current batch using a local polling-closure copy of the last known calls.
- avoided useRef for last-known active calls because review enforces twenty/no-state-useref.
- backend provider-denied fallback now recognizes message-only geo/account authorization denials when the dialer layer drops Twilio error code metadata.

## validation

- passed: yarn prettier --write on all changed files.
- passed: git diff --check.
- passed: yarn jest --config packages/twenty-front/jest.config.mjs useParallelDialer.test.ts --runInBand --no-coverage.
- blocked: yarn jest --config packages/twenty-server/jest.config.mjs parallel.service.spec.ts --runInBand --no-coverage cannot resolve @nestjs/common in the linked local server test environment.
- passed for my changes: bun run review -- --base origin/stream/dialer --no-tests --json --quiet returned yours: [].
- blocked/pre-existing: review/typecheck still reports older stream issues in twenty-front/twenty-server and twenty-shared relative-date utilities.

## notes for ko

- stream:sync with main currently has a code conflict in useParallelDialer.test.ts; this task is patching current stream/dialer review findings without resolving the main-sync conflict.

## improvements noticed

- task scripts still break when unrelated worktrees contain malformed .task/current.json from sync conflicts.

## errors i ran into

- stream:sync hit conflicts in .task/current.json, .task/workpad.md, and useParallelDialer.test.ts.
- repaired only malformed metadata in the sync-conflict worktree so task scripts could locate the active dialer task.

- 2026-04-26 22:35:17 write: `.task/workpad.md`