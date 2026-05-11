# fix pr 359 review findings

branch: `task/dialer/fix-pr-359-review-findings`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/369
started: 2026-05-11

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-11 22:39:20 patch lines 14-18: `packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`
- 2026-05-11 22:39:28 patch lines 91-92: `packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`
- 2026-05-11 22:39:42 patch lines 90-98: `packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`
## PR 359 review findings

- Accepted: misleading `useApolloCoreClient` mock error message. Updated it to state that `useApolloCoreClient` was called and `useStartDialerCall` must use the default Apollo provider.
- Accepted: stale test description. Updated the `it()` string to describe the default Apollo provider.
- Accepted: test isolation nit. Added `beforeEach(() => jest.clearAllMocks())`.

## validation

- `npx prettier --check 'packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx'`: passed.
- `git diff --check`: passed.
- `npx jest --config=packages/twenty-front/jest.config.mjs --runInBand packages/twenty-front/src/modules/dialer/hooks/__tests__`: passed, 5 suites / 32 tests.
- `workspace review.run --base origin/stream/dialer --noTests`: returned ok for changed file; still reports pre-existing `twenty-sdk` optional Chakra/MUI story dependency typecheck blocker.
