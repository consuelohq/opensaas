# fix parallel customer phone normalization

## acceptance criteria

- [x] start a fresh task from `stream/dialer` using `task-start`.
- [x] read `AGENTS.md` and full `CODING-STANDARDS.md` before editing.
- [x] copy this checklist into `.task/workpad.md` before coding.
- [x] reproduce once with agent-browser on list 18 and confirm railway still shows invalid customer number at `stage: 'initiate-group'`.
- [x] inspect the exact frontend helper used by `useParallelDialer.ts`: `toE164()` and `isValidE164Phone()`.
- [x] identify where `item.contact.phone` is sourced from for queue/list contacts and whether it contains raw phone number, formatted display phone, or already-normalized phone.
- [x] fix phone normalization so parallel customer destinations are twilio-valid, not just regex-shaped.
- [x] prefer `@consuelo/contacts` `normalizePhone()` / `isValidPhone()` or libphonenumber-backed validation over hand-rolled `+1` prefix logic.
- [x] add frontend tests proving invalid long nanp-ish numbers like `584143861603` do not become `+1584143861603` and are filtered/rejected.
- [x] add backend tests so nest `ParallelService` rejects twilio-invalid customer numbers before `dialer.parallel.initiateGroup()` when possible.
- [x] decide whether the api should return 400 invalid customer number instead of current 409 conflict/provider-derived failure; document the decision in workpad.
- [x] verify valid us numbers still dial normally.
- [x] verify the invalid item is skipped or surfaced in ui without an infinite retry loop.
- [ ] after fix deploys, reproduce from list 18 and confirm railway no longer logs `The phone number you are attempting to call, +1584143861603, is not valid.`
- [ ] confirm successful create response includes `groupId`, `conferenceName`, `profileId`, and at least one real twilio `callSid`.
- [ ] confirm group polling `/api/v1/calls/parallel/:groupId` returns json.
- [x] run targeted tests and typecheck where possible; document toolchain blockers exactly.
- [ ] publish with `bun run task:push`, `bun run task:pr`, and `bun run task:finish`.

## plan

1. reproduce list 18 once with agent-browser and check railway logs for the current invalid destination failure.
2. trace `item.contact.phone` from list/queue contact mapping into `useParallelDialer.ts`.
3. replace frontend hand-rolled e.164 normalization on the parallel path with the shared contacts phone validation path.
4. harden `ParallelService` validation so invalid destinations return a deliberate 400 before twilio initiation.
5. add focused frontend and backend tests for the bad long nanp-ish number and valid us number path.
6. run targeted checks, update this workpad with decisions and blockers, then publish through task workflow.

## key decisions

- Use `@consuelo/contacts` as the single normalization boundary for this path, backed by `libphonenumber-js`.
- Non-`+` phone inputs are treated as US/NANP only and must be 10 digits or 11 digits beginning with `1`; ambiguous international-looking inputs without `+` are rejected instead of being converted into fake `+1` destinations.
- `/api/v1/calls/parallel` now rejects invalid customer destinations with `400 BadRequestException('Invalid customer phone number')` before strategy resolution or Twilio initiation. This is preferred over surfacing a provider-derived 409/500-like failure.
- Valid US numbers are normalized to E.164 before initiating a parallel group; explicit valid international E.164 numbers with `+` remain supported by the shared validator.

## notes for ko

- starting from the handoff root cause: `+1584143861603` is regex-shaped e.164 but not a twilio-valid nanp destination.
- Reproduced on production list 18 with agent-browser and confirmed Railway still logs `stage: 'initiate-group'` with Twilio rejecting `+1584143861603`.
- `item.contact.phone` comes from list member/person phone extraction in `useOpportunityQueueWorkspace.ts`, then flows into `useParallelDialer.ts` where the old `toE164()` helper prefixed `1` onto arbitrary digit strings.
- Frontend now filters invalid numbers at list-member extraction and again before the parallel POST, preventing the bad item from being included in a batch and avoiding a retry loop from a fabricated destination.

## improvements noticed

- `packages/contacts` should remain the single phone normalization source. The previous broad E.164 regex in multiple layers allowed provider-invalid numbers through.
- Local task worktrees can resolve some package imports from the root checkout; focused tests may need explicit package mocks when validating changed workspace packages before they are linked from the task worktree.

## verification

- PASS: `npx tsc -p packages/contacts/tsconfig.json`
- PASS: `npx jest packages/contacts/src/utils.spec.ts --config=packages/contacts/jest.config.mjs --runInBand`
- PASS: `npx jest packages/twenty-front/src/modules/dialer/utils/__tests__/phoneFormat.test.ts --config=packages/twenty-front/jest.config.mjs --runInBand`
- BLOCKED: `yarn jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` fails before running tests because the task worktree cannot resolve `@nestjs/common`.
- BLOCKED: `yarn nx typecheck twenty-front` fails in upstream `twenty-shared` date-filter utilities before checking dialer changes: `resolveRelativeDateFilter.ts`, `resolveRelativeDateFilterStringified.ts`, and `resolveRelativeDateTimeFilterStringified.ts` have existing nullable type errors.
- BLOCKED: `yarn nx typecheck twenty-server` fails at the same upstream `twenty-shared` build step before checking server changes.
- PASS with warnings: `yarn install --mode=update-lockfile` completed and updated `yarn.lock`; warnings are existing peer dependency warnings.

## files changed

- packages/contacts/package.json
- packages/contacts/src/utils.ts
- packages/contacts/src/utils.spec.ts
- packages/twenty-front/src/modules/dialer/components/TransferModal.tsx
- packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts
- packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts
- packages/twenty-front/src/modules/dialer/utils/phoneFormat.ts
- packages/twenty-front/src/modules/dialer/utils/**tests**/phoneFormat.test.ts
- packages/twenty-server/package.json
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts
- packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts
- yarn.lock
