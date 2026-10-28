# build lead connector admin and progressive overlay

branch: `task/dialer/build-lead-connector-admin-and-progressive-overlay`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1682/build-lead-connector-admin-and-progressive-overlay
github pr: https://github.com/consuelohq/opensaas/pull/1682
started: 2026-07-27

## acceptance criteria

- [ ] `/` preserves the installed sidebar experience by rendering or redirecting to `/admin`.
- [ ] `/admin` is a full-page administration, analytics, diagnostics, caller-ID, permission, and configuration surface rather than the primary live-calling UI.
- [ ] `/overlay` is a compact progressive dialer that reveals only the current target/call stage: selected, starting, dialing/ringing, connected, wrap-up, completed, or recoverable failure.
- [ ] The overlay reuses the existing embed session, resource, call-session, status, termination, and disposition contracts; no second backend API is added.
- [ ] The existing Custom JS becomes route-aware for Opportunities, Contacts, contact-detail, and opportunity-detail pages and owns launcher, popup iframe, minimize, close, and reload lifecycle.
- [ ] Existing click-to-call context and strict postMessage origin checks remain intact.
- [ ] The current sidebar page remains functional while overlay validation occurs.
- [ ] Marketplace mutations remain confined to app `690cbca9af44827eb89887b1`, draft version `6a651042f65aa918565593b1`, Custom Page `69b77476d898d360744e36bc`, Custom JS `01KYGP2NDCSJBA9C3T34PSWD9D`, App Test workspace `gR2oVhphupannQdgWsFz`, and sandbox location `Wkbuoi0VRjQ7KMKUjdTY`.
- [ ] No carrier call is placed in this task.

## plan

1. Characterize current Worker routing, renderer, state machine, and injected Custom JS.
2. Add failing route, progressive-view, and popup-host contracts.
3. Implement route-aware `/admin` and `/overlay` rendering with shared controller/API state.
4. Refactor the injected script to create a compact overlay iframe only on approved CRM routes.
5. Validate package tests, typecheck, browser build, Worker dry-run, and mocked browser states.
6. Deploy the Worker through Wrangler.
7. Verify supplied Marketplace draft resources still exist, then update only the draft Custom Page and Custom JS.
8. Validate Opportunities, Contacts, contact-detail, and opportunity-detail routes in the isolated App Test location using mocked/no-call UI paths.
9. Run review and publish verification, then merge to `stream/dialer`.

## Test-first contract

- Behavior under test:
  - Browser path `/` resolves to admin mode; `/admin` resolves to admin; `/overlay` resolves to compact overlay.
  - Admin mode does not render live call controls and wrap-up simultaneously as the primary surface.
  - Overlay mode progressively renders only controls relevant to the current phase.
  - Connected state emphasizes one winner and summarizes losing legs.
  - Wrap-up is hidden before terminal state and visible only after completion/wrap-up.
  - Custom JS mounts one launcher only on approved CRM routes, creates one named overlay iframe on demand, uses `/overlay`, and supports minimize/close/reload without wildcard messaging.
- Existing local patterns:
  - `view.test.ts`, `state-machine.test.ts`, `cloudflare-worker.test.ts`, and `architecture.contract.test.ts`.
- New or changed tests:
  - Route/surface mode contract.
  - Admin/overlay view assertions across progressive states.
  - Custom JS source contract for route allowlist and popup lifecycle.
  - Worker static route contract for `/`, `/admin`, and `/overlay`.
- Focused red command:
  - `bun test packages/lead-connector/src/embed/view.test.ts packages/lead-connector/src/embed/cloudflare-worker.test.ts packages/lead-connector/src/embed/architecture.contract.test.ts`
- Expected red failure:
  - No surface-mode resolver exists; the current renderer exposes all controls at once; the injected script searches for a pre-existing iframe and does not create a route-aware `/overlay` popup.

## current status

- Discovery complete. No production edit yet.
- PR #1681 is merged; `task.finish` still reports stale merge state and is a separate workspace lifecycle defect.

## files changed

- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.css`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`

## workspace-owned: files changed

- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.css`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`

## workspace-owned: activity log

