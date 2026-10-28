# Preserve public webhook URL authority

## acceptance criteria
- A Twilio-signed POST through calls.consuelohq.com validates against the exact public scheme, host, path and query.
- The edge replaces caller-supplied forwarded host/protocol with its observed public URL.
- Preserve request body, signature, WebSocket/proxy behavior, customer identity signing and unrelated assets.
- Run focused red/green, strict review and full verify; publish/merge through the stream, deploy the accepted Worker and repeat signed production smoke.

## plan
1. Add a regression to the existing edge Worker tests.
2. Confirm missing public host/protocol forwarding is red.
3. Add the minimal trusted forwarding fields; rerun relevant boundary tests and gates.
4. Publish, deploy and verify the public signature end to end.

## Test-first contract
behavior under test: edge proxy preserves Twilio public URL authority and overwrites spoofed forwarded headers.
existing local pattern: packages/lead-connector/src/embed/cloudflare-worker.test.ts injects fetchOrigin and observes the upstream Request.
new or changed tests: signed webhook URL/body/query plus spoofed-host/protocol regression in that file.
focused red command: bun test packages/lead-connector/src/embed/cloudflare-worker.test.ts
expected red failure: forwarded host/protocol are absent or preserve attacker input rather than calls.example.test and https.
no-test waiver: none.

## runtime evidence
- Main Dialer 6078f42c deployed to Railway; configuration refresh deployment 424f5b05-0adb-4205-9aba-9dc5e9c74ddd is SUCCESS.
- Public Worker version 9dfd67cb-8d95-4772-ab40-688259beeaea.
- Backend and edge smoke checks pass; a signed synthetic callback against the direct Railway host returned 200.
- A signed callback against calls.consuelohq.com returned 401 even after aligning DIALER_SERVER_PUBLIC_URL to that public origin.
- Server middleware reconstructs the signature URL from x-forwarded-host/proto; edge new Request(target, request) currently omits the original host/protocol.
- No carrier call initiated; latest pre-restart audit found 0 active/ringing/queued calls.

## Red evidence
- Focused Bun Worker test: 9 pass / 1 fail, trace trc_93b3f39a1d69. Upstream x-forwarded-host was attacker.example.test instead of the observed public host and port.
- Minimal fix replaces forwarded host/protocol on the constructed upstream Request before fetch.

## workspace-owned: validation evidence

- 2026-10-28 17:27:51 `review.run`: passed — OK
- 2026-10-28 17:28:06 `review.run`: passed — OK
- 2026-10-28 17:28:12 `verify`: passed — OK

## Green evidence
- 174 focused tests passed across LeadConnector and the server Twilio boundary; 1,370 assertions.
- LeadConnector typecheck and production build passed.
- Strict review against origin/main: two changed source files, zero issues or documentation findings; trace trc_9f2f3617b0d1.
- Full verify passed at 2026-10-28T17:28:16.563Z; publishValid=true. Selected LeadConnector suite: 165 pass, 0 fail; database guard: no risks or findings.
