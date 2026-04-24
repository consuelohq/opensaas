# address parallel phone review comments

branch: `task/dialer/address-parallel-phone-review-comments`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/176
started: 2026-04-24

## acceptance criteria

- [x] start a fresh task from `stream/dialer`.
- [x] read `AGENTS.md` and the full `CODING-STANDARDS.md` before editing.
- [x] verify each review finding against current code before changing it.
- [x] make `normalizePhone()` return a number only when libphonenumber says the parse is valid.
- [x] pin `normalizePhone('+1584143861603') === ''` in contacts tests.
- [x] split the misleading `isValidPhone()` test into accepted US-without-plus and rejected non-US-without-plus cases.
- [x] surface invalid transfer phone input through the existing `StyledError` path.
- [x] clear transfer validation errors on successful normalization and input edits.
- [x] remove the manual `@consuelo/contacts` mock from `phoneFormat.test.ts`.
- [x] add `beforeEach(() => jest.clearAllMocks())` to `phoneFormat.test.ts`.
- [x] add a top-level `beforeEach(() => jest.clearAllMocks())` to `parallel.service.spec.ts`.
- [x] run focused tests and document blockers.
- [ ] publish with `task:push`, `task:pr`, and `task:finish`.

## verification notes

- confirmed `packages/contacts/src/utils.ts` still returned `parsedPhoneNumber?.number` for invalid `+` input; changed it to require `parsedPhoneNumber?.isValid() === true`.
- confirmed the contacts spec did not assert `normalizePhone('+1584143861603') === ''`; added it.
- confirmed the `isValidPhone('14155551234')` assertion was under a misleading rejection-oriented test name; split it into explicit accept/reject tests.
- confirmed `TransferModal` silently returned when `toE164(phoneNumber)` was `null`; added local `transferError`, displays it via `StyledError`, clears it on input change/success, and added the actual `disabled` attribute.
- confirmed `phoneFormat.test.ts` manually reimplemented `@consuelo/contacts`; removed that mock and mapped twenty-front jest to the real `packages/contacts/src/utils.ts` source so `toE164()` exercises the current implementation.
- confirmed `parallel.service.spec.ts` has module-level `jest.fn()` mocks; added top-level `jest.clearAllMocks()` before each test.

## commands run

- pass: `npx tsc -p packages/contacts/tsconfig.json`
- pass: `npx jest packages/contacts/src/utils.spec.ts --config=packages/contacts/jest.config.mjs --runInBand` — 22 tests
- pass: `npx jest packages/twenty-front/src/modules/dialer/utils/__tests__/phoneFormat.test.ts --config=packages/twenty-front/jest.config.mjs --runInBand` — 3 tests
- blocked: `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` still fails before executing tests because the task worktree cannot resolve `@nestjs/common`.
- blocked: `npx nx typecheck twenty-front` stops in upstream `twenty-shared` date-filter nullable type errors before reaching the touched front code.
- blocked: `npx nx typecheck twenty-server` stops in the same upstream `twenty-shared` date-filter nullable type errors before reaching the touched server code.
- blocked/noisy: `npx nx lint:diff-with-main twenty-front` lints the full stream-vs-main diff, not just this task; after fixing the task-specific issues it still reports existing stream failures in `useOpportunityQueueWorkspace.ts` and `phoneFormat.ts`.
- pass: `git diff --check` after replacing the generated placeholder workpad.

## files changed

- `.task/current.json`
- `.task/workpad.md`
- `.task/tasks/dialer/address-parallel-phone-review-comments.json`
- `packages/contacts/src/utils.ts`
- `packages/contacts/src/utils.spec.ts`
- `packages/twenty-front/jest.config.mjs`
- `packages/twenty-front/src/modules/dialer/components/TransferModal.tsx`
- `packages/twenty-front/src/modules/dialer/utils/__tests__/phoneFormat.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

## key decisions

- `normalizePhone()` is now safe as the single entry point: invalid parse results return `''`, not a merely parsed-but-invalid number.
- explicit international numbers remain supported when libphonenumber validates them.
- twenty-front jest resolves `@consuelo/contacts` to `packages/contacts/src/utils.ts` because current front usage only needs `normalizePhone` and `isValidPhone`, and resolving through root `node_modules` loads stale built output in task worktrees.
- `TransferModal` no longer imports icons; lint rules conflict between direct `@tabler/icons-react` and `twenty-ui/display`, and the accessible button labels already carry the meaning.
