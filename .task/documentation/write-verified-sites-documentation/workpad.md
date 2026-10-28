# Write verified Sites documentation

branch: `task/documentation/write-verified-sites-documentation`
stream: `stream/documentation`
pr: https://github.com/consuelohq/opensaas/pull/1462
started: 2026-07-13

## acceptance criteria

- [x] Define explicit task acceptance criteria before implementation.
- [x] Change only `packages/documentation/**` plus workspace-owned task metadata.
- [x] Start from the latest `stream/documentation` state, including merged Start, Connect, and Build work.
- [x] Write and verify the complete Sites area: Overview; Create a site; Pages and content; Preview locally; Publish; Domains; Troubleshooting.
- [x] Verify every material claim against current source, tests, configuration, and real runtime behavior where practical; use archived reports only as directional research maps.
- [x] Add a Sites claim/evidence ledger with source, test, and runtime evidence.
- [x] Delete directly superseded legacy Sites/GTM pages only after replacements exist; add redirects and update surviving links.
- [x] Expand the Sites section-local navigation in the approved order and add focused contract/browser regression coverage.
- [x] Run focused Sites implementation checks plus documentation, build, search, browser, review, package-boundary, and full workspace verification gates.
- [ ] Merge the task into `stream/documentation`, refresh stream PR #1448, verify the merged stream, then finish and clean up.

## test-first contract

1. Inventory the current Sites scaffold, legacy pages, Sites source/CLI/runtime, publish pipeline, domains, and relevant tests.
2. Add focused failing documentation contract tests for the required route set, navigation order, evidence ledger, page contracts, verified support boundaries, and legacy replacement.
3. Record the red result before substantive documentation edits.
4. Write only claims supported by source, tests, generated output, and runtime checks.
5. Run focused implementation tests plus the full documentation and workspace release gates before publish.

## red test evidence

- Command: `bun test packages/documentation/tests/sites.test.ts`.
- Result: expected failure, 0 passed / 7 failed.
- Trace: `trc_232602e46542`.
- The failures proved the Sites hierarchy, substantive pages, evidence metadata, local/publish/domain guidance, evidence ledger, and legacy replacement did not exist before implementation.

## Agent-authored publish update

### What changed

- Delivered all seven approved Sites pages: Overview, Create a site, Pages and content, Preview locally, Publish, Domains, and Troubleshooting.
- Added `packages/documentation/evidence/sites-claims.md`, complete Sites section navigation, normalized Markdown coverage, focused contract tests, and browser regression coverage.
- Deleted the directly superseded `tools/sites/overview.mdx`, redirected that route to `/sites/`, removed its stale surviving cross-link, and routed unrelated legacy CRM URLs to the docs root instead of misrepresenting them as Sites behavior.
- Kept every product change inside `packages/documentation/**`; no landing-page or website package was touched.

### Why it changed

- The old Sites page was a stale GTM/CRM umbrella and did not describe the current Consuelo OS Sites implementation.
- Users need an accurate path from source creation through typed rendering, local review, immutable publication, collaboration-safe updates, and the current managed-hostname boundary.
- Archived reports were useful discovery maps, but current source, focused tests, and isolated runtime behavior were used as the evidence of record.

### Validation run

- Red contract: 0 passed / 7 failed, trace `trc_232602e46542`.
- Sites contract: 7 passed / 136 assertions.
- Combined documentation contracts: 38 passed / 1,061 assertions, trace `trc_bb77406a2a60`.
- Sites implementation tests: 8 passed / 114 assertions, trace `trc_e26b68b50575`.
- Managed snapshot and hostname contracts: 10 passed / 68 assertions, trace `trc_0eff66c4f9b9`.
- Isolated runtime verification successfully refreshed Sites, rendered typed guide content, published it, and verified the current page, registry, immutable version, and heading, trace `trc_dee28294095a`.
- Documentation validation and runtime translation passed.
- Production build passed with 74 HTML pages indexed by Pagefind.
- Foundation, Connect, Build, and Sites browser suites passed with zero tablet or mobile overflow; Sites verified all seven HTML and normalized Markdown routes.
- Package boundary passed.
- Full workspace verification returned `publishValid: true`, trace `trc_4ee90e310f70`.
- Strict review against `origin/stream/documentation` found zero issues from this change and zero blocking findings, trace `trc_54ef89080a52`.

### Issues and follow-ups

- The documentation Nx project still has the pre-existing informational review notice that it declares no `typecheck` target.
- Custom-domain provisioning is not self-service in the current Sites CLI; the docs state that managed hostnames remain a Consuelo platform operation.
- The remaining lifecycle work is to merge task PR #1462 into `stream/documentation`, refresh stream PR #1448, verify the merged stream, and clean up the task.

## current status

Implementation, runtime verification, focused tests, browser regressions, production build, package-boundary verification, strict review, and the publish-valid workspace gate are complete. The task is ready for task PR publication and merge.

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

## workspace-owned: TDD post evidence

- 2026-07-13 18:52:16 `cp .task/documentation/write-verified-sites-documentation/workpad.md /tmp/write-verified-sites-documentation-workpad.md`: failed exit 1 trace: `trc_5e1db1db2240`
  - output: error: Script not found "task:exec"
