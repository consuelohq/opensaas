# write verified Connect documentation

branch: `task/documentation/write-verified-connect-documentation`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1452/write-verified-connect-documentation
github pr: https://github.com/consuelohq/opensaas/pull/1452
started: 2026-07-13

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Change only `packages/documentation/**` plus workspace-owned task metadata.
- [x] Write and verify the full Connect area: Overview; Agents (ChatGPT, Codex, Claude Code, Cursor, OpenCode, Gemini, Other agents); Connectors (Overview, GitHub, Google Drive, Gmail, Google Calendar, Slack, Additional connectors); Nodes (How nodes work, Home node, Local nodes, Cloud nodes).
- [x] Verify every material claim against current source, tests, generated configuration, and real runtime behavior where practical; use archived reports only as directional research maps.
- [x] Give each genuinely supported agent and connector a focused page; label partial, preview, assisted, or unavailable paths honestly rather than inventing setup.
- [x] Keep the Start journey shallow and link back instead of duplicating the first-agent onboarding path.
- [x] Add a Connect claim/evidence ledger with current code/test/runtime evidence.
- [x] Delete directly superseded legacy integration and capability pages after replacements exist; add useful redirects and update internal links.
- [x] Expand the Connect section-local navigation in the approved order and add focused contract/browser regression coverage.
- [x] Run relevant OS, connector, node, documentation, build, search, browser, review, package-boundary, and full workspace verification gates.
- [ ] Push the task branch, merge it into `stream/documentation`, refresh the stream PR, verify the merged stream, then finish and clean up the task.

## test-first contract

1. Inventory the current Connect scaffold, legacy docs, agent adapters/configuration, connector manifests/implementations, node lifecycle/routing, and relevant tests.
2. Add focused failing documentation contract tests for the required route set, navigation order, evidence ledger, provider/connector page contracts, and removal of placeholder copy.
3. Record the red result before substantive documentation edits.
4. Write only claims supported by source, focused tests, generated output, and runtime checks.
5. Run focused implementation tests plus the full documentation and workspace release gates before publish.

## current status

- Implementation, focused verification, documentation regression coverage, strict review, and the publish-valid workspace gate are complete.
- The task branch was reset directly onto `origin/stream/documentation` before publish, removing an unrelated website commit inherited when task bootstrap incorrectly started from `main`.
- Remaining work is the task push, task-to-stream merge, merged-stream verification, and cleanup.

## verified product findings

### Agents

- Codex, Claude Code, Cursor, OpenCode, Factory Droid, and Gemini CLI have tested native local configuration adapters using the installed `consuelo-os-mcp` command.
- Pi is detected but intentionally unsupported because OS does not own a verified Pi MCP configuration shape.
- A local agent reaches `verified` only after MCP initialize, `tools/list`, and at least one returned tool.
- ChatGPT is the current self-service cloud-agent path through HTTPS MCP and Consuelo OAuth. Other cloud-agent entries in Settings remain placeholders.

### Connectors

- GitHub is available through the typed `workspace.github` facade when runtime GitHub authentication is present.
- Slack currently supports outbound webhook text posts only.
- Google Drive, Gmail, and Google Calendar are not self-service connector flows. Managed workspace OAuth requests identity scopes only and does not grant service data access.
- There is no generic self-service connector registry; optional capability names are not presented as shipped integrations.

### Nodes

- The first approved managed node is `home`; later approved computers are `member` nodes.
- Enrollment reports `created` or `reconnected`, which is separate from runtime health.
- Managed local connector transport is recorded as `cloudflare-tunnel` or `websocket-relay`.
- Cloud mode remains assisted: the installer opens the Consuelo handoff and exits before local provisioning.

## implementation

- Added all 19 approved Connect pages under `src/content/docs/connect/`.
- Replaced the Connect placeholder overview with a user-facing map of agents, connectors, and nodes.
- Added `evidence/connect-claims.md` with source, test, runtime, and status evidence.
- Expanded the section-local Connect sidebar in the approved order.
- Added normalized `.md` route and browser coverage for every Connect page.
- Added provider, connector, node-boundary, evidence-path, redirect, and deletion contracts.
- Deleted the directly superseded `developers/agent/integrations.mdx` and `os/concepts/integrations-and-capabilities.mdx` pages.
- Added redirects for the deleted routes and useful historical integration/calendar/mailbox URLs.
- Updated surviving internal links to the new Connect area.
- Updated the foundation browser selector so the seven global groups are counted independently of nested Connect groups.

