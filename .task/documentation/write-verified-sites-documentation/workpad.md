
## red test evidence

- Command: `bun test packages/documentation/tests/sites.test.ts`
- Result: expected failure, 0 passed / 7 failed.
- Trace: `trc_232602e46542`.
- Failures prove the Sites hierarchy, six substantive pages, evidence metadata, verified local/publish/domain guidance, evidence ledger, and legacy replacement did not exist before implementation.

## workspace-owned: validation evidence

- 2026-07-13 18:49:14 `verify`: passed — OK
- 2026-07-13 18:49:18 `review.run`: passed — OK
- 2026-07-13 18:49:33 `review.run`: passed — OK

## workspace-owned: test selection

- changed files: `.task/documentation/write-verified-sites-documentation/current.json`, `.task/documentation/write-verified-sites-documentation/session.json`, `.task/documentation/write-verified-sites-documentation/workpad.md`, `.task/tasks/documentation/write-verified-sites-documentation.json`, `packages/documentation/evidence/sites-claims.md`, `packages/documentation/package.json`, `packages/documentation/scripts/test-sites-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/content/docs/sites/create-a-site.mdx`, `packages/documentation/src/content/docs/sites/domains.mdx`, `packages/documentation/src/content/docs/sites/index.mdx`, `packages/documentation/src/content/docs/sites/pages-and-content.mdx`, `packages/documentation/src/content/docs/sites/preview-locally.mdx`, `packages/documentation/src/content/docs/sites/publish.mdx`, `packages/documentation/src/content/docs/sites/troubleshooting.mdx`, `packages/documentation/src/content/docs/tools/sites/overview.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/navigate-around-consuelo.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/legacy-redirects.mjs`, `packages/documentation/tests/sites.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


## implementation summary

- Delivered all seven approved Sites pages: Overview, Create a site, Pages and content, Preview locally, Publish, Domains, and Troubleshooting.
- Verified the current local Sites model, typed reader rendering, immutable page versions, stale-base protection, section patches, leases, managed snapshot routing, and the lack of self-service custom-domain provisioning against current source, focused tests, and isolated runtime execution.
- Added `evidence/sites-claims.md`, complete Sites section navigation, normalized Markdown coverage, contract tests, browser regression coverage, and package scripts.
- Deleted the directly superseded `tools/sites/overview.mdx`, redirected that route to `/sites/`, removed its stale surviving cross-link, and routed unrelated legacy CRM URLs to the documentation root rather than misrepresenting them as current Sites behavior.
- No landing-page or website package was changed.

## verification

- Red contract: 0 passed / 7 failed, trace `trc_232602e46542`.
- Sites contract: 7 passed / 136 assertions, trace `trc_20357750d058` and final combined trace `trc_bb77406a2a60`.
- Combined documentation contracts: 38 passed / 1,061 assertions, trace `trc_bb77406a2a60`.
- Sites implementation tests: 8 passed / 114 assertions, trace `trc_e26b68b50575`.
- Managed snapshot and hostname contracts: 10 passed / 68 assertions, trace `trc_0eff66c4f9b9`.
- Isolated runtime render and publish: refresh, guide render, publish, current page, registry, immutable version, and heading verified, trace `trc_dee28294095a`.
- Documentation validation: 70 curated pages passed.
- Runtime translation: passed.
- Production build: passed with 74 HTML pages indexed by Pagefind.
- Foundation browser: passed; tablet and mobile overflow 0, trace `trc_65365687bc48`.
- Connect browser: 19 routes passed; tablet and mobile overflow 0, trace `trc_7324b88c916b`.
- Build browser: 17 routes passed; tablet and mobile overflow 0, trace `trc_2f1783891564`.
- Sites browser: 7 HTML and Markdown routes passed; expanded local sidebar; tablet and mobile overflow 0, trace `trc_42f7be162119`.
- Package boundary: passed; only `packages/documentation/**` and workspace-owned task metadata changed.
- Full workspace verification: `publishValid: true`, trace `trc_4ee90e310f70`.
- Strict review against `origin/stream/documentation`: zero issues from this change and zero blocking findings, trace `trc_54ef89080a52`. One pre-existing informational finding remains because the documentation Nx project has no typecheck target.
