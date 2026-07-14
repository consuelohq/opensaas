# Docs: rebuild the Consuelo OS documentation foundation

branch: `task/documentation/docs-rebuild-the-consuelo-os-documentation-foundation`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1446/docs-rebuild-the-consuelo-os-documentation-foundation
github pr: https://github.com/consuelohq/opensaas/pull/1446
started: 2026-07-13

## acceptance criteria

- [x] Change only `packages/documentation/**` plus this task workpad.
- [x] Replace the old global taxonomy with Start, Connect, Build with OS, Sites, Observe, Secure, and Reference.
- [x] Global sidebar groups start collapsed; section routes show only the current expanded section plus an All documentation back link.
- [x] Replace the duplicated/internal homepage copy with a concise Consuelo OS docs homepage without editing the landing-page package.
- [x] Improve docs-only reading measure, spacing, typography, and responsive overflow while preserving the current font family.
- [x] Add Copy page, View as Markdown, Open in ChatGPT, and Open in Claude actions; do not add an Ask AI feature.
- [x] Add normalized Markdown output for every docs route and use the same representation for copying.
- [x] Scaffold the seven top-level area routes without making unverified product claims.
- [x] Extend docs frontmatter with evidence/status metadata for later writing PRs.
- [x] Add focused unit, build, browser, keyboard, and package-boundary regression coverage.

## test-first contract

1. Add failing tests for Markdown normalization, route mapping, section-sidebar selection, required page actions, route scaffolding, content width tokens, and package-boundary enforcement.
2. Record the focused red result before production implementation.
3. Implement the smallest shared foundation that satisfies those tests.
4. Run package validation, translation tests, production build, browser regression checks, review, and verify.

## plan

1. Inventory the current Starlight configuration, content adapters, validation scripts, and supported override surfaces.
2. Write focused failing tests and record the red result.
3. Add shared navigation data and route scaffolding.
4. Add normalized Markdown generation and per-page Markdown endpoints.
5. Add the PageTitle actions and section-local Sidebar override.
6. Add docs-only CSS and homepage content.
7. Update validation and authoring guidance.
8. Run full verification, inspect the diff, publish, merge to the documentation stream, and clean up.

## current status

- Foundation implementation is complete, validated, and ready to publish to `stream/documentation`.

## files changed

- Navigation and Starlight wiring: `astro.config.mjs`, `src/lib/docs-navigation.ts`, `src/components/Sidebar.astro`.
- Page actions and machine-readable pages: `src/components/PageTitle.astro`, `src/lib/markdown-pages.ts`, `src/pages/[...slug].md.ts`.
- Reading layout: `src/styles/docs.css`.
- Homepage and area scaffolds: `src/content/docs/index.mdx` plus Start, Connect, Build, Sites, Observe, Secure, and Reference index pages.
- Authoring contract and schema: `AUTHORING.md`, `README.md`, `src/content.config.ts`.
- Validation and regression coverage: `tests/foundation.test.ts`, `scripts/test-foundation-browser.mjs`, `scripts/check-package-boundary.mjs`, `scripts/validate-documentation.mjs`, `package.json`.

## workspace-owned: files changed

- Task metadata and this workpad under `.task/documentation/docs-rebuild-the-consuelo-os-documentation-foundation/`.
- No product files outside `packages/documentation/**` were changed.

## workspace-owned: activity log

- 2026-07-13: task created after Cloudflare allowlist recovery.
- 2026-07-13: inspected current Astro/Starlight config, content tree, adapters, validation, redirects, and Starlight override APIs.
- 2026-07-13: added focused foundation tests first and recorded the expected red result: `Cannot find module ../src/lib/markdown-pages`.
- 2026-07-13: implemented navigation, page actions, normalized Markdown endpoints, docs styling, route scaffolds, and authoring evidence schema.
- 2026-07-13: replaced the worktree-only symlinked docs dependencies with a local frozen Bun install after Astro reported cross-worktree compile metadata paths; no repository dependency files changed.
- 2026-07-13: fixed review findings for structured script output and explicit test typing.
- 2026-07-13: completed focused tests, full package validation, production build, browser checks, review, and verify.

## workspace-owned: validation evidence

