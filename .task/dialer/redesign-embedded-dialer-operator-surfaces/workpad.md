# redesign embedded dialer operator surfaces

branch: `task/dialer/redesign-embedded-dialer-operator-surfaces`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/1763
started: 2026-08-03

## acceptance criteria

- [ ] The installed `/admin` page is a compact operator console, not a marketing-style placeholder dashboard.
- [ ] Authenticated operators can search and select real LeadConnector contacts and opportunities from the admin page without leaving the dialer.
- [ ] The compact overlay shows callable CRM records when no page-specific target is available, while preserving progressive call states and selected-target confirmation.
- [ ] The injected launcher is anchored beside native CRM navigation/list controls instead of floating at fixed coordinates over the page.
- [ ] Contacts and Opportunities routes keep one launcher and one lazy overlay iframe across SPA rerenders without duplicates.
- [ ] The Custom JS obtains signed user context through HighLevel's supported `window.exposeSessionDetails(APP_ID)` contract and forwards only the opaque encrypted value to the trusted overlay origin.
- [ ] The overlay no longer enters `EMBED_PARENT_UNAVAILABLE` while the installed app session is valid; it creates `/v1/embed/session` and loads contacts, opportunities, and pipelines.
- [ ] Clicking an actual phone action still selects the clicked record; direct/detail routes opportunistically resolve the current record when reliable DOM context exists.
- [ ] Strict origin checks, iframe microphone permission, lazy creation, active-call preservation, and no-wildcard messaging remain intact.
- [ ] Marketplace mutations remain confined to app `690cbca9af44827eb89887b1`, draft version `6a651042f65aa918565593b1`, Custom Page `69b77476d898d360744e36bc`, Custom JS `01KYGP2NDCSJBA9C3T34PSWD9D`, App Test workspace `gR2oVhphupannQdgWsFz`, and sandbox location `Wkbuoi0VRjQ7KMKUjdTY`.
- [ ] No carrier call is placed.

## plan

1. Capture the installed admin, Contacts, Opportunities, launcher, bootstrap, and network baselines.
2. Add failing view contracts for an operator resource browser on admin and ready overlay surfaces.
3. Add failing Custom JS contracts for native launcher anchoring and `exposeSessionDetails` bootstrap relay.
4. Implement the view redesign and existing-controller resource actions without adding backend APIs.
5. Implement supported Custom JS user-context acquisition, exact-origin relay, native launcher placement, and route-context resolution.
6. Run focused tests, full LeadConnector tests, typecheck, embed build, strict review, and full verify.
7. Deploy the Worker and update the exact draft Custom JS/CSS only if the generated artifact changed.
8. Verify admin authentication, resource rendering, launcher placement, popup authentication, and context selection in the isolated GHL location without starting a call.

## discovery

- The installed admin custom page reload produces `POST /v1/embed/session -> 201`, contacts `200`, opportunities `200`, and pipelines `200`; Railway/Worker availability is not the popup failure.
- The Contacts popup loads only `GET /overlay -> 200`, then times out. No `/v1/embed/session` request occurs.
- The popup failure is therefore a pre-authentication parent-context failure, not a backend health failure.
- Posting legacy `REQUEST_USER_DATA` from injected top-window JavaScript receives no response; HighLevel only supports that postMessage flow for registered Custom Page iframes.
- HighLevel's supported Custom JS API is available in the sandbox: `window.exposeSessionDetails` exists and resolves a 512-character opaque signed value for app `690cbca9af44827eb89887b1`.
- Current launcher is fixed at x=248/y=88 on both Contacts and Opportunities, causing it to overlap the CRM page boundary.
- Contacts has a stable native top-menu anchor `#tb_lists` beside Smart Lists and Bulk Actions.
- Opportunities has stable top tabs plus a native list/view bar; implementation will use exact stable IDs first and a bounded list-control fallback.
- Existing controller/main code already supports contact/opportunity search and `select-contact` / `select-opportunity` actions; the view simply does not expose them.
- Existing API resource lists and call contracts are sufficient. No new GHL account or backend route is currently required.

## test-first contract

- Admin view renders search, callable contact/opportunity rows, real totals, selected-target controls, and operator diagnostics instead of future-placeholder cards.
- Ready overlay renders available callable records and search guidance instead of a dead-end empty state.
- Custom JS source uses the exact app ID with `exposeSessionDetails`, forwards the opaque bootstrap only to the approved iframe origin, and does not expose/log it.
- Custom JS mounts the launcher beside `#tb_lists` on Contacts and a bounded native list/tab anchor on Opportunities; fixed coordinate placement is removed.
- Custom JS preserves one lazy iframe, strict source/origin checks, microphone permission, busy-route preservation, and clicked-phone targeting.
- Focused red command: `bun test packages/lead-connector/src/embed/view.test.ts packages/lead-connector/src/embed/architecture.contract.test.ts`.
- Expected red: no resource browser in admin/ready overlay; no `exposeSessionDetails`; launcher remains fixed and body-mounted.