- 2026-07-28 17:09:07 fs.write: `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.css`
- 2026-07-28 17:17:57 fs.write: `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- Initial nested batch reads failed because nested `fs.read` did not inherit `taskSession`; recovered with direct task-scoped reads and `code.call`.
- Task started from latest `stream/dialer` as PR #1682.

## workspace-owned: validation evidence

- 2026-07-27 22:59:41 `review.run`: passed — OK
- 2026-07-27 22:59:58 `verify`: passed — OK
- 2026-07-28 17:15:34 `review.run`: passed — OK
- 2026-07-28 17:16:01 `verify`: passed — OK
- 2026-07-28 17:51:16 `review.run`: passed — OK
- 2026-07-28 17:51:28 `verify`: passed — OK

## key decisions

- Keep one shared API client, controller, and state machine; split only rendering and host lifecycle by browser route.
- Keep the Custom Page as admin/sidebar and use Custom JS plus `/overlay` for the agent call experience.
- Do not add backend routes or place a carrier call.
- Use exact LeadConnector-provided routes and identifiers supplied in the task input; do not search for replacements.

## notes for ko

- The first implementation preserves the existing sidebar entry while validating the popup overlay in the isolated sandbox.

## improvements noticed

- `task.finish` can fail after a verified GitHub merge when its local stream ancestry is stale.
- Nested batch filesystem calls can lose task-session context.

## issues and recovery

- PR #1681 merge wait timed out, but GitHub confirmed state `MERGED`; the next task started directly from the updated stream.
- The first discovery batch failed on ambiguous task selection; no source file changed.
- `fs.write` rejected its advertised `force` argument; recovered with task-scoped `code.call`.

---

## publish checklist

```bash
bun run task:push -- --message "feat(lead-connector): add progressive crm overlay" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/lead-connector/EMBED.md`
- `packages/lead-connector/dist/embed-app/consuelo-lead-connector-click-to-call.css`
- `packages/lead-connector/dist/embed-app/consuelo-lead-connector-click-to-call.marketplace.html`
- `packages/lead-connector/package.json`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/architecture.contract.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/view.test.ts`
- `packages/lead-connector/src/embed/view.ts`
- `packages/lead-connector/tsconfig.json`
- `packages/lead-connector/wrangler.jsonc`
- `packages/lead-connector/wrangler.toml`

## implementation result

- Added route-aware browser surfaces: `/` and `/admin` render administration; `/overlay` renders the compact calling workflow.
- Reused the existing API client, controller, state machine, session contracts, call routes, and disposition routes.
- Added progressive selected, multiline setup, starting, dialing/ringing, connected-winner, wrap-up, completed, and recoverable-error presentations.
- Replaced the pre-existing-iframe assumption with one route-aware launcher and one owned iframe popup on Opportunities and Contacts routes.
- Preserved exact-origin postMessage validation, microphone permission, and no remote JavaScript loading.
- Deployed Worker version `8516a678-96f7-4037-aff5-1cf30b506e69`; public `/`, `/admin`, and `/overlay` return HTTP 200 without redirects.
- Updated the fixed draft Custom Page to `/admin` in both placement fields.
- Updated the fixed draft Custom JS with the minified route-aware overlay artifact.

## final validation evidence

- `bun test packages/lead-connector/src`: 61 passed, 0 failed, 382 expectations.
- Isolated `bun-types` TypeScript validation: passed. The canonical shared install still lacks `bun-types`; it was not modified.
- `bun run --cwd packages/lead-connector build:embed`: passed.
- Wrangler dry-run: passed.
- Live Worker route probe: `/`, `/admin`, and `/overlay` each HTTP 200, application shell present, no redirect, exact frame ancestor, microphone policy, no X-Frame-Options.
- Mocked browser review completed for admin, selected, multiline, starting, connected, and wrap-up states at desktop and popup dimensions.
- No carrier call was placed.

## Marketplace installation blocker

- The exact draft/test update reaches the installed-version Update flow, but redirects through the obsolete selected OAuth callback before the sandbox module refresh completes.
- The desired Worker callback already exists in the exact draft Auth screen. The Marketplace radio control is inert through typed click, accessible label, keyboard, pointer events, and its exposed Vue handler.
- The portal backend rejects direct cross-origin draft mutation outside its internal client. No unsafe credential extraction or request-body inspection was used.
- Required manual checkpoint: select the radio next to the Worker callback in the exact draft Auth screen, click Save, then rerun the White Label test-version Update for the existing single installation.
- Until that checkpoint, sandbox Opportunities correctly remains on the previously installed Custom JS and does not show the new launcher.

