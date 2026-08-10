# fix standalone docs browser dependency

branch: `task/documentation/fix-standalone-docs-browser-dependency`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1450/fix-standalone-docs-browser-dependency
github pr: https://github.com/consuelohq/opensaas/pull/1450
started: 2026-07-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/documentation/node_modules` (deleted)

## workspace-owned: files changed

- `packages/documentation/node_modules` (deleted)

## workspace-owned: activity log

- 2026-07-13 06:01:31 fs.write: `.task/documentation/fix-standalone-docs-browser-dependency/workpad.md`
- 2026-07-13 06:04:48 fs.trash: `packages/documentation/node_modules`

## workspace-owned: validation evidence

- 2026-07-13 06:05:51 `review.run`: passed — OK
- 2026-07-13 06:06:02 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [x] Change only `packages/documentation/**` plus workspace-owned task metadata.
- [x] Declare Playwright in the standalone documentation package and update its Bun lockfile.
- [x] Add a focused red/green contract proving the browser test dependency is declared.
- [x] Prove a clean isolated archive of `packages/documentation` can install with `--frozen-lockfile`, resolve Playwright locally, and run the browser suite.
- [ ] Run documentation validation, build, review, verify, publish, merge to `stream/documentation`, and clean up.

## test-first contract

1. Reproduce the clean standalone package failure.
2. Add a focused failing assertion for the missing Playwright dependency.
3. Add the dependency and frozen lock entry.
4. Re-run the isolated install and browser suite without relying on repository-root modules.

## discovery

- Codex correctly reported that `test:browser` imports `playwright` while the standalone docs package declares no Playwright dependency.
- A clean `git archive` of `packages/documentation` followed by `bun install --frozen-lockfile` succeeds, but `import('playwright')` fails and no local `node_modules/playwright` exists.
- The repository root currently uses `playwright@^1.56.1`; use the same version range in the docs package.

## red-green evidence

- Red: `bun run test:foundation` failed exactly because `devDependencies.playwright` was missing: 8 passed, 1 failed.
- Green: after declaring `playwright@^1.56.1` and updating `bun.lock`, the same suite passed: 9 passed, 0 failed, 142 assertions.
- Isolated package verification: a copy of only `packages/documentation` installed with `bun install --frozen-lockfile`, resolved its own local `playwright`, and completed `bun run test:browser` with zero tablet or mobile overflow.

## current status

- Implementation, isolated-package proof, full package validation, strict review, and verify are complete. Publish, merge, and cleanup remain.

## validation evidence

- Standalone package: frozen install, local Playwright resolution, and browser suite passed.
- Foundation contract: 9 tests passed, 142 assertions.
- Start contract: 6 tests passed, 130 assertions.
- Translation and package-boundary checks passed.
- Browser regression passed with zero tablet and mobile overflow.
- Production build completed with 49 indexed HTML pages.
- Strict review reported zero findings from this change.
- Full workspace verify produced a publish-valid stamp.

## issues and recovery

- The task bootstrap initially linked `packages/documentation/node_modules` to the main worktree. That stale absolute link caused Astro to load files from the wrong worktree during one full-suite run. Replacing the worktree-only link with a frozen local install restored the browser suite and build. No generated dependency directory is committed.

- 2026-07-13 06:01:31 append: `.task/documentation/fix-standalone-docs-browser-dependency/workpad.md`

## workspace-owned: files read

- `packages/documentation/tests/foundation.test.ts`

- 2026-07-13 06:02:10 apply-patch: `packages/documentation/tests/foundation.test.ts`
- 2026-07-13 06:02:37 apply-patch: `packages/documentation/package.json`

- 2026-07-13 06:04:06 apply-patch: `.task/documentation/fix-standalone-docs-browser-dependency/workpad.md`

## workspace-owned: test selection

- changed files: `.task/documentation/fix-standalone-docs-browser-dependency/current.json`, `.task/documentation/fix-standalone-docs-browser-dependency/evidence-log.json`, `.task/documentation/fix-standalone-docs-browser-dependency/read-log.json`, `.task/documentation/fix-standalone-docs-browser-dependency/session.json`, `.task/documentation/fix-standalone-docs-browser-dependency/workpad.md`, `.task/tasks/documentation/fix-standalone-docs-browser-dependency.json`, `packages/documentation/bun.lock`, `packages/documentation/package.json`, `packages/documentation/tests/foundation.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-13 06:06:12 apply-patch: `.task/documentation/fix-standalone-docs-browser-dependency/workpad.md`