- Test-first red: `bun run --cwd packages/documentation test:foundation` failed because `src/lib/markdown-pages.ts` did not exist.
- Documentation validator: passed; 46 curated pages and all adapters checked.
- Foundation tests: 8 passed, 0 failed, 149 assertions.
- Runtime translation tests: passed.
- Production build: passed; Pagefind indexed 53 HTML files and the sitemap was generated.
- Canonical Markdown audit: 52 source pages, 52 generated `.md` outputs, no missing routes, no supported adapter/import leakage.
- Browser regression: passed global collapsed navigation, expanded local navigation, canonical clipboard output, Markdown link, Escape behavior, ChatGPT/Claude web links, 632px prose width, and zero horizontal overflow on tablet and mobile.
- Package-boundary check: passed; no product changes outside `packages/documentation/**`.
- Strict review: 0 findings owned by this change. One pre-existing project warning remains because the documentation Nx project has no `typecheck` target.
- Full workspace verify: passed and wrote a publish-valid verification stamp.
- Non-blocking build warning observed: `Entry docs → 404 was not found`; build completed successfully.
- 2026-07-13 05:26:23 `review.run`: passed — OK
- 2026-07-13 05:27:04 `review.run`: passed — OK
- 2026-07-13 05:27:14 `verify`: passed — OK
- 2026-07-13 05:28:31 `verify`: passed — OK

## key decisions

- Keep the existing system font stack.
- Use lower-level Starlight overrides for PageTitle and Sidebar rather than forking the full layout.
- Generate one normalized Markdown representation for the endpoint and clipboard action.
- Open ChatGPT and Claude as normal web links after copying the page, rather than depending on undocumented prompt-prefill URLs.
- Keep legacy articles available but remove them from primary navigation until their replacement writing PR deletes or redirects them.
- Treat new top-level area pages as concise navigation scaffolds only; substantive product documentation belongs to later PRs.

## notes for ko

- Scope stayed locked to the Astro/Starlight documentation package. The landing page and `packages/consuelo-website/**` are untouched.
- This PR intentionally establishes the shared shell and evidence contract; the next seven PRs do the verified user-documentation writing.

## improvements noticed

- Existing validation is tightly coupled to the legacy taxonomy and must be updated with the new foundation.

## issues and recovery

- Initial task start was blocked by rotating egress IPs in Cloudflare. Access was restored and task session `tsk_664480a72d54` was created.
- Astro initially failed in the task worktree because `packages/documentation/node_modules` was symlinked to the main worktree. Replacing that worktree-only symlink with `bun install --frozen-lockfile` resolved the compile metadata path mismatch.
- The first broad review call timed out. A focused strict review completed, identified five actionable findings, and passed cleanly after fixes.

---

## publish checklist

```bash
bun run task:push -- --message "feat(documentation): rebuild docs foundation" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/documentation/docs-rebuild-the-consuelo-os-documentation-foundation/current.json`, `.task/documentation/docs-rebuild-the-consuelo-os-documentation-foundation/session.json`, `.task/documentation/docs-rebuild-the-consuelo-os-documentation-foundation/verify.json`, `.task/documentation/docs-rebuild-the-consuelo-os-documentation-foundation/workpad.md`, `.task/tasks/documentation/docs-rebuild-the-consuelo-os-documentation-foundation.json`, `packages/documentation/AUTHORING.md`, `packages/documentation/README.md`, `packages/documentation/astro.config.mjs`, `packages/documentation/package.json`, `packages/documentation/scripts/check-package-boundary.mjs`, `packages/documentation/scripts/test-foundation-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/components/PageTitle.astro`, `packages/documentation/src/components/Sidebar.astro`, `packages/documentation/src/content.config.ts`, `packages/documentation/src/content/docs/build/index.mdx`, `packages/documentation/src/content/docs/connect/index.mdx`, `packages/documentation/src/content/docs/index.mdx`, `packages/documentation/src/content/docs/observe/index.mdx`, `packages/documentation/src/content/docs/reference/index.mdx`, `packages/documentation/src/content/docs/secure/index.mdx`, `packages/documentation/src/content/docs/sites/index.mdx`, `packages/documentation/src/content/docs/start/index.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/markdown-pages.ts`, `packages/documentation/src/pages/[...slug].md.ts`, `packages/documentation/src/styles/docs.css`, `packages/documentation/tests/foundation.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
