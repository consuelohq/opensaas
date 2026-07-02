# Wire Starlight documentation package

## Scope
Phase 2 turns the bootstrapped `packages/documentation` Starlight app into the real future docs app while keeping the legacy Mintlify package intact for live cutover safety.

## Acceptance criteria
- Keep package name `packages-documentation`; do not rename to `documentation` or `@consuelo/documentation`.
- Keep `packages/documentation` Bun-owned and outside root Yarn workspaces.
- Replace Starlight starter pages and starter sidebar with Consuelo docs.
- Port the curated English MDX slice from `packages/consuelo-docs` into `packages/documentation/src/content/docs`.
- Preserve desired IA: User Guide, Tools, OS, Developer Guide; User Stories as a single page; Sites as GTM umbrella; Office separate.
- Add adapters for Mintlify-ish MDX components actually used by the curated slice.
- Add `packages/documentation/README.md` as the source-of-truth doc for future agents.
- Do not re-add generated raw OS source docs or committed locale trees.

## Test-first contract
Behavior under test:
- Starlight package contains the curated docs set, expected sidebar anchors, adapter components, Bun ownership, and no starter/generated/raw-route regressions.

Existing pattern to follow:
- Use repo-local validation scripts as executable contracts, similar to docs validation in the legacy Mintlify package.
- Treat generated/raw docs routes as forbidden public docs.

New or changed tests:
- Add `packages/documentation/scripts/validate-documentation.mjs`.
- Add `bun run validate` in `packages/documentation/package.json`.

Focused red command:
- `bun --cwd packages/documentation run validate`

Expected red failure before implementation:
- Missing curated docs/adapters/sidebar after validation script is added.

Validation ladder:
1. Red validation script before implementation.
2. Green validation script after implementation.
3. `bun --cwd packages/documentation run build`.
4. Diff review and workspace review.

## Implementation plan
1. Create executable validation contract.
2. Remove starter docs content.
3. Copy curated MDX pages into Starlight content root.
4. Convert legacy absolute snippet imports to local adapter imports.
5. Add adapter Astro components.
6. Configure Starlight title/sidebar.
7. Rewrite package README for future agents.
8. Validate and self-review.

## Key decisions
- Do not port all 240 legacy Mintlify pages in Phase 2. That would carry old Twenty UI/reference pages and many React-only examples into the new app.
- Port 38 curated pages covering User Guide, Consuelo OS concepts, Tools, and Developer/API docs.
- Keep the legacy package until Phase 4 cutover.

## Notes for Ko
- Translation remains Phase 3.
- Deleting `packages/consuelo-docs` remains Phase 4.

## Validation log
- Pending red run.

- 2026-07-01 20:07:22 write: `.task/docs/wire-starlight-documentation-package/workpad.md`

## files changed