## remaining acceptance state

- [x] `/`, `/admin`, and `/overlay` route contract.
- [x] Admin and progressive overlay implementation.
- [x] Existing backend contracts reused.
- [x] Draft Custom Page and Custom JS persisted on supplied IDs.
- [x] Worker deployed and public headers/routes verified.
- [ ] Exact draft reinstalled into supplied sandbox after OAuth callback selection.
- [ ] Sandbox Opportunities/Contacts launcher, popup, minimize, close, reload, and auth recovery verified after refresh.
- [x] No carrier call placed.


## review-finding repair contract — 2026-07-28

- Behavior under test:
  - The Marketplace Custom JS artifact is wrapped in an inline `<script>` element because HighLevel streams the field as HTML.
  - The launcher is mounted on approved routes without creating/authenticating the iframe until the user opens the dialer.
  - An active/busy iframe survives navigation away from Contacts or Opportunities until completion, preserving hang-up and disposition controls.
  - Admin metrics display API-reported contact and opportunity totals rather than capped loaded-array lengths.
- Existing local pattern: source-contract tests in `architecture.contract.test.ts` and render assertions in `view.test.ts`.
- New or changed tests: wrapper boundary, lazy iframe creation, busy-route preservation/completion cleanup, and API-total metric rendering.
- Focused red command: `bun test packages/lead-connector/src/embed/architecture.contract.test.ts packages/lead-connector/src/embed/view.test.ts`.
- Expected red failures: raw unwrapped asset, eager iframe creation/removal on route change, and metrics using `.length`.
- Runtime boundary evidence already established in the isolated sandbox: raw Custom JS remains inert; a wrapped probe executes naturally. No carrier call was placed.

- 2026-07-28 17:06:19 apply-patch: `packages/lead-connector/src/embed/architecture.contract.test.ts`
- 2026-07-28 17:06:19 apply-patch: `packages/lead-connector/src/embed/view.test.ts`
- 2026-07-28 17:06:19 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-07-28 17:08:14 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-07-28 17:08:14 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-07-28 17:08:14 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-07-28 17:08:14 apply-patch: `packages/lead-connector/src/embed/state-machine.test.ts`
- 2026-07-28 17:09:07 write: `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.css`

- 2026-07-28 17:09:26 apply-patch: `packages/lead-connector/scripts/build-embed.ts`
- 2026-07-28 17:09:26 apply-patch: `packages/lead-connector/EMBED.md`

## workspace-owned: test selection

- changed files: `.task/dialer/build-lead-connector-admin-and-progressive-overlay/current.json`, `.task/dialer/build-lead-connector-admin-and-progressive-overlay/evidence-log.json`, `.task/dialer/build-lead-connector-admin-and-progressive-overlay/read-log.json`, `.task/dialer/build-lead-connector-admin-and-progressive-overlay/session.json`, `.task/dialer/build-lead-connector-admin-and-progressive-overlay/verify.json`, `.task/dialer/build-lead-connector-admin-and-progressive-overlay/workpad.md`, `.task/tasks/dialer/build-lead-connector-admin-and-progressive-overlay.json`, `packages/lead-connector/EMBED.md`, `packages/lead-connector/scripts/build-embed.ts`, `packages/lead-connector/src/embed/architecture.contract.test.ts`, `packages/lead-connector/src/embed/cloudflare-worker.test.ts`, `packages/lead-connector/src/embed/cloudflare-worker.ts`, `packages/lead-connector/src/embed/controller.test.ts`, `packages/lead-connector/src/embed/controller.ts`, `packages/lead-connector/src/embed/main.ts`, `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.css`, `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`, `packages/lead-connector/src/embed/state-machine.test.ts`, `packages/lead-connector/src/embed/state-machine.ts`, `packages/lead-connector/src/embed/styles.css`, `packages/lead-connector/src/embed/surface.ts`, `packages/lead-connector/src/embed/view.test.ts`, `packages/lead-connector/src/embed/view.ts`
- matched rules: `lead-connector-package`, `auto:@consuelo/lead-connector:package-test`
- selected suites: `LeadConnector provider contracts`, `@consuelo/lead-connector package test`
- run results: `LeadConnector provider contracts` passed, `@consuelo/lead-connector package test` passed
- failed suites: none

