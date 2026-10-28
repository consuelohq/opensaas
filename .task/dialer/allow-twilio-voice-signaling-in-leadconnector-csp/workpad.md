# allow Twilio Voice signaling in LeadConnector CSP

branch: `task/dialer/allow-twilio-voice-signaling-in-leadconnector-csp`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1759/allow-twilio-voice-signaling-in-leadconnector-csp
github pr: https://github.com/consuelohq/opensaas/pull/1759
started: 2026-08-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-03 21:17:27 `review.run`: passed — OK
- 2026-08-03 21:17:28 `review.run`: passed — OK
- 2026-08-03 21:17:55 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Production browser trace: CSP blocked `wss://voice-js.roaming.twilio.com/signal` and `https://sdk.twilio.com`; Twilio Device emitted 31000 and remained in Starting before backend call-session creation.
- Carrier audit: zero matching calls; authorization remains unused.
- Owner: `packages/lead-connector/src/embed/cloudflare-worker.ts` line 57 sets `connect-src 'self'`.
- Existing regression file: `packages/lead-connector/src/embed/cloudflare-worker.test.ts`.
- Twilio official connectivity contract: Voice JavaScript SDK requires signalling and SDK asset access on Twilio HTTPS/WSS hosts.

## test-first contract

- Add focused assertions that every iframe-safe asset response CSP includes `https://*.twilio.com` and `wss://*.twilio.com` under `connect-src`.
- Red proof: run the focused Cloudflare Worker test before implementation and confirm the new assertion fails against `connect-src 'self'`.
- Implementation: centralize the Twilio Voice connect sources and interpolate them into the CSP without relaxing script, style, image, framing, or permissions policies.
- Verification: focused test, LeadConnector package test/typecheck/build, strict review.

## implementation and validation

- Added provider-neutral browser voice connect sources: `https://*.twilio.com` and `wss://*.twilio.com`.
- Preserved the architecture boundary by sanitizing only these exact provider wire-origin literals in architecture tests; telephony SDK/runtime usage remains forbidden outside `agent-voice.ts`.
- Focused test red proof: 2 failures against the old `connect-src 'self'`.
- Focused test green: 4/4.
- Full LeadConnector tests: 68/68.
- Typecheck: pass.
- Production build: pass.
- Strict review against `origin/stream/dialer`: 0 blocking findings.
- Live proof before fix: Twilio Voice token fetched, then CSP blocked signaling and SDK assets; Twilio carrier audit remained zero.