- `packages/documentation/astro.config.mjs`
- `packages/documentation/package.json`
- `packages/documentation/public/images/user-guide/create-workspace/choose-plan.png`
- `packages/documentation/public/images/user-guide/github/github-header.png`
- `packages/documentation/public/images/user-guide/home/command-menu.png`
- `packages/documentation/public/images/user-guide/home/main-layout.png`
- `packages/documentation/public/images/user-guide/home/navigation-bar.png`
- `packages/documentation/public/images/user-guide/home/search-bar.png`
- `packages/documentation/public/images/user-guide/home/side-panel.png`
- `packages/documentation/public/images/user-guide/home/view-menu.png`
- `packages/documentation/public/images/user-guide/integrations/plug.png`
- `packages/documentation/public/images/user-guide/what-is-consuelo/20.png`
- `packages/documentation/README.md`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/components/mintlify/AgentContext.astro`
- `packages/documentation/src/components/mintlify/Card.astro`
- `packages/documentation/src/components/mintlify/CardGroup.astro`
- `packages/documentation/src/components/mintlify/CardTitle.astro`
- `packages/documentation/src/components/mintlify/Note.astro`
- `packages/documentation/src/components/mintlify/VimeoEmbed.astro`
- `packages/documentation/src/components/mintlify/Warning.astro`
- `packages/documentation/src/content/docs/developers/agent/crm-tools.mdx`
- `packages/documentation/src/content/docs/developers/agent/integrations.mdx`
- `packages/documentation/src/content/docs/developers/agent/overview.mdx`
- `packages/documentation/src/content/docs/developers/agent/tool-system.mdx`
- `packages/documentation/src/content/docs/developers/api/auth.mdx`
- `packages/documentation/src/content/docs/developers/api/contacts.mdx`
- `packages/documentation/src/content/docs/developers/api/graphql.mdx`
- `packages/documentation/src/content/docs/developers/api/overview.mdx`
- `packages/documentation/src/content/docs/developers/api/voice.mdx`
- `packages/documentation/src/content/docs/developers/introduction.mdx`
- `packages/documentation/src/content/docs/guides/example.md` (deleted)
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/content/docs/os/concepts/approvals.mdx`
- `packages/documentation/src/content/docs/os/concepts/context-and-memory.mdx`
- `packages/documentation/src/content/docs/os/concepts/data-model-and-graphql.mdx`
- `packages/documentation/src/content/docs/os/concepts/files-and-artifacts.mdx`
- `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx`
- `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`
- `packages/documentation/src/content/docs/os/concepts/observability.mdx`
- `packages/documentation/src/content/docs/os/concepts/portal.mdx`
- `packages/documentation/src/content/docs/os/concepts/scripts.mdx`
- `packages/documentation/src/content/docs/os/concepts/skills.mdx`
- `packages/documentation/src/content/docs/os/glossary.mdx`
- `packages/documentation/src/content/docs/os/how-it-works.mdx`
- `packages/documentation/src/content/docs/os/overview.mdx`
- `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`
- `packages/documentation/src/content/docs/os/tools/overview.mdx`
- `packages/documentation/src/content/docs/reference/example.md` (deleted)
- `packages/documentation/src/content/docs/tools/media/getting-started.mdx`
- `packages/documentation/src/content/docs/tools/office.mdx`
- `packages/documentation/src/content/docs/tools/overview.mdx`
- `packages/documentation/src/content/docs/tools/sites/overview.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/glossary.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/implementation-services.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/keyboard-shortcuts.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/configure-your-workspace.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/navigate-around-consuelo.mdx`
- `packages/documentation/src/content/docs/user-guide/introduction.mdx`
- `packages/documentation/src/content/docs/user-guide/user-stories-use-cases.mdx`

## workspace-owned: files changed

