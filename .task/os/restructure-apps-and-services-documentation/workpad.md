# restructure apps and services documentation

branch: `task/os/restructure-apps-and-services-documentation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1485/restructure-apps-and-services-documentation
github pr: https://github.com/consuelohq/opensaas/pull/1485
started: 2026-07-14

## acceptance criteria

- [x] Define explicit task acceptance criteria before production edits.
- [x] Change only `packages/documentation/**` plus workspace-owned task metadata.
- [x] Reorder Connect to Overview, Agents, Nodes, then Apps and services.
- [x] Replace the connector-centric IA with action-oriented Apps and services subsections.
- [x] Add a canonical Google Workspace page using `openclaw/gogcli` as the available-today path while labeling the native Consuelo tool as planned.
- [x] Add user-facing pages for Cloudflare, Railway, Vercel, Datadog, Snowflake, GoHighLevel, Salesforce, Linear, Sentry, Supabase, Stripe, Twilio, HubSpot, and Notion.
- [x] Add Secure pages for Apple Keychain and API keys, local credential detection, and planned support for other secret managers.
- [x] Preserve useful old connector routes through redirects or compatibility pages.
- [x] Update claim ledgers and tests for planned-versus-shipped language and current support.
- [x] Validate navigation, normalized Markdown, browser layouts, links, package boundary, build, and strict review.
- [x] Complete publish verification.
- [ ] Merge into `stream/os`, verify the merged state, and clean up the task.

## plan

1. Verify current repository support for provider tools and Keychain handling, and read current official provider CLI/API documentation.
2. Add focused failing documentation contracts and record red evidence.
3. Build the Apps and services IA, pages, compatibility redirects, Secure credential pages, and claim-ledger updates.
4. Update browser coverage and run focused documentation validation, normalized Markdown checks, build, and viewport regression tests.
5. Self-review the diff, run workspace review and verify, publish and merge to `stream/os`, then verify the merged stream and clean up.

## test-first contract

- Behavior under test: Connect navigation order and route inventory; planned-versus-available-today status language; Google Workspace safety instructions; partial current Railway, Linear, and Sentry support; Secure credential subsections; old-route compatibility.
- Existing pattern: `packages/documentation/tests/connect.test.ts`, `tests/secure.test.ts`, section browser scripts, and evidence-path validation.
- New or changed tests: extend Connect and Secure contracts before writing pages; update browser route and group assertions after content exists.
- Focused red command: `bun test tests/connect.test.ts tests/secure.test.ts` from `packages/documentation`.
- Expected red failure: missing Apps and services hierarchy and pages, old Nodes position, absent Google Workspace guidance, and absent Keychain/API-key pages.
- Safety preflight: inspect the focused test files for destructive literals before running them.

## current status

- Implementation, focused validation, strict review, and the publish-valid task gate are complete.
- PR #1485 is active. Remaining work is task push, merge to `stream/os`, merged-stream verification, and cleanup.

## implementation

- Reordered Connect to Agents, Nodes, then Apps and services.
- Replaced seven connector pages with 22 action-oriented service pages and preserved every old public route through redirects.
- Added a canonical Google Workspace guide using `openclaw/gogcli`, including read-only, no-send, non-interactive, JSON, auth-doctor, and keyring guidance.
- Documented current built-in support for GitHub, Linear, read-only Sentry investigation, outbound Slack posts, and partial Railway operations.
- Added planned-but-usable-now guides for Cloudflare, Vercel, Datadog, Snowflake, Supabase, GoHighLevel, Salesforce, HubSpot, Stripe, Twilio, and Notion.
- Added consistent external-facing “Ask your agent” implementation briefs, proposed provider methods and flags, approval boundaries, and official documentation links.
- Added Secure credential subsections for Apple Keychain and API keys, credential detection, and planned external secret-manager adapters.
- Updated Connect and Secure ledgers, route validation, normalized Markdown coverage, and desktop/tablet/mobile browser contracts.

## test evidence

- Safety preflight: focused documentation tests contained no destructive command literals.
- Red: `bun test tests/connect.test.ts tests/secure.test.ts` produced 12 expected failures before the new pages and navigation existed.
- Green: the same selection passed 18 tests with 822 assertions.
- Current OS evidence: 23 focused tests passed across tool-manifest, GitHub, and tool-search contracts.
- Documentation contracts: Foundation 10, Start 6, Connect 9, Build 7, Sites 7, Observe 8, Secure 9, Reference 9, review cleanup 7 — all passed.
- Browser contracts: Foundation, Connect, Build, Sites, Observe, Secure, and Reference all passed; Connect covered 34 HTML and Markdown routes with 11 expanded groups, and Secure covered 12 routes with 2 expanded groups.
- Tablet and mobile checks reported zero horizontal overflow.
- Internal link check covered 33 links from changed pages with zero missing routes.
- Production build passed and Pagefind indexed 111 HTML pages.
- Strict workspace review reported zero findings from these changes; the only notice is the pre-existing absence of an Nx typecheck target.
- Full workspace verification passed and wrote a publish-valid stamp to `.task/os/restructure-apps-and-services-documentation/verify.json`.

## files changed

- `packages/documentation/src/content/docs/connect/apps-and-services/**` (added)
- `packages/documentation/src/content/docs/connect/connectors/**` (deleted with redirects)
- `packages/documentation/src/content/docs/connect/index.mdx`
- `packages/documentation/src/content/docs/secure/{credentials,apple-keychain-and-api-keys,credential-detection,other-secret-managers}.mdx`
- `packages/documentation/src/lib/{docs-navigation.ts,legacy-redirects.mjs}`
- `packages/documentation/evidence/{connect-claims.md,secure-claims.md}`
- `packages/documentation/tests/{connect.test.ts,secure.test.ts}`
- `packages/documentation/scripts/{validate-documentation.mjs,test-connect-browser.mjs,test-secure-browser.mjs}`

## workspace-owned: files changed

- `packages/documentation/src/content/docs/connect/connectors` (deleted)
- `packages/documentation/src/content/docs/connect/index.mdx`

## workspace-owned: activity log

- 2026-07-14 17:51:49 fs.write: `packages/documentation/src/content/docs/connect/index.mdx`
- 2026-07-14 17:52:43 fs.trash: `packages/documentation/src/content/docs/connect/connectors`

## workspace-owned: validation evidence

- 2026-07-14 18:03:59 `review.run`: passed — OK
- 2026-07-14 18:05:06 `verify`: passed — OK
- 2026-07-14 18:05:24 `verify`: passed — OK

## key decisions

- Use “Apps and services” as the reader-facing category; retain “connector” only when explaining the OS architecture.
- Order Connect as Agents, Nodes, Apps and services.
- A provider page may say the service is usable today through its official CLI or API while separately labeling the native Consuelo tool as planned.
- Google Workspace uses `gog` as the current implementation path, but future Consuelo methods use the reader-facing `google.*` namespace.
- Provider-specific tool families are preferable to one generic deployment tool.
- Apple Keychain is the current macOS credential-store pattern; detection must reveal presence, never secret values, and must not imply permission.

## notes for ko

- Yesterday’s fully shipped documentation stack is the baseline. This is a focused follow-up, not a continuation of the old stream.
- Scope remains the Astro/Starlight documentation package only.

## improvements noticed

- Claim ledgers now distinguish repository evidence for native support from official provider documentation for the available-today path.
- Provider-specific namespaces make future implementation tasks clearer than one generic deployment or connector tool.

## issues and recovery

- The first `task.start` call timed out after 60 seconds, but the worktree had been created. A state check followed by one corrected retry created PR #1485 without duplicating the branch.
- The task worktree inherited an absolute `packages/documentation/node_modules` symlink to the main checkout. Astro mixed absolute compile metadata and failed. The worktree-only symlink was removed, the standalone package installed with `--frozen-lockfile`, and the build and browser suites passed.
- One aggregate browser command exceeded the workspace wrapper timeout after all four suites printed green results. Each suite was rerun independently through a workspace batch and passed with normal exit status.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/evidence/connect-claims.md`
- `packages/documentation/evidence/secure-claims.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/scripts/test-secure-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content/docs/connect/connectors/additional-connectors.mdx`
- `packages/documentation/src/content/docs/secure/credential-detection.mdx`
- `packages/documentation/src/content/docs/secure/credentials.mdx`
- `packages/documentation/src/content/docs/secure/index.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/connect.test.ts`
- `packages/documentation/tests/secure.test.ts`

- 2026-07-14 18:04:50 apply-patch: `.task/os/restructure-apps-and-services-documentation/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/restructure-apps-and-services-documentation/current.json`, `.task/os/restructure-apps-and-services-documentation/evidence-log.json`, `.task/os/restructure-apps-and-services-documentation/read-log.json`, `.task/os/restructure-apps-and-services-documentation/session.json`, `.task/os/restructure-apps-and-services-documentation/verify.json`, `.task/os/restructure-apps-and-services-documentation/workpad.md`, `.task/tasks/os/restructure-apps-and-services-documentation.json`, `packages/documentation/evidence/connect-claims.md`, `packages/documentation/evidence/secure-claims.md`, `packages/documentation/scripts/test-connect-browser.mjs`, `packages/documentation/scripts/test-secure-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/content/docs/connect/apps-and-services/additional-services.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/cloudflare.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/datadog.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/github.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/gmail.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/gohighlevel.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/google-calendar.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/google-drive.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/google-workspace.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/hubspot.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/index.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/linear.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/notion.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/railway.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/salesforce.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/sentry.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/slack.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/snowflake.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/stripe.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/supabase.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/twilio.mdx`, `packages/documentation/src/content/docs/connect/apps-and-services/vercel.mdx`, `packages/documentation/src/content/docs/connect/connectors/additional-connectors.mdx`, `packages/documentation/src/content/docs/connect/connectors/github.mdx`, `packages/documentation/src/content/docs/connect/connectors/gmail.mdx`, `packages/documentation/src/content/docs/connect/connectors/google-calendar.mdx`, `packages/documentation/src/content/docs/connect/connectors/google-drive.mdx`, `packages/documentation/src/content/docs/connect/connectors/index.mdx`, `packages/documentation/src/content/docs/connect/connectors/slack.mdx`, `packages/documentation/src/content/docs/connect/index.mdx`, `packages/documentation/src/content/docs/secure/apple-keychain-and-api-keys.mdx`, `packages/documentation/src/content/docs/secure/credential-detection.mdx`, `packages/documentation/src/content/docs/secure/credentials.mdx`, `packages/documentation/src/content/docs/secure/other-secret-managers.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/legacy-redirects.mjs`, `packages/documentation/tests/connect.test.ts`, `packages/documentation/tests/secure.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
