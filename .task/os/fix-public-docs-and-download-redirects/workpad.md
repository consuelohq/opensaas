# Fix public docs and download redirects

branch: `task/os/fix-public-docs-and-download-redirects`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1698/fix-public-docs-and-download-redirects
github pr: https://github.com/consuelohq/opensaas/pull/1698
started: 2026-07-28

## acceptance criteria

- [ ] The legacy Marketplace docs URL `/user-guide/highlevel/embedded/getting-started` resolves to a current LeadConnector embedded-dialer onboarding guide instead of 404.
- [ ] The onboarding guide uses current LeadConnector naming and the deployed Worker/admin/overlay architecture; it does not revive the deleted Mintlify tree.
- [ ] `https://consuelohq.com/support` serves a real support page instead of the website 404.
- [x] Legacy docs and support routes have executable regression coverage.
- [x] Documentation and website focused tests, validation, and production builds pass.
- [ ] The affected public surfaces are deployed and verified with structured HTTP/browser evidence.

## plan

1. Characterize the exact live failures and identify current source owners.
2. Add failing docs-route and support-route contracts.
3. Add a curated LeadConnector embedded-dialer guide plus a legacy redirect.
4. Add a first-class Consuelo support page using the existing website system.
5. Run focused tests, package validation, type/build checks, and public-route smoke checks.
6. Deploy docs and website through their approved Cloudflare workflows, then verify the live URLs.
7. Run strict review and publish verification before promotion to `stream/os`.

## current status

- Live failures reproduced: docs path and `/support` both return HTTP 404.
- Exact Marketplace iframe source confirmed as `https://docs.consuelohq.com/user-guide/highlevel/embedded/getting-started`.
- Marketplace support field confirmed as `consuelohq.com/support`.
- Historical guide recovered read-only from GitHub; it referenced the retired `calls.consuelohq.com/calls/embedded` architecture and must be rewritten for the current LeadConnector Worker/admin/overlay surfaces.
- Red contracts added and observed failing for the missing guide, redirect, and support route.
- Added a current LeadConnector embedded-dialer guide, navigation entry, and exact legacy redirect.
- Added a first-class website /support route using MarketingLayout, SiteHeader, SiteFooter, and site tokens.
- Focused validation passes: documentation Connect contract 9/9; website support/shell contract 2/2.
- Documentation validator passes for 109 selected pages.
- Website production build passes and emits /support/index.html.
- Documentation build passes in an isolated temporary dependency install; the task worktree build itself is blocked by absolute node_modules symlinks into the canonical checkout, which causes Astro compile-cache path mixing.
- Full website structure suite is 18/19; the only failure is an inherited design-operator assertion at line 522, outside this task diff.

## files changed

- packages/documentation/src/content/docs/connect/apps-and-services/leadconnector-dialer.mdx
- packages/documentation/src/lib/docs-navigation.ts
- packages/documentation/src/lib/legacy-redirects.mjs
- packages/documentation/tests/connect.test.ts
- packages/consuelo-website/src/pages/support.astro
- packages/consuelo-website/tests/website-structure.test.js

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 03:48:13 `review.run`: passed — OK
- 2026-07-28 03:48:31 `verify`: passed — OK

## key decisions

- Preserve the stale Marketplace docs URL through the docs app's canonical legacy redirect mechanism.
- Create a curated current guide rather than resurrecting the deleted legacy docs package.
- Create a real `/support` page because it is a stable public Marketplace support contract, not a temporary redirect.
- Keep this work isolated from dialer runtime and Marketplace draft mutations.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Nested `batch` file reads did not inherit the task session and returned `AMBIGUOUS_TASK_SELECTION`; recovered with direct task-scoped reads.
- One repository scan was accidentally given a 300 ms timeout; reran with the intended bounded timeout.
- A multi-file read returned a transient upstream 502; recovered by splitting reads.
- Consuelo OS returned Session terminated for scoped and unscoped calls; recovered through the typed legacy workspace fallback while preserving the same task session and worktree.
- The first green test command used the wrong Bun --cwd form and did not run tests; corrected to direct file argv.
- The task-worktree documentation build failed because package and root node_modules are absolute symlinks into the canonical checkout; validated the same source through a fresh isolated temporary install.
- Full website structure suite has one inherited failure in the design-operator contract; focused route tests and the production build pass.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-docs/user-guide/highlevel/embedded/getting-started.mdx`
- `packages/documentation/README.md`
- `packages/workspace/senior-engineer.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-public-docs-and-download-redirects/current.json`, `.task/os/fix-public-docs-and-download-redirects/evidence-log.json`, `.task/os/fix-public-docs-and-download-redirects/read-log.json`, `.task/os/fix-public-docs-and-download-redirects/session.json`, `.task/os/fix-public-docs-and-download-redirects/workpad.md`, `.task/tasks/os/fix-public-docs-and-download-redirects.json`, `packages/consuelo-website/src/pages/support.astro`, `packages/consuelo-website/tests/website-structure.test.js`, `packages/documentation/src/content/docs/connect/apps-and-services/leadconnector-dialer.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/legacy-redirects.mjs`, `packages/documentation/tests/connect.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
