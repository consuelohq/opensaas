# add post-call wrap-up auto advance UX

branch: `task/dialer/add-post-call-wrap-up-auto-advance-ux`
pr: https://github.com/consuelohq/opensaas/pull/610
graphite: https://app.graphite.com/github/pr/consuelohq/opensaas/610/add-post-call-wrap-up-auto-advance-ux
started: 2026-05-27

## product intent

After a call ends, the dialer should show a post-call wrap-up popup before moving to the next queue item.

- If auto advance is on: show call summary plus countdown `Starting next call in 3...2...1`, with Cancel.
- If auto advance is off: show the same call summary plus `Advance to Next Call`.
- The modal should have a checkbox/toggle that flips the user's auto-advance preference: auto mode offers turning auto advance off; manual mode offers turning auto advance on.
- If analysis/disposition requires manual input, block advance until manual disposition is selected.
- Prefer existing Twenty/fork UI components and patterns over bespoke styling.
- Write tests first, run the failing pretest, then implement the smallest code to pass.

## test-first discipline for this PR

1. State the behavior under test in this workpad before coding.
2. Write the test before implementation.
3. Run it and capture the failing output.
4. Implement only enough to make that behavior pass.
5. Refactor only after green tests.

## initial expected tests

- Post-call wrap-up modal renders call summary: contact name, duration, disposition.
- Auto-advance state renders countdown copy, Cancel, and a checkbox to turn auto advance off.
- Manual state renders Advance to Next Call and a checkbox to turn auto advance on.
- Cancel stops the pending advance and calls the cancel handler without stopping the queue.
- Manual disposition required state renders disposition choices and disables advance until a selection is made.

## implementation notes

Use `explore` before manual file reads. Reuse existing Twenty UI primitives where available. Keep PR 2 frontend-focused and consume the backend response contract from PR 1 (`committedDisposition`, `requiresManualDisposition`) if available in this branch/stream.

- 2026-05-27 02:59:04 write: `.task/dialer/add-post-call-wrap-up-auto-advance-ux/workpad.md`

## files changed

- `packages/twenty-front/src/modules/dialer/components/__tests__/PostCallWrapUpModal.test.tsx`
- `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`

## workspace-owned: files changed

- `packages/twenty-front/src/modules/dialer/components/__tests__/PostCallWrapUpModal.test.tsx`
- `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`

## workspace-owned: activity log

- 2026-05-27 02:59:04 fs.write: `.task/dialer/add-post-call-wrap-up-auto-advance-ux/workpad.md`
- 2026-05-27 03:03:07 write: `packages/twenty-front/src/modules/dialer/components/__tests__/PostCallWrapUpModal.test.tsx`
- 2026-05-27 03:03:07 fs.write: `packages/twenty-front/src/modules/dialer/components/__tests__/PostCallWrapUpModal.test.tsx`
- 2026-05-27 03:07:40 patch lines 159-169: `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`
- 2026-05-27 03:07:40 fs.patch: `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`
- 2026-05-27 03:07:53 patch lines 190-196: `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`
- 2026-05-27 03:07:53 fs.patch: `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`
- 2026-05-27 03:08:14 patch lines 252-252: `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`
- 2026-05-27 03:08:14 fs.patch: `packages/twenty-front/src/modules/dialer/components/OpportunityCallingWorkspace.tsx`

## workspace-owned: validation evidence

- 2026-05-27 03:09:10 `checkFiles`: failed — COMMAND_FAILED

## implementation progress

- Wrote `PostCallWrapUpModal` tests first and ran them before implementation. Initial run failed because the component did not exist, which confirmed the pretest was exercising the new behavior.
- Added `PostCallWrapUpModal` using existing project UI primitives: `Modal`, `Button`, and `Checkbox`.
- Added auto/manual/manual-disposition modal states with the opposite auto-advance checkbox behavior requested by Ko.
- Wired `OpportunityCallingWorkspace` to render the modal while `wrapUpState` is present.
- Removed the old no-answer hardcoded 1200ms auto-advance path so wrap-up/advance owns queue advancement.
- Restored `activeQueue.settings.autoAdvance` from backend/default queue settings instead of forcing it false.
- Hid the old analytics-tab inline wrap-up card from this workspace by passing `wrapUpState={null}` so the modal is the single wrap-up UX.

## validation

- Focused modal test: `yarn jest --config packages/twenty-front/jest.config.mjs packages/twenty-front/src/modules/dialer/components/__tests__/PostCallWrapUpModal.test.tsx --runInBand` — pass, 4 tests.
- Focused eslint on changed frontend files — pass.
- `yarn nx typecheck twenty-front` is currently blocked by pre-existing `twenty-sdk:build` missing optional story deps for Chakra/MUI, not by this task.
