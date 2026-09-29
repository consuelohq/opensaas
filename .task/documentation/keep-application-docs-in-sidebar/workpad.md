# keep application docs in sidebar

branch: `task/documentation/keep-application-docs-in-sidebar`
stream: `stream/documentation`
pr: https://github.com/consuelohq/opensaas/pull/2560
started: 2026-09-23

## acceptance criteria

- [x] Swamp appears in the Applications sidebar between Stripe and Supabase.
- [x] CI fails when a future application MDX page is added without a sidebar entry.
- [x] Connect tests, docs validation, and production build pass.

## plan

1. Add the regression assertion first and prove it fails for Swamp.
2. Add the Swamp sidebar entry in alphabetical order.
3. Run focused and broader docs validation, inspect the diff, publish, and merge to main.

## files changed

- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/tests/connect.test.ts`

## key decisions

- The regression test enumerates the actual application MDX directory rather than another hand-maintained page list, so adding a page without navigation fails CI.

## notes for ko

- The prior Swamp page shipped correctly but was orphaned from the manual sidebar registry; this task closes that class of failure.

## improvements noticed

- none yet

## errors i ran into

- Initial production build failed with `astro: command not found` because the fresh task worktree had no documentation package dependencies. Recovered with `bun install --frozen-lockfile`; build then passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/tests/connect.test.ts`

## Test-first contract

behavior under test: every application MDX page under `connect/apps-and-services/` (except `index.mdx`) must have a matching sidebar slug; Swamp must appear in the Applications sidebar in alphabetical order.
existing local pattern: `packages/documentation/tests/connect.test.ts` already asserts Connect navigation structure against `src/lib/docs-navigation.ts`.
new or changed tests: add a dynamic regression test that enumerates application MDX files and requires each slug in the navigation source.
focused red command: `cd packages/documentation && bun test tests/connect.test.ts`
expected red failure: the new test reports missing `connect/apps-and-services/swamp` because `swamp.mdx` exists but `docs-navigation.ts` has no Swamp entry.
no-test waiver: not applicable.

## validation summary

- Red: focused Connect test failed on missing `connect/apps-and-services/swamp` as expected.
- Green: focused Connect suite passed 9/9 with 544 expectations.
- Static checks passed for both touched TypeScript files.
- Documentation validator passed with 105 selected pages.
- Production Astro build passed and generated `/connect/apps-and-services/swamp/`; Pagefind indexed 121 HTML files.

- 2026-09-23 02:06:05 append: `.task/documentation/keep-application-docs-in-sidebar/workpad.md`

## workspace-owned: files changed

- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/tests/connect.test.ts`

## workspace-owned: activity log

- 2026-09-23 02:06:05 fs.write: `.task/documentation/keep-application-docs-in-sidebar/workpad.md`
- 2026-09-23 02:06:17 apply-patch: `packages/documentation/tests/connect.test.ts`
- 2026-09-23 02:06:36 apply-patch: `packages/documentation/tests/connect.test.ts`
- 2026-09-23 02:06:36 apply-patch: `packages/documentation/src/lib/docs-navigation.ts`
- 2026-09-23 02:08:20 fs.write: `.task/documentation/keep-application-docs-in-sidebar/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 02:06:47 `checkFiles`: passed — OK
- 2026-09-23 02:07:47 apply-patch: `.task/documentation/keep-application-docs-in-sidebar/workpad.md`
- 2026-09-23 02:07:58 `review.run`: passed — OK
- 2026-09-23 02:08:08 `verify`: passed — OK

- Review against `origin/main`: 0 issues from this change, 0 blockers; one unrelated pre-existing typecheck-target warning.
- Full `verify --base origin/main`: passed; publishValid=true.

- 2026-09-23 02:08:20 append: `.task/documentation/keep-application-docs-in-sidebar/workpad.md`
