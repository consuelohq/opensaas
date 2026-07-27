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

- Task workpad only.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Task started from latest `stream/dialer` as PR #1682.
- Initial nested batch reads failed because nested `fs.read` did not inherit `taskSession`; recovered with direct task-scoped reads and `code.call`.

## workspace-owned: validation evidence

- 2026-07-27 22:59:41 `review.run`: passed — OK
- 2026-07-27 22:59:58 `verify`: passed — OK

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

- none yet

- Wait reason: allow the exact draft Custom JS PUT mutation to settle before persistence verification.
  Duration: 3s.
  Resume action: reopen Custom JS ID 01KYGP2NDCSJBA9C3T34PSWD9D and inspect only safe description/code markers.
  Expected signal: saved description plus overlayPath/launcher/route-sync markers.
  Fallback: inspect safe request/error metadata and retry with a smaller inline build if persistence is missing.

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