- `packages/documentation/astro.config.mjs`
- `packages/documentation/package.json`
- `packages/documentation/public/images/user-guide/create-workspace/choose-plan.png`
- `packages/documentation/public/images/user-guide/github/github-header.png`
- `packages/documentation/public/images/user-guide/home/command-menu.png`
- `packages/documentation/public/images/user-guide/home/main-layout.png`
- `packages/documentation/public/images/user-guide/home/navigation-bar.png`
- `packages/documentation/public/images/user-guide/home/search-bar.png`
- `packages/documentation/public/images/user-guide/home/side-panel.png`
- `packages/documentation/public/images/user-guide/home/view-menu.png`
- `packages/documentation/public/images/user-guide/integrations/plug.png`
- `packages/documentation/public/images/user-guide/what-is-consuelo/20.png`
- `packages/documentation/README.md`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/components/mintlify/AgentContext.astro`
- `packages/documentation/src/components/mintlify/Card.astro`
- `packages/documentation/src/components/mintlify/CardGroup.astro`
- `packages/documentation/src/components/mintlify/CardTitle.astro`
- `packages/documentation/src/components/mintlify/Note.astro`
- `packages/documentation/src/components/mintlify/VimeoEmbed.astro`
- `packages/documentation/src/components/mintlify/Warning.astro`
- `packages/documentation/src/content/docs/developers/agent/crm-tools.mdx`
- `packages/documentation/src/content/docs/developers/agent/integrations.mdx`
- `packages/documentation/src/content/docs/developers/agent/overview.mdx`
- `packages/documentation/src/content/docs/developers/agent/tool-system.mdx`
- `packages/documentation/src/content/docs/developers/api/auth.mdx`
- `packages/documentation/src/content/docs/developers/api/contacts.mdx`
- `packages/documentation/src/content/docs/developers/api/graphql.mdx`
- `packages/documentation/src/content/docs/developers/api/overview.mdx`
- `packages/documentation/src/content/docs/developers/api/voice.mdx`
- `packages/documentation/src/content/docs/developers/introduction.mdx`
- `packages/documentation/src/content/docs/guides/example.md` (deleted)
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/content/docs/os/concepts/approvals.mdx`
- `packages/documentation/src/content/docs/os/concepts/context-and-memory.mdx`
- `packages/documentation/src/content/docs/os/concepts/data-model-and-graphql.mdx`
- `packages/documentation/src/content/docs/os/concepts/files-and-artifacts.mdx`
- `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx`
- `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`
- `packages/documentation/src/content/docs/os/concepts/observability.mdx`
- `packages/documentation/src/content/docs/os/concepts/portal.mdx`
- `packages/documentation/src/content/docs/os/concepts/scripts.mdx`
- `packages/documentation/src/content/docs/os/concepts/skills.mdx`
- `packages/documentation/src/content/docs/os/glossary.mdx`
- `packages/documentation/src/content/docs/os/how-it-works.mdx`
- `packages/documentation/src/content/docs/os/overview.mdx`
- `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`
- `packages/documentation/src/content/docs/os/tools/overview.mdx`
- `packages/documentation/src/content/docs/reference/example.md` (deleted)
- `packages/documentation/src/content/docs/tools/media/getting-started.mdx`
- `packages/documentation/src/content/docs/tools/office.mdx`
- `packages/documentation/src/content/docs/tools/overview.mdx`
- `packages/documentation/src/content/docs/tools/sites/overview.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/glossary.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/implementation-services.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/keyboard-shortcuts.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/configure-your-workspace.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/navigate-around-consuelo.mdx`
- `packages/documentation/src/content/docs/user-guide/introduction.mdx`
- `packages/documentation/src/content/docs/user-guide/user-stories-use-cases.mdx`

## workspace-owned: activity log

- 2026-07-01 20:07:22 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:07:38 write: `packages/documentation/scripts/validate-documentation.mjs`
- 2026-07-01 20:07:38 fs.write: `packages/documentation/scripts/validate-documentation.mjs`
- 2026-07-01 20:08:28 append: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:08:28 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:10:27 write: `packages/documentation/astro.config.mjs`
- 2026-07-01 20:10:27 fs.write: `packages/documentation/astro.config.mjs`
- 2026-07-01 20:10:38 write: `packages/documentation/README.md`
- 2026-07-01 20:10:38 fs.write: `packages/documentation/README.md`
- 2026-07-01 20:13:54 append: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:13:54 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:17:26 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:17:57 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:18:53 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:21:53 fs.write: `.task/docs/wire-starlight-documentation-package/workpad.md`
- Build note: Starlight prints `Entry docs → 404 was not found.` to stderr while still generating `/404.html` and exiting 0. Sitemap warning was fixed by adding `site: 'https://docs.consuelohq.com'`.
- Build validation: `bun run --cwd packages/documentation build` passed and generated 40 static pages, including `/user-guide/user-stories-use-cases/`, `/tools/sites/overview/`, `/tools/office/`, `/os/overview/`, and developer/API routes.
- Green validation: `bun run --cwd packages/documentation validate` passed with 38 curated pages and 7 Mintlify adapters.
- Red validation: `bun run --cwd packages/documentation validate` failed as expected after adding the contract. Failures included missing curated pages, missing adapters, starter sidebar/content, and missing README guidance.
- Tooling note: the task worktree initially symlinked `packages/documentation/node_modules` to the main checkout, which broke Astro virtual module resolution. I removed only that package symlink in the task worktree and ran `bun install --cwd packages/documentation`; no dependency directories are committed.

## workspace-owned: validation evidence

- 2026-07-01 20:14:17 `review.run`: passed — OK
- Added package validation for broken internal links and fixed migrated links that pointed at unported Mintlify/Twenty routes.
- Reworked `developers/introduction.mdx` to point at the ported Agent Development, API, and OS Tools pages instead of missing Extend/Self-Host/Contribute pages.
- Revalidated after link fixes: `bun run --cwd packages/documentation validate` and `bun run --cwd packages/documentation build` both pass.
- 2026-07-01 20:17:26 append: `.task/docs/wire-starlight-documentation-package/workpad.md`
- 2026-07-01 20:17:35 `review.run`: passed — OK
- 2026-07-01 20:17:49 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/docs/wire-starlight-documentation-package/current.json`, `.task/docs/wire-starlight-documentation-package/session.json`, `.task/docs/wire-starlight-documentation-package/workpad.md`, `.task/tasks/docs/wire-starlight-documentation-package.json`, `packages/documentation/README.md`, `packages/documentation/astro.config.mjs`, `packages/documentation/package.json`, `packages/documentation/public/images/user-guide/create-workspace/choose-plan.png`, `packages/documentation/public/images/user-guide/github/github-header.png`, `packages/documentation/public/images/user-guide/home/command-menu.png`, `packages/documentation/public/images/user-guide/home/main-layout.png`, `packages/documentation/public/images/user-guide/home/navigation-bar.png`, `packages/documentation/public/images/user-guide/home/search-bar.png`, `packages/documentation/public/images/user-guide/home/side-panel.png`, `packages/documentation/public/images/user-guide/home/view-menu.png`, `packages/documentation/public/images/user-guide/integrations/plug.png`, `packages/documentation/public/images/user-guide/what-is-consuelo/20.png`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/components/mintlify/AgentContext.astro`, `packages/documentation/src/components/mintlify/Card.astro`, `packages/documentation/src/components/mintlify/CardGroup.astro`, `packages/documentation/src/components/mintlify/CardTitle.astro`, `packages/documentation/src/components/mintlify/Note.astro`, `packages/documentation/src/components/mintlify/VimeoEmbed.astro`, `packages/documentation/src/components/mintlify/Warning.astro`, `packages/documentation/src/content/docs/developers/agent/crm-tools.mdx`, `packages/documentation/src/content/docs/developers/agent/integrations.mdx`, `packages/documentation/src/content/docs/developers/agent/overview.mdx`, `packages/documentation/src/content/docs/developers/agent/tool-system.mdx`, `packages/documentation/src/content/docs/developers/api/auth.mdx`, `packages/documentation/src/content/docs/developers/api/contacts.mdx`, `packages/documentation/src/content/docs/developers/api/graphql.mdx`, `packages/documentation/src/content/docs/developers/api/overview.mdx`, `packages/documentation/src/content/docs/developers/api/voice.mdx`, `packages/documentation/src/content/docs/developers/introduction.mdx`, `packages/documentation/src/content/docs/guides/example.md`, `packages/documentation/src/content/docs/index.mdx`, `packages/documentation/src/content/docs/os/concepts/approvals.mdx`, `packages/documentation/src/content/docs/os/concepts/context-and-memory.mdx`, `packages/documentation/src/content/docs/os/concepts/data-model-and-graphql.mdx`, `packages/documentation/src/content/docs/os/concepts/files-and-artifacts.mdx`, `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx`, `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`, `packages/documentation/src/content/docs/os/concepts/observability.mdx`, `packages/documentation/src/content/docs/os/concepts/portal.mdx`, `packages/documentation/src/content/docs/os/concepts/scripts.mdx`, `packages/documentation/src/content/docs/os/concepts/skills.mdx`, `packages/documentation/src/content/docs/os/glossary.mdx`, `packages/documentation/src/content/docs/os/how-it-works.mdx`, `packages/documentation/src/content/docs/os/overview.mdx`, `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`, `packages/documentation/src/content/docs/os/tools/overview.mdx`, `packages/documentation/src/content/docs/reference/example.md`, `packages/documentation/src/content/docs/tools/media/getting-started.mdx`, `packages/documentation/src/content/docs/tools/office.mdx`, `packages/documentation/src/content/docs/tools/overview.mdx`, `packages/documentation/src/content/docs/tools/sites/overview.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/glossary.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/implementation-services.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/keyboard-shortcuts.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/configure-your-workspace.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/navigate-around-consuelo.mdx`, `packages/documentation/src/content/docs/user-guide/introduction.mdx`, `packages/documentation/src/content/docs/user-guide/user-stories-use-cases.mdx`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- Workspace review passed after replacing validation-script console output with direct stdout/stderr writes. Only pre-existing issue is project-level typecheck target absence.
- Workspace verify passed and wrote `.task/docs/wire-starlight-documentation-package/verify.json` as publish-valid. Test selection found zero suites for these docs/static changes; package-local `validate` and `build` are the functional checks for this phase.

