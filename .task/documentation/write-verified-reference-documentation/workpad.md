
## discovery

- direct explore query: Reference docs, current contracts, and legacy ownership
- Bun structured repo scanner: pending
- Python targeted navigation/test/source audit: pending
- Python current route inventory diagnostic: pending
- Bun exact CLI help reproduction: pending

## verified discovery

- Direct explore located the existing Reference placeholder, legacy configuration/glossary pages, navigation contract, and prior documentation test patterns.
- A structured Bun scan covered `packages/documentation`, `packages/os`, and `packages/cli`; current reference truth is concentrated in the OS CLI, generated manifests, MCP gateway, configuration schemas, facade result types, and local server routes.
- Python source audits verified the current 10-page Reference target, the legacy redirect registry, package scripts, and the established metadata/evidence/browser contracts from Start through Secure.
- Exact CLI reproduction verified the supported `os.ts` command surface: steering, call, Sites, and settings commands. There is no separate polished public CLI binary in this checkout, so the docs will show the installed-runtime command honestly.
- Current runtime evidence verified `~/.consuelo` as the canonical home, `127.0.0.1:46321` as the default local gateway, `https://os.consuelohq.com/mcp` as the stable hosted MCP endpoint, MCP protocol `2024-11-05`, and the generated manifest/result contracts.
- The OS and security reports remain directional only. Every normative statement in this task must point to current source, focused tests, or an exercised runtime command.

## acceptance criteria

- Publish Reference overview, CLI, Configuration, MCP, Tools, Skills and manifests, Result and error formats, Environment variables, URLs and ports, and Glossary pages.
- Add all ten pages to expanded section-local navigation in the approved order.
- Give every page `status: preview`, `verifiedAt: 2026-07-13`, and current source/test/runtime evidence.
- Describe exact current contracts without inventing a `consuelo` binary, unsupported MCP resources/prompts, or environment variables not intended for users.
- Add a checked-in claim-and-evidence ledger for material reference claims.
- Delete the superseded legacy configuration and glossary pages and redirect their public routes.
- Verify normalized Markdown for all ten routes and responsive section-local browser navigation.
- Keep product changes inside `packages/documentation/**` plus task metadata.
- Pass focused OS contract tests, all documentation contracts, validation, browser regression, translation, package-boundary, production build, strict review, and publish verification.

## test-first contract

1. Add `packages/documentation/tests/reference.test.ts` and the Reference package scripts before authoring any Reference page.
2. Run the focused contract and record the expected failure because the nine missing pages, navigation entries, ledger, redirects, and scripts do not yet exist.
3. Implement the documentation and route cleanup until the focused contract passes.
4. Add and run the browser contract, then run the broader verification matrix.

## workspace-owned: TDD red evidence

- 2026-07-13 23:56:14 `bun test packages/documentation/tests/reference.test.ts`: failed exit 1 trace: `trc_ff5c45fafb44`
  - output: error: Script not found "task:exec"
- 2026-07-13 23:56:23 `bun test packages/documentation/tests/reference.test.ts`: failed exit 1 trace: `trc_92ee465f17ff`
  - output: error: Script not found "task:exec"

## workspace-owned: files read

- `packages/documentation/scripts/validate-documentation.mjs`

## implementation and verification

- Added all ten approved Reference pages, expanded section-local Reference navigation, normalized Markdown routes, browser coverage, and a checked-in claim ledger.
- Removed the superseded legacy configuration and glossary pages and added redirects to the verified Reference replacements.
- TDD red: 9 expected failures before implementation because the navigation, pages, ledger, redirects, and scripts were absent.
- TDD green: 9 Reference contract tests passed with 228 assertions.
- Focused current OS evidence: 54 tests passed across steering, settings, home configuration, repository selection, manifest overlays, generated manifests, skills, Hono routes, port precedence, and MCP callable-surface behavior.
- Combined documentation contracts: 63 tests passed with 1,695 assertions.
- Documentation validation: 91 curated pages.
- Reference browser regression: 10 HTML routes and 10 Markdown routes; one expanded local sidebar; zero tablet or mobile overflow.
- Translation and package-boundary checks passed.
- Production build passed; Pagefind indexed 93 HTML files.
- The task worktree initially inherited an absolute node_modules symlink from the parent checkout. Astro mixed parent and task paths, so the symlink was replaced locally with a frozen package install before browser/build verification. No dependency files changed.
- The workspace task.call/task.exec facade currently points to a missing task:exec script in this checkout. Focused commands were run through code.call, the supported repo runtime tool.
- An incorrectly scoped first OS test invocation ran tests from the repository root and updated a facade snapshot. The snapshot was immediately restored byte-for-byte from stream/documentation; no packages/os changes remain.

## workspace-owned: validation evidence

- 2026-07-14 00:07:44 `review.run`: passed — OK
- 2026-07-14 00:07:54 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/documentation/write-verified-reference-documentation/current.json`, `.task/documentation/write-verified-reference-documentation/evidence-log.json`, `.task/documentation/write-verified-reference-documentation/read-log.json`, `.task/documentation/write-verified-reference-documentation/session.json`, `.task/documentation/write-verified-reference-documentation/workpad.md`, `.task/tasks/documentation/write-verified-reference-documentation.json`, `packages/documentation/evidence/reference-claims.md`, `packages/documentation/package.json`, `packages/documentation/scripts/test-reference-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/content/docs/os/concepts/configuration.mdx`, `packages/documentation/src/content/docs/os/glossary.mdx`, `packages/documentation/src/content/docs/reference/cli.mdx`, `packages/documentation/src/content/docs/reference/configuration.mdx`, `packages/documentation/src/content/docs/reference/environment-variables.mdx`, `packages/documentation/src/content/docs/reference/glossary.mdx`, `packages/documentation/src/content/docs/reference/index.mdx`, `packages/documentation/src/content/docs/reference/mcp.mdx`, `packages/documentation/src/content/docs/reference/result-and-error-formats.mdx`, `packages/documentation/src/content/docs/reference/skills-and-manifests.mdx`, `packages/documentation/src/content/docs/reference/tools.mdx`, `packages/documentation/src/content/docs/reference/urls-and-ports.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/legacy-redirects.mjs`, `packages/documentation/tests/reference.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