## final recovery and acceptance — 2026-07-28

This section supersedes the earlier Marketplace installation blocker and incomplete acceptance checklist.

### review findings repaired

- Added API-reported contact and opportunity totals to embed state, controller events, searches, and admin metrics.
- Split launcher styling into the Marketplace CSS field and kept the raw JavaScript executable for ordinary integrations.
- Added a generated Marketplace HTML artifact that wraps the same raw JavaScript in an inline `<script>` element, matching HighLevel's HTML-stream loader.
- Deferred creation of the `/overlay` iframe until the user opens the dialer.
- Preserved one busy iframe across navigation away from Contacts or Opportunities, then removed it after completion when off-route.

### test and build evidence

- Expected red contracts failed before implementation for missing API totals, missing Marketplace wrapper generation, eager iframe creation, and route teardown during a busy session.
- `bun test packages/lead-connector/src`: 64 passed, 0 failed, 406 expectations across 14 files.
- `bun run --cwd packages/lead-connector build:embed`: passed.
- Isolated TypeScript validation: passed using the existing cached `bun-types@1.3.14` and `@types/node@24.13.2`; no dependency, lockfile, or shared install mutation.
- Wrangler 4.106.0 dry-run: passed; six static assets discovered.
- Generated artifact identity: raw JavaScript copied exactly, CSS copied exactly, Marketplace wrapper exactly equals `<script>\n<raw.trim()>\n</script>\n`.
- Final artifact SHA-256: raw `aadb148383b53cf751287ae3178c32c237fd0a93ad569c26422c7545a7fb7d33`; CSS `156aeb68b79fed9aa9552805e5fdbb7f06dbd197fece8607262e2015f964ccbb`; wrapper `7e454c674143e856ad26b5e774c78f3525d86ebe12b77a08e981ad2d3965d402`.

### deployment and Marketplace evidence

- Deployed Cloudflare Worker version `1c7805ba-0927-429a-a8db-56233f08ac60`.
- Public `/`, `/admin`, and `/overlay`: HTTP 200, no redirect, no `X-Frame-Options`, and `Permissions-Policy: microphone=(self)`.
- Public JavaScript and CSS assets: HTTP 200 with lazy-frame, busy-preservation, and launcher-style markers.
- Cloudflare canonicalizes the Marketplace `.html` filename to its extensionless path; both requests resolve to the exact wrapped artifact.
- The exact draft Click-to-Call module persisted the generated wrapper and stylesheet; HighLevel's terminal-newline trimming was the only byte-level normalization.
- The redundant Overlay Host module remains an executable wrapped no-op so one module exclusively owns the launcher lifecycle.
- HighLevel's stale `Update` action temporarily moved two draft records into live 2.1. The named sandbox live record was removed, then the true draft was installed from a clean `Install` state. Final counters returned to live 2.1 = 4 and draft = 2; no unrelated sub-account was selected.

### isolated sandbox runtime evidence

- Opportunities initial state: one launcher, one host, panel hidden, stylesheet present, and zero iframe.
- Opening the launcher creates exactly one iframe at the approved Worker origin and `/overlay`, with microphone permission.
- Minimize and close restore the launcher without duplicating the host or iframe.
- Synthetic exact-origin `busy` message: iframe/panel remained available after a route transition to Dashboard.
- Synthetic exact-origin `completed` message: off-route host and iframe were removed after wrap-up; returning to Opportunities recreated one launcher with zero iframe.
- Contacts initial state: one launcher, one host, panel hidden, and zero iframe. No contact content or PII was read during validation.
- Installed custom page: exactly one Worker iframe at `/admin` with microphone permission. Direct `/admin` shows the administration heading and no call-start, multiline, hang-up, or stop controls; deeper authenticated cards require the parent context handshake.
- No carrier call was placed.

### final acceptance state

- [x] Admin route and progressive overlay route.
- [x] Existing backend contracts reused.
- [x] API totals displayed instead of loaded page lengths.
- [x] Marketplace wrapper and separate CSS generated from one source of truth.
- [x] Lazy iframe creation.
- [x] Busy-session route preservation and completion cleanup.
- [x] Exact draft installed into the supplied sandbox.
- [x] Opportunities and Contacts launcher runtime verified.
- [x] Admin custom page route verified.
- [x] Worker deployed and public routes/assets verified.
- [x] No carrier call placed.
