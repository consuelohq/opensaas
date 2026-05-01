# address dialer review comments

branch: `task/dialer/address-dialer-review-comments`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/257
started: 2026-05-01

## acceptance criteria

- [ ] Verify each requested inline/nitpick finding against current stream code before editing.
- [ ] Fix workspace phone number missing-relation matcher only if still brittle.
- [ ] Deduplicate PhoneNumber fixtures in workspace phone-number tests if duplication still exists.
- [ ] Debounce HomePage import-list name validation only if query still fires directly from `trimmedImportListName`.
- [ ] Log/report `createOpportunity` failures while preserving cleanup if catch still swallows errors.
- [ ] Extract HomePage modal styled components if still inline.
- [ ] Align parallel `getGroupFromNumbers` filtering with `terminateGroup` if still needed.
- [ ] Scope `hasContactAttemptLedger` to the intended schema if still broad.
- [ ] Run focused tests/checks plus `workspace review.run` with a 10-minute timeout.
- [ ] Publish through `task.push`, `task.pr`, and `task.finish`.

## plan

1. Run decision-engine research once, then read each exact file section from the latest task branch.
2. Mark each finding verified/not-needed in this workpad.
3. Apply only verified fixes with minimal scope.
4. Run focused API/server/frontend checks and the longer review gate.
5. Self-review diff, push, update PR, and finish.

## files changed

-

## key decisions

- User explicitly requested verifying every finding against current code and only fixing still-valid items.

## notes for ko

- Task was started from current `stream/dialer` at source sha 37fece31, which includes the prior schema fallback and double-dial fallback tasks.

## improvements noticed

-

## errors i ran into

-

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-01 05:00:21 write: `.task/workpad.md`
- 2026-05-01 05:04:22 patch lines 62-70: `packages/api/src/services/workspace-phone-numbers.ts`
- 2026-05-01 05:04:57 patch lines 72-76: `packages/api/src/services/workspace-phone-numbers.ts`
- 2026-05-01 05:05:25 patch lines 69-71: `packages/api/src/services/workspace-phone-numbers.ts`
- 2026-05-01 05:05:39 patch lines 66-71: `packages/api/src/services/workspace-phone-numbers.ts`
- 2026-05-01 05:11:52 patch lines 141-144: `packages/twenty-front/src/pages/home/HomePage.tsx`
## verification notes

- Verified `workspace-phone-numbers.ts` still used an exact missing-relation string before fixing.
- Verified `workspace-phone-numbers.spec.ts` still duplicated the PhoneNumber fixture before adding `createDialerNumber`.
- Verified `HomePage.tsx` still queried duplicate names from `trimmedImportListName`, swallowed `createOpportunity` errors, and declared modal styled components inline before fixing.
- Verified `parallel.service.ts` still used `.filter((fromNumber) => fromNumber.length > 0)` before changing it to `.filter(Boolean)`.
- Verified `queues.service.ts` still checked `contact_attempt_ledger` without a schema filter before adding `table_schema = current_schema()`.

## implementation notes

- Broadened `isWorkspacePhoneNumbersRelationError` with a case-insensitive regex and Postgres `42P01` code support while preserving the existing function name and `err instanceof Error` guard.
- Added a `createDialerNumber` spec fixture factory and updated both workspace phone-number tests to use it.
- Added debounced import-list name validation in HomePage using `useDebounce`, and disabled Continue while the debounced validation is pending.
- Replaced the swallowed `createOpportunity` catch with `captureException` while preserving `setIsCreatingImportList(false)` in `finally`.
- Moved HomePage import-list modal styled components into `home-page.styles.ts` with identical style definitions.
- Changed `getGroupFromNumbers` to use `.filter(Boolean)`.
- Scoped `hasContactAttemptLedger` to `current_schema()`.

## validation

- passed: `npx jest packages/api/src/services/workspace-phone-numbers.spec.ts --config=packages/api/jest.config.mjs --runInBand`.
- passed: `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand`.
- passed: `workspace checkFiles` for changed `.ts` files. Direct `.tsx` check is unsupported by `node --check` and fails on file extension, so HomePage is covered by Prettier and targeted ESLint instead.
- passed: `npx prettier --check` for all changed source/spec/style files.
- passed: `git diff --check`.
- passed: targeted ESLint for API and HomePage files, with only Nx project graph warnings.
- blocked: targeted `parallel.service.spec.ts` is blocked by existing `@nestjs/common` module resolution in that spec.
- blocked: `workspace review.run { base: stream/dialer, noTests: true }` timed out twice, including the requested 10-minute timeout after final cleanup.
- not changed: server service type-import ESLint findings were left alone because those constructor-injected Nest services may require runtime value imports for metadata; this is outside the requested review comments.

- 2026-05-01 05:16:44 append: `.task/workpad.md`
## verification notes

- Verified `workspace-phone-numbers.ts` still used an exact missing-relation string before fixing.
- Verified `workspace-phone-numbers.spec.ts` still duplicated the PhoneNumber fixture before adding `createDialerNumber`.
- Verified `HomePage.tsx` still queried duplicate names from `trimmedImportListName`, swallowed `createOpportunity` errors, and declared modal styled components inline before fixing.
- Verified `parallel.service.ts` still used `.filter((fromNumber) => fromNumber.length > 0)` before changing it to `.filter(Boolean)`.
- Verified `queues.service.ts` still checked `contact_attempt_ledger` without a schema filter before adding `table_schema = current_schema()`.

## implementation notes

- Broadened `isWorkspacePhoneNumbersRelationError` with a case-insensitive regex and Postgres `42P01` code support while preserving the existing function name and `err instanceof Error` guard.
- Added a `createDialerNumber` spec fixture factory and updated both workspace phone-number tests to use it.
- Added debounced import-list name validation in HomePage using `useDebounce`, and disabled Continue while the debounced validation is pending.
- Replaced the swallowed `createOpportunity` catch with `captureException` while preserving `setIsCreatingImportList(false)` in `finally`.
- Moved HomePage import-list modal styled components into `home-page.styles.ts` with identical style definitions.
- Changed `getGroupFromNumbers` to use `.filter(Boolean)`.
- Scoped `hasContactAttemptLedger` to `current_schema()`.

## validation

- passed: `npx jest packages/api/src/services/workspace-phone-numbers.spec.ts --config=packages/api/jest.config.mjs --runInBand`.
- passed: `npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand`.
- passed: `workspace checkFiles` for changed `.ts` files. Direct `.tsx` check is unsupported by `node --check` and fails on file extension, so HomePage is covered by Prettier and targeted ESLint instead.
- passed: `npx prettier --check` for all changed source/spec/style files.
- passed: `git diff --check`.
- passed: targeted ESLint for API and HomePage files, with only Nx project graph warnings.
- blocked: targeted `parallel.service.spec.ts` is blocked by existing `@nestjs/common` module resolution in that spec.
- blocked: `workspace review.run { base: stream/dialer, noTests: true }` timed out twice, including the requested 10-minute timeout after final cleanup.
- not changed: server service type-import ESLint findings were left alone because those constructor-injected Nest services may require runtime value imports for metadata; this is outside the requested review comments.

- 2026-05-01 05:16:44 append: `.task/workpad.md`