## files changed

- `packages/documentation/evidence/connect-claims.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content/docs/connect/**`
- `packages/documentation/src/content/docs/developers/agent/integrations.mdx` (deleted)
- `packages/documentation/src/content/docs/os/concepts/configuration.mdx`
- `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx` (deleted)
- `packages/documentation/src/content/docs/os/concepts/portal.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/connect.test.ts`

## validation evidence

### TDD

- Red: `bun test tests/connect.test.ts` — 0 passed, 8 failed before implementation.
- Green: `bun test tests/connect.test.ts` — 8 passed, 309 assertions.

### Current OS behavior

- Focused Vitest selection — 69 passed across local-agent connectivity, isolated installer connectivity, install state, device authority, GitHub, tool manifest, and launcher onboarding.
- Focused Bun selection — 26 passed across Settings, installer onboarding UI, and hosted onboarding flow.
- MCP gateway under Vitest with a temporary test-only `bun:sqlite` import alias — 11 passed. The alias was needed because the suite imports a Bun-native module while Vitest workers run under Node; no repository file was changed for the workaround.

### Documentation package

- `bun run validate` — passed; 61 selected pages and all supported MDX adapters validated.
- Translation check — passed.
- Foundation contract — 9 passed, 174 assertions.
- Start contract — 6 passed, 130 assertions.
- Connect contract — 8 passed, 309 assertions.
- Package-boundary check — passed; only `packages/documentation/**` plus task metadata changed.
- Foundation browser suite — passed with 7 global groups, 632px paragraph measure, and zero tablet/mobile overflow.
- Connect browser suite — passed for 19 HTML routes and 19 normalized Markdown routes, four expanded local groups, deep-link active state, and zero tablet/mobile overflow.
- Isolated `packages/documentation` install with `bun install --frozen-lockfile` — passed.
- Production build — passed; Pagefind indexed 65 HTML pages.

### Review and release gate

- Strict workspace review — zero findings from these changes; one pre-existing notice that the project has no Nx `typecheck` target.
- Full workspace verification — passed with a publish-valid stamp at `.task/documentation/write-verified-connect-documentation/verify.json`.

## issues and recovery

- Task bootstrap selected `main` instead of the sequential documentation stream. The branch initially inherited an unrelated website stream commit. Before publishing, the tracked documentation patch was preserved, the task branch was reset to `origin/stream/documentation`, and the patch was reapplied. The task diff now contains only the approved docs package and task metadata.
- The worktree initially pointed `packages/documentation/node_modules` at the main checkout. Astro mixed absolute module paths and failed its compile cache. The symlink was removed from the worktree, the standalone package was installed with `--frozen-lockfile`, and build/browser verification passed. This did not change a tracked package file.
- A broad Vitest command could not load `bun:sqlite` in four suites; Bun's test runner could load it but lacks Vitest's `vi.stubGlobal`. Relevant suites were rerun with their compatible runner, and the MCP gateway suite was verified in Vitest using a temporary import alias. All focused product checks used as evidence are green.

## key decisions

- Treat every named agent and connector page as a support claim. Unsupported or assisted paths are stated directly instead of being filled with generic setup prose.
- Keep agent configuration, service credentials, OAuth identity, authorization, and node routing as separate concepts.
- Use individual Google service pages to explain the real support boundary and managed path rather than pretend the current identity OAuth grants Drive, Gmail, or Calendar access.
- Keep provider-specific setup out of Start and link the two areas together.

## notes for ko

- The Connect area now has the full approved hierarchy and tells users what works, what requires Consuelo assistance, and what is not yet supported.
- No landing-page or `packages/consuelo-website/**` file is in the task diff.

---

## publish checklist

```bash
bun run task:push -- --message "docs(documentation): write verified Connect documentation" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-13 16:20:00 write: `.task/documentation/write-verified-connect-documentation/workpad.md`

## workspace-owned: files changed

- `packages/documentation/evidence/connect-claims.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content/docs/connect/**`
- `packages/documentation/src/content/docs/developers/agent/integrations.mdx` (deleted)
- `packages/documentation/src/content/docs/os/concepts/configuration.mdx`
- `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx` (deleted)
- `packages/documentation/src/content/docs/os/concepts/portal.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/connect.test.ts`

## workspace-owned: activity log

- 2026-07-13 16:20:00 fs.write: `.task/documentation/write-verified-connect-documentation/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/task-push.js`
