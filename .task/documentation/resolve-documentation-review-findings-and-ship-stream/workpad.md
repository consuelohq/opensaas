
## discovery

- Scope: audit all 14 Codex inline findings across PRs #1448, #1449, #1450, #1452, #1453, and #1462 against the current merged documentation stream.
- CodeRabbit produced only skipped-review notices, so there are no CodeRabbit code findings to implement.
- Cleanup stream PR #1475 was merged to main first, then main was synced into stream/documentation at 74e3bbfb23f9aaad3fddbfae8ee5f6d3bf61ceb1.
- Fix only findings that still reproduce in current code; record obsolete/already-fixed findings with evidence.
- After focused fixes and validation, merge this task into stream/documentation and ship stream PR #1448 to main without waiting for CI, per Ko approval.

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`

## acceptance criteria

- Audit every priority-tagged Codex finding against the current stream; CodeRabbit has no substantive findings.
- Fix current documentation-package defects without changing the landing page or unrelated website code.
- Cover the systemic browser-server leak in every documentation browser suite, not only the four commented files.
- Make browser suites self-sufficient after a standalone docs install by installing Chromium on demand when missing.
- Make package-boundary validation compare committed changes against the correct PR/stream base.
- Preserve machine-readable Markdown redirects for removed documentation routes.
- Remove the unsafe post-install installer rerun from the agent guide.
- Bring every claim ledger back to the eight-column AUTHORING contract and repair nonexistent Connect test references.
- Record the two unrelated website findings as out of scope/already superseded.
- Merge this task to `stream/documentation`, ship stream PR #1448 to main without waiting for checks, then clean task and stream state.

## Test-first contract

- Behavior under test: shared browser lifecycle cleanup, browser binary bootstrap, committed package-boundary enforcement, closed page-action menu, Markdown redirects, safe post-install guidance, and evidence-ledger integrity.
- Existing pattern: Bun contract tests in `packages/documentation/tests/*.test.ts` plus real Playwright browser scripts.
- New test: `packages/documentation/tests/review-cleanup.test.ts`.
- Focused red command: `bun test packages/documentation/tests/review-cleanup.test.ts`.
- Expected red result: missing shared browser helper, old wrapper-kill patterns, working-tree-only boundary script, no Markdown redirects, unsafe installer rerun, and incomplete ledgers.
- The two website review comments are not tested here because this approved task remains confined to the Astro/Starlight documentation package.

## review finding disposition

| Source | Finding | Disposition |
| --- | --- | --- |
| #1448 | Add the missing Playwright dependency | Already fixed by merged PR #1450; `playwright` is in the standalone documentation package and lockfile. |
| #1448 | Stop leaking the Astro dev server | Fixed through the shared direct-Astro process-group lifecycle helper. |
| #1448 | Compare boundary files against the PR base | Fixed; the boundary check now includes merge-base-to-HEAD committed changes and working-tree changes. |
| #1448 | Hide the page action menu while details is closed | Fixed with explicit closed/open selectors and verified in the browser. |
| #1448 | Kill the Connect browser server process group | Fixed through the shared helper. |
| #1448 | Stop leaking the Build browser dev server | Fixed through the shared helper. |
| #1448 | Stop leaking the Sites browser dev server | Fixed through the shared helper. |
| #1449 | Preserve removed routes for Markdown consumers | Fixed with 308 redirects from legacy `.md` routes to canonical `.md` routes. |
| #1449 | Do not rerun the installer without workspace identity | Fixed; post-install guidance no longer recommends reprovisioning an existing managed workspace. |
| #1450 | Install the Playwright browser binary | Fixed; browser suites install Chromium on demand when the package executable is absent. |
| #1452 | Website homepage line-count assertion | Out of scope for the Astro/Starlight package and the thread is outdated. No website files changed. |
| #1453 | Duplicate Build browser server leak | Fixed by the shared helper. |
| #1453 | Website pricing control accessible name | Out of scope for the Astro/Starlight package. No website files changed. |
| #1462 | Sites evidence ledger omits required fields | Fixed; all documentation claim ledgers now use the AUTHORING eight-column contract. |

CodeRabbit produced fourteen skip/status notices and zero substantive code findings.

## additional cleanup found while verifying

- Removed two nonexistent Connect ledger test paths instead of preserving false evidence.
- Applied the claim-ledger schema consistently to Build, Connect, Observe, Reference, Secure, and Sites.
- Extended the browser lifecycle fix to Observe, Secure, and Reference, which had the same process leak even though Codex had not commented on those files.
- Added real browser coverage for closed page actions and legacy Markdown redirects.
- The merged cleanup stream resolved the root immutable Yarn failure: `yarn --immutable --check-cache` completed with exit 0 and no `twenty-emails` workspace error. Yarn changed one generated file mode during the check; it was restored exactly and no out-of-scope diff remains.

## validation so far

- TDD red: 0 passed, 7 failed before implementation.
- TDD green: 7 passed, 84 assertions.
- Combined documentation contracts: 70 passed, 1,779 assertions.
- Documentation validation: 91 curated pages.
- Translation and committed package-boundary checks passed.
- Production build passed and generated both canonical and legacy-redirect Markdown routes.
- Foundation browser regression passed, including the closed action menu and legacy Markdown redirect.
- Connect, Build, Sites, Observe, Secure, and Reference browser regressions passed.
- Fixed ports 4327, 4328, and 4329 were closed after the browser suites, proving the direct server processes did not leak.

## workspace-owned: validation evidence

- 2026-07-14 02:56:35 `review.run`: passed — OK
- 2026-07-14 02:56:46 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/documentation/resolve-documentation-review-findings-and-ship-stream/current.json`, `.task/documentation/resolve-documentation-review-findings-and-ship-stream/evidence-log.json`, `.task/documentation/resolve-documentation-review-findings-and-ship-stream/read-log.json`, `.task/documentation/resolve-documentation-review-findings-and-ship-stream/session.json`, `.task/documentation/resolve-documentation-review-findings-and-ship-stream/workpad.md`, `.task/tasks/documentation/resolve-documentation-review-findings-and-ship-stream.json`, `packages/documentation/evidence/build-claims.md`, `packages/documentation/evidence/connect-claims.md`, `packages/documentation/evidence/observe-claims.md`, `packages/documentation/evidence/reference-claims.md`, `packages/documentation/evidence/secure-claims.md`, `packages/documentation/evidence/sites-claims.md`, `packages/documentation/package.json`, `packages/documentation/scripts/check-package-boundary.mjs`, `packages/documentation/scripts/lib/documentation-browser-test.mjs`, `packages/documentation/scripts/test-build-browser.mjs`, `packages/documentation/scripts/test-connect-browser.mjs`, `packages/documentation/scripts/test-foundation-browser.mjs`, `packages/documentation/scripts/test-observe-browser.mjs`, `packages/documentation/scripts/test-reference-browser.mjs`, `packages/documentation/scripts/test-secure-browser.mjs`, `packages/documentation/scripts/test-sites-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/components/PageTitle.astro`, `packages/documentation/src/content/docs/start/connect-your-first-agent.mdx`, `packages/documentation/src/pages/[...slug].md.ts`, `packages/documentation/tests/review-cleanup.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