- 2026-07-01 20:17:57 append: `.task/docs/wire-starlight-documentation-package/workpad.md`

## Final implementation summary

Changed `packages/documentation` from the starter Starlight app into a working Consuelo documentation app without renaming the package. The package remains `packages-documentation`, declares Bun ownership with `packageManager: bun@1.3.14`, and stays outside the root Yarn workspace list.

Ported 38 curated English MDX pages from legacy Mintlify into `packages/documentation/src/content/docs`, covering User Guide, Consuelo OS, Tools, Developer Guide, and API docs. Removed Starlight starter guide/reference pages. Added the referenced images needed by those curated pages.

Created Starlight sidebar groups for User Guide, Consuelo OS, Tools, and Developer Guide. Kept User Stories as a single page, Sites as the GTM umbrella page, and Office as a separate Tools page.

Added Astro adapters for the Mintlify-ish components used by the curated pages: `Note`, `Warning`, `CardGroup`, `Card`, `CardTitle`, `VimeoEmbed`, and `AgentContext`.

Added `packages/documentation/README.md` as the source-of-truth guidance for future agents and added `packages/documentation/scripts/validate-documentation.mjs` as the package-local regression gate. The validator checks package ownership, curated page presence, forbidden raw-source pages, adapters, sidebar anchors, starter-content removal, README guidance, and broken internal links.

Validation run:
- Red validation failed as expected before implementation.
- `bun run --cwd packages/documentation validate` passed after implementation and after internal-link fixes.
- `bun run --cwd packages/documentation build` passed and generated 40 static pages plus sitemap.
- `workspace review` passed with zero issues owned by this change; only pre-existing project typecheck-target absence remains.
- `workspace verify` passed and wrote a publish-valid stamp.

Follow-ups:
- Phase 3 should add runtime/cached translation UX.
- Phase 4 should handle deploy cutover, redirects, and deleting `packages/consuelo-docs`.
- Starlight currently emits `Entry docs → 404 was not found.` on stderr while still exiting 0 and generating `/404.html`; keep an eye on this during deploy preview.

- 2026-07-01 20:18:53 append: `.task/docs/wire-starlight-documentation-package/workpad.md`

## Publish note

Ready to publish task PR after final sync. The task branch contains the Starlight docs app wiring, package-local validation, green Astro build, green workspace review, and green workspace verify. The only remaining known item is the non-blocking Starlight stderr line about `Entry docs → 404`, which still exits 0 and generates `/404.html`.

- 2026-07-01 20:21:53 append: `.task/docs/wire-starlight-documentation-package/workpad.md`
