# address final dialer review comments

branch: `task/dialer/address-final-dialer-review-comments`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/258
started: 2026-05-01

## acceptance criteria

- [ ] Verify each requested finding against current `stream/dialer` code before editing.
- [ ] Fix HomePage import CSV open flow only if `fetchActiveOpportunities` rejection still escapes.
- [ ] Deduplicate `getGroupFromNumbers` only if it still returns duplicates.
- [ ] Change workspace phone-number missing relation test to identity assertion only if it still uses message matching.
- [ ] Run focused API/frontend/server validation.
- [ ] Publish task into `stream/dialer`.
- [ ] Merge stream PR to `main` if available and test after merge.

## plan

1. Run decision-engine search for the three review comments.
2. Read current HomePage, parallel service, and workspace phone-number spec sections.
3. Patch only findings that are still present.
4. Run focused Jest/lint/format checks and any relevant type/syntax checks.
5. Publish task PR, merge stream PR to main, and run post-merge tests/checks.

## files changed

-

## key decisions

- User requested main merge this time; after task PR lands in `stream/dialer`, use the existing stream review PR path to merge into `main` if checks/tooling allow it.

## notes for ko

- `workspace get_steering` is unavailable in this connector (`unknown tool: get_steering`), so I read `AGENTS.md`, `CODING-STANDARDS.md`, and the task skills as the authoritative steering.

## improvements noticed

-

## errors i ran into

- `workspace get_steering` returned NOT_FOUND.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-01 05:31:18 write: `.task/workpad.md`
- 2026-05-01 05:32:52 patch lines 101-103: `packages/api/src/services/workspace-phone-numbers.spec.ts`
## verification notes

- Verified `HomePage.tsx` still awaited `fetchActiveOpportunities()` directly in `handleOpenImportCSVModal` before fixing.
- Verified the import button caller still used `void handleOpenImportCSVModal()`, so catching inside the handler resolves that caller path as well.
- Verified `parallel.service.ts` still returned filtered caller IDs without deduplication before fixing.
- Verified `workspace-phone-numbers.spec.ts` still used `.rejects.toThrow(missingRelationError)` before changing it to identity assertion.

## implementation notes

- `handleOpenImportCSVModal` now catches `fetchActiveOpportunities` failures, captures the thrown error with context, computes the default name from an empty active record fallback plus `historicalOpportunityCount`, and still opens `HOME_IMPORT_CSV_LIST_NAME_MODAL_ID`.
- `getGroupFromNumbers` now returns `Array.from(new Set(...))` after filtering falsy caller IDs so release-all paths only release each caller ID once.
- `workspace-phone-numbers.spec.ts` now stores the promise and asserts `.rejects.toBe(missingRelationError)`.

## validation

- passed: `npx jest packages/api/src/services/workspace-phone-numbers.spec.ts --config=packages/api/jest.config.mjs --runInBand`.
- passed: `npx prettier --check` for `HomePage.tsx`, `parallel.service.ts`, and `workspace-phone-numbers.spec.ts`.
- passed: `workspace checkFiles` for changed `.ts` files.
- passed: targeted ESLint for `HomePage.tsx` and `workspace-phone-numbers.spec.ts` with only Nx project graph warnings.
- passed: `git diff --check`.
- blocked: targeted ESLint on `parallel.service.ts` reports existing Nest constructor-injection type-import findings. Left unchanged to avoid breaking runtime DI metadata.
- blocked: `workspace review.run { base: stream/dialer, noTests: true }` timed out at 10 minutes.

- 2026-05-01 05:42:05 append: `.task/workpad.md`
## verification notes

- Verified `HomePage.tsx` still awaited `fetchActiveOpportunities()` directly in `handleOpenImportCSVModal` before fixing.
- Verified the import button caller still used `void handleOpenImportCSVModal()`, so catching inside the handler resolves that caller path as well.
- Verified `parallel.service.ts` still returned filtered caller IDs without deduplication before fixing.
- Verified `workspace-phone-numbers.spec.ts` still used `.rejects.toThrow(missingRelationError)` before changing it to identity assertion.

## implementation notes

- `handleOpenImportCSVModal` now catches `fetchActiveOpportunities` failures, captures the thrown error with context, computes the default name from an empty active record fallback plus `historicalOpportunityCount`, and still opens `HOME_IMPORT_CSV_LIST_NAME_MODAL_ID`.
- `getGroupFromNumbers` now returns `Array.from(new Set(...))` after filtering falsy caller IDs so release-all paths only release each caller ID once.
- `workspace-phone-numbers.spec.ts` now stores the promise and asserts `.rejects.toBe(missingRelationError)`.

## validation

- passed: `npx jest packages/api/src/services/workspace-phone-numbers.spec.ts --config=packages/api/jest.config.mjs --runInBand`.
- passed: `npx prettier --check` for `HomePage.tsx`, `parallel.service.ts`, and `workspace-phone-numbers.spec.ts`.
- passed: `workspace checkFiles` for changed `.ts` files.
- passed: targeted ESLint for `HomePage.tsx` and `workspace-phone-numbers.spec.ts` with only Nx project graph warnings.
- passed: `git diff --check`.
- blocked: targeted ESLint on `parallel.service.ts` reports existing Nest constructor-injection type-import findings. Left unchanged to avoid breaking runtime DI metadata.
- blocked: `workspace review.run { base: stream/dialer, noTests: true }` timed out at 10 minutes.

- 2026-05-01 05:42:06 append: `.task/workpad.md`