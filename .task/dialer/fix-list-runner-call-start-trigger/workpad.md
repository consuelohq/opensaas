# fix list runner call start trigger

branch: `task/dialer/fix-list-runner-call-start-trigger`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/539/fix-list-runner-call-start-trigger
github pr: https://github.com/consuelohq/opensaas/pull/539
started: 2026-05-23

## acceptance criteria

- [ ] Fresh list runtime queue that reaches `calling` fires exactly one `StartDialerCall` request for the active runtime queue.
- [ ] Preserve the existing person-id queue item fix; do not reintroduce ListMember IDs as queue contact IDs.
- [ ] Add/update focused regression coverage for the frontend runner trigger path.
- [ ] Validate with focused formatting/tests and deployed production evidence if shipped.

## implementation plan

1. Read prior context for dialer queue/list-runner fixes and the latest production evidence.
2. Use decision/explore to identify the smallest frontend trigger path causing `calling` without `StartDialerCall`.
3. Read the relevant hook/test code before editing.
4. Patch only the minimal runner trigger logic and add regression coverage.
5. Run focused validation, review/diff, publish through task workflow, deploy, and production-test the approved safe list path.

## files changed

- none yet

## key decisions

- Start from `main` because stream/dialer has already been merged and synced.
- Current production symptom after the previous ship: fresh queue item is `calling` with correct person ID, but browser network has no `StartDialerCall` for the fresh queue.

## notes for Ko

- Approved live follow-up after the clean queue proof.

## improvements noticed

- none yet

## errors or blockers

- `fs.write` without force failed because task.start had already created the scoped workpad. Recovered with force overwrite to preserve required sections.

## validation commands and results

- pending

- 2026-05-23 19:49:19 write: `.task/dialer/fix-list-runner-call-start-trigger/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-23 19:49:19 fs.write: `.task/dialer/fix-list-runner-call-start-trigger/workpad.md`
- 2026-05-23 20:00:04 fs.write: `.task/dialer/fix-list-runner-call-start-trigger/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 19:58:29 `review.run`: passed — OK
- 2026-05-23 19:59:43 `verify`: failed — COMMAND_FAILED

---

## implementation update

- Added `getBackendQueueContactId` and `isBackendQueueContactIdMatch` helpers so list queue creation, queue item hydration, current-index sync, and failure-state updates all use the same ID semantics.
- Updated `useOpportunityQueueWorkspace` to hydrate backend queue items by `record.personId ?? record.id` instead of always using the ListMember record id.
- Updated the direct contact mapping and failed-item backend source update to use the real backend contact id.
- Added focused tests proving backend queue matching uses the person id when present and does not accidentally match the ListMember id.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- `packages/twenty-front/src/modules/dialer/utils/backend-queue-session.ts`
- `packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts`

## key decisions

- The first proven remaining blocker was a split-brain ID lookup: backend queue rows now store person IDs after the previous fix, but frontend hydration still looked them up by ListMember IDs.
- The minimal fix is to centralize the queue contact id helper and use it everywhere frontend code crosses the list-member/backend-queue boundary.
- Did not broaden scope to the pre-existing lint/typecheck debt in `useOpportunityQueueWorkspace.ts` or `twenty-sdk` story optional dependencies.

## validation commands and results

- `npx prettier --write packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts packages/twenty-front/src/modules/dialer/utils/backend-queue-session.ts packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts`: passed.
- `npx jest --config=packages/twenty-front/jest.config.mjs --runInBand packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts packages/twenty-front/src/modules/dialer/hooks/__tests__`: passed, 6 suites / 39 tests.
- `npx prettier --check packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts packages/twenty-front/src/modules/dialer/utils/backend-queue-session.ts packages/twenty-front/src/modules/dialer/utils/__tests__/backend-queue-session.test.ts`: passed.
- `git diff --check`: passed.
- `review.run --base origin/main --noTests`: ok for changed files (`yours: []`); reports pre-existing lint/typecheck issues in `useOpportunityQueueWorkspace.ts` and `twenty-sdk` optional story dependencies.
- `verify --base origin/main --noDb`: failed on the same pre-existing review/typecheck/broad twenty-front test failures; no changed-file findings.

## errors or blockers

- `git.diff` typed tool returned zero changes, but task worktree `git status` showed the expected changed files. Used task-scoped `git status`/`git diff --stat` via `task.exec` as recovery evidence.

- 2026-05-23 20:00:04 append: `.task/dialer/fix-list-runner-call-start-trigger/workpad.md`