## current status

- Discovery complete. No production source edit yet.
- Auth root cause and supported HighLevel Custom JS contract were reproduced in the installed sandbox.
- No carrier call has been placed.

## files changed

- none yet

## validation evidence

- Installed admin network: session 201; contacts/opportunities/pipelines 200.
- Installed popup network: overlay document 200; no session request before recoverable failure.
- `window.exposeSessionDetails('690cbca9af44827eb89887b1')`: available and resolves opaque string; payload was not printed or persisted.

## key decisions

- Reuse the existing API client, controller, state machine, call routes, and disposition routes.
- Use the platform-supported Custom JS session exposure method rather than scraping GHL internals or relying on the Custom Page iframe.
- Keep admin and overlay as separate render modes, but make both operationally useful.
- Use existing sandbox records first; request new test data only if a specific detail-route behavior remains untestable.
- Do not place a carrier call.

## workspace-owned: validation evidence

- Installed admin network: session 201; contacts/opportunities/pipelines 200.
- Installed popup network: overlay document 200; no session request before recoverable failure.
- `window.exposeSessionDetails('690cbca9af44827eb89887b1')`: available and resolves opaque string; payload was not printed or persisted.
- 2026-08-03 23:15:06 `review.run`: passed — OK
- 2026-08-03 23:15:07 `review.run`: passed — OK
- 2026-08-03 23:15:53 `review.run`: passed — OK
- 2026-08-03 23:16:12 `verify`: passed — OK
- 2026-08-03 23:46:03 `review.run`: passed — OK
- 2026-08-03 23:46:14 `verify`: passed — OK

## implementation and validation

- Replaced the placeholder admin dashboard with an operator workspace backed by existing LeadConnector contact, opportunity, pipeline, call-session, and disposition state.
- Added callable contact and opportunity rows, search, pipeline/stage filters, active-session controls, real totals, and concrete connection diagnostics.
- Added the same callable record browser to the ready overlay so a user is not dependent on fragile page scraping.
- Replaced legacy top-window REQUEST_USER_DATA dependency with HighLevel's supported Custom JS session exposure contract: window.exposeSessionDetails for app 690cbca9af44827eb89887b1, relayed as an opaque value to only the trusted overlay frame origin.
- Anchored the launcher after Contacts Smart Lists and the Opportunities native List control, with stable tab fallbacks and bounded top-right fallback.
- Preserved lazy iframe creation, microphone permission, exact source/origin checks, busy-session route preservation, progressive call states, and clicked-phone context selection.
- Added JSDOM runtime coverage for actual DOM placement, lazy iframe behavior, session-context relay, and duplicate prevention.
- Focused contracts: 19/19 passed.
- Runtime contracts: 2/2 passed.
- Full LeadConnector suite: 75 passed, 0 failed, 677 expectations.
- Typecheck and embed build passed.
- Generated Marketplace wrapper exactly wraps the executable source; generated CSS contains no fixed-left launcher placement.
- Strict review: 0 findings.
- Full verify: publish-valid.
- No carrier call was placed.

## production and sandbox verification

- Cloudflare Worker final version: fa6c3379-8df4-4614-a5f5-8224bc938edb.
- Marketplace draft Custom JS 01KYGP2NDCSJBA9C3T34PSWD9D updated through the authenticated Marketplace PATCH contract and read back successfully.
- Persisted Marketplace record: draft status, updatedAt 2026-08-03T23:41:38.641Z, JS 12387 bytes, CSS 2987 bytes.
- Persisted markers: exact app ID present, exposeSessionDetails present, native Contacts anchor present, right-side panel present, fixed-left launcher absent.
- The existing App Test installation picked up the draft automatically; no reinstall was required.
- Contacts sandbox: exactly one launcher, data-placement=native, immediately after #tb_lists, lazy iframe absent before opening.
- Popup sandbox: /overlay 200, /v1/embed/session 201, contacts 200, opportunities 200, pipelines 200.
- Popup ready state rendered searchable People and Deals groups and callable contact rows.
- Selecting the first example contact projected the human-readable contact name and a Call now confirmation; no Call now action was invoked.
- No /call-sessions request was created during verification.
- Opportunities sandbox: exactly one launcher, data-placement=native, immediately after the native List view control, lazy iframe absent.
- Admin custom page: rendered Operator workspace, live CRM totals, search, pipeline/stage filters, callable contacts, current-session panel, and Connection and browser checks.
- Final contact-label regression: provider records with null name now fall back to first + last name, then email.
- Final validation: 77 LeadConnector tests passed, 0 failed, 691 expectations; typecheck, build, strict review, and full verify passed.
- Existing sandbox records were sufficient; no new GHL test account or phone numbers were required.
- No carrier call was placed.
