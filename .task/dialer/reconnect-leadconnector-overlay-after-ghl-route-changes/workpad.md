# Reconnect LeadConnector overlay after GHL route changes

branch: `task/dialer/reconnect-leadconnector-overlay-after-ghl-route-changes`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1781/reconnect-leadconnector-overlay-after-ghl-route-changes
github pr: https://github.com/consuelohq/opensaas/pull/1781
started: 2026-08-05

## acceptance criteria

- [x] A non-busy open overlay reconnects automatically after Contacts↔Opportunities SPA route changes without a top-level refresh.
- [x] Disconnected launcher/panel/iframe references are discarded before remounting.
- [x] Route changes acquire fresh signed LeadConnector context rather than reusing an indefinitely cached promise.
- [x] Active-call continuity is preserved when the existing iframe remains connected.
- [ ] Marketplace Custom JS is updated and read back exactly; CSS is preserved.
- [x] LeadConnector tests/typecheck/build, strict review, and publish verification pass.
- [ ] Authenticated sandbox route transitions reach Ready on both Contacts and Opportunities with no call-session request.
- [x] No carrier call, recording, transcription request, or GHL record mutation occurs.

## plan

1. Add a red click-to-call runtime test that removes the old GHL route DOM, changes route, remounts the launcher, and requests context from the new iframe.
2. Harden only the parent Custom JS route/session lifecycle; preserve iframe call state and backend contracts.
3. Run focused/full LeadConnector validation, strict review, and verify.
4. Merge, deploy Worker if generated assets change, PATCH/read-back Marketplace JS, and prove Opportunities→Contacts→Opportunities reconnects without reload.

## current status

- Route lifecycle implementation and full local validation complete. Strict review is clean. Pending verify, merge, Marketplace JS update/read-back, and authenticated route-transition proof.

## files changed

- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- `packages/lead-connector/src/embed/click-to-call-runtime.test.ts`
- task workpad/metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-05 00:05:37 `review.run`: passed — OK
- 2026-08-05 00:05:38 `review.run`: passed — OK
- 2026-08-05 00:06:08 `verify`: passed — OK

## key decisions

- Keep the active iframe when it is still connected, especially during a call.
- If GHL removes the injected DOM, clear only disconnected references and rebuild one host/launcher/iframe.
- Refresh the signed session context on route change and proactively relay it to a connected idle iframe.

## Test-first contract

- Behavior: after GHL removes the old injected host/launcher and changes from Contacts to Opportunities, the script remounts one launcher, creates a new iframe, calls `exposeSessionDetails` again, and relays context to the new iframe.
- Existing pattern: `click-to-call-runtime.test.ts` executes the generated parent script in JSDOM and asserts native placement/context relay.
- Focused red command: `bun test packages/lead-connector/src/embed/click-to-call-runtime.test.ts`.
- Expected red: the stale `frame` variable prevents a new iframe from being mounted or causes the new iframe's message to fail source validation; context remains called once.

## validation summary

- Red: route-remount runtime test called `exposeSessionDetails` once instead of twice.
- Focused route lifecycle: 4/4 tests passed after implementation.
- LeadConnector full suite: 91/91 tests, 777 assertions.
- Typecheck and embed build passed.
- Strict review against `origin/stream/dialer`: zero findings.
- No call-session request, carrier activity, recording, transcription, or CRM mutation occurred.

## notes for ko

- The failure was parent-script state, not the iframe/backend: GHL could remove injected DOM while the script retained disconnected node references, and the session-context promise never expired.
- The script now discards only disconnected references, refreshes signed context on route changes/iframe loads, and proactively relays new context to a connected idle iframe.
- Busy/active connected iframes are preserved rather than recreated.

## improvements noticed

- The browser acceptance path should always include Opportunities→Contacts→Opportunities while the overlay remains open, not just independent page-load checks.

## issues and recovery

- The initial workspace discovery batch lost task scope for a read step; reran source/workpad reads directly with the task session.
- Production evidence showed no new `/v1/embed/session` request after the route transition, which led directly to the stale-reference/context-cache boundary.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet
