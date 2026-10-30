# Redesign the calling workspace with live sessions and compact controls

branch: `task/dialer/redesign-the-calling-workspace-with-live-sessions-and-compact-controls`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2711
started: 2026-10-30

## acceptance criteria

- [x] Rep-first Inbound/Outbound forms and truthful live status.
- [x] Settings/history on demand; subtle external pricing and owned checkout contract.
- [x] One persistent modeless iframe survives minimization and CRM navigation.
- [ ] Actual-build mocked browser flow, responsive evidence, strict review/full verification and publication.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior under test: compact rep-first inbound/outbound setup, authority-derived active sessions and truthful reconnect/connecting/live/wrap-up states; minimized sessions keep the calling iframe/media and readiness alive while the CRM remains usable. Settings/team/numbers/billing are disclosed on demand; no raw engine jargon or pricing grid on the main calling surface. Inbound Start receiving calls changes eligibility; outbound Start calling starts the selected calling workflow, never as a side effect of rendering/navigating. Pricing is catalog-driven and secondary, with Learn more and a separate-tab checkout flow.
Existing patterns: embed state-machine/controller/view tests, inbound operator authority, host-runtime tests and safe postMessage origin/source/version fences. Preserve server APIs, routing, Twilio leases/acceptance and credentials.
New tests: rendered compact setup/live/settings surfaces and clear labels; inbound readiness/session derivation across reconnect/accepted-not-connected/wrap-up; minimize/restore without iframe destruction or duplicate media/start effects; trusted compact-session host updates and keyboard/responsive behavior.
Focused red commands: selected embed view/state/host tests after discovery; exact files/commands will be recorded before production edit.
Expected red: current admin renders every management panel plus engine terminology; readiness uses Go ready/Go away; parent overlay offers no session-aware compact status or modeless active state.
No-test waiver: none for behavioral changes. Pure visual spacing/token adjustments use actual browser/viewport evidence rather than implementation-mirroring tests.

Ownership: this task owns rep/admin presentation in lead-connector embed view/styles/inbound-operator-view, new UI modules, ephemeral live/minimize state, host runtime/CSS and affected tests. Billing agent RD0 (7), task tsk_d7a98df5be09, owns checkout/catalog/claim persistence/GHL entitlement sync. User explicitly authorized messaging that agent; a coordination prompt was sent. Keep its publicPurchase model, claimPurchase method and commercial-purchase-claim hooks. No backend/catalog/website price edits; no duplicate Stripe implementation. Await/read /tmp/consuelo-billing-ui-contract.json for its integration handoff.

Other agents share this repository and stream. Use this isolated managed worktree, preserve their changes, reconcile both intents on merge, and never reset/force-push shared history. New task starts from current main5df083b91e7d82dc875b2ea71d46d23e556bd984 because stream/dialer has stale ancestry. No subagents, carrier calls, recordings, billing purchases, number changes or OS auth mutations are part of this UI redesign.

- 2026-10-30 21:39:33 append: `.task/dialer/redesign-the-calling-workspace-with-live-sessions-and-compact-controls/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 21:39:33 fs.write: `.task/dialer/redesign-the-calling-workspace-with-live-sessions-and-compact-controls/workpad.md`

## Implementation checkpoint 2026-10-30

Linear DEV-1648. Baseline tests were red before production edits: 4 pass / 7 fail in calling-workspace + click-to-call-runtime. First focused green: 11 pass / 0 fail. Broader embed suite currently 130 pass / 1 intentional history-heading assertion to adjust; typecheck passed. Built browser assets successfully. Actual built app is being exercised in an isolated browser context with every API stubbed, no real carrier/payment/number request permitted.

Dependency order: presentation/state derivation → trusted persistent-window handoff/minimize + observer media ownership → billing hook integration from PR2710 → mocked browser/visual/responsive proof → exact-head strict/full gates → task publication/promotion and coordinated edge release. Native administration observes browser readiness without preparing a competing device or heartbeating the live owner. Offer/capacity authority remains backend-owned.

Billing contract /tmp/consuelo-billing-ui-contract.json read. Claim UI gated on authoritative publicPurchase schema until hook integration; no hardcoded replacement Stripe price IDs. Further coordination message sent to authorized billing chat.

## Billing integration and behavior evidence

Imported the six API/controller/state/internal-main/test file changes from billing owner commit f2230af753ecea227d97905e87aed945c1a234e9 via checked patch (no task metadata or old view). New layout retains password setup-code form and clears its DOM value before submit. The form is gated on the server publicPurchase property, stays hidden on the current old backend, and has no legacy quantity checkout for new customers. Public subscriptions render approved plan labels and server recurring totals, never legacy quantity controls. Claim validation/denial and Settings permission failures now stay local instead of replacing an active call. Backend semantics remain billing-owned.

Full lead-connector package: 196 tests pass, 0 fail across 33 files (1493 assertions). Typecheck and browser build pass. Isolated real-browser test reproduced and fixed mouse-down/refresh/mouse-up target replacement: no click was dispatched before the guard, then explicit native handoff succeeded. Subsequent actual-build run proved start/stop receiving, one persistent iframe across Conversations navigation, minimize respected across polling, incoming acceptance→connecting→connected→unknown/reconnecting→wrap-up; no outbound create, billing or number effect. First browser run succeeded except final evidence-print scope typo; rerun exercises latest layout and Settings disclosures.

Review remaining: final browser/viewport proof on final source, strict review + full verification, task publication. No real carrier, billing, number or auth effect initiated.

## workspace-owned: validation evidence

- 2026-10-30 22:19:05 `review.run`: passed — OK
- 2026-10-30 22:19:36 `review.run`: passed — OK
- 2026-10-30 22:22:49 `review.run`: passed — OK
- 2026-10-30 22:24:33 `verify`: passed — OK

## Final UI verification checkpoint

197 package tests pass across 33 files; typecheck passes. Added a reproduced red/green form regression: disposition select, endpoint checkbox, open/focused keyboard picker now survive polling; deliberate controlled defaults still win. No extra persistence of input/secrets. Strict review passed before this final draft-preservation change and will be repeated on final source.

Actual browser evidence: /private/tmp/consuelo-calling-ui/browser-evidence.json and numbered PNGs. Both 568x320 and 667x375, plus 375x812, have no horizontal overflow and CTA is reachable by scrolling. Stubbed sequence made exactly 2 readiness writes (explicit start + stop), 1 accept and 1 wrap-up. No outbound create, billing/number request, uncaught browser error, or unmocked external request.

Still required: exact final gates, publish PR2711, merge through stream workflow, deploy bounded calls Worker assets, authenticated read-only embedded smoke. Billing backend deployment owned by other agent; claim form remains capability-gated. Broader normalized identity/admin follow-ups DEV-1643/1646 are not silently closed.
