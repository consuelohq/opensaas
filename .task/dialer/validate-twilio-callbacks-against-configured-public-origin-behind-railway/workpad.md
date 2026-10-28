# Canonical Twilio signature origin

## acceptance criteria
- Validate real Twilio signatures using the configured public origin even when Railway replaces forwarded host headers. Preserve the exact request path/query and JSON raw-body verification.
- Never accept a signature bound only to an attacker/upstream host when a public origin is configured. Preserve unconfigured embedders' existing behavior.
- Validate configuration, focused regressions, strict review and full verify, then publish and deploy the accepted backend artifact.

## Test-first contract
behavior under test: canonical configured public signature authority through multiple proxies.
existing local pattern: runtime/twilio-signature.ts delegates to Twilio's validator; boundary tests verify parsing and forwarded URL reconstruction.
new or changed tests: runtime/twilio-signature.test.ts uses actual Twilio signatures for form/query, invalid authority, JSON body tampering, optional compatibility and malformed configuration.
focused red command: bun test packages/dialer-server/src/runtime/twilio-signature.test.ts
expected red failure: a public-origin signature is rejected because upstream host is used.
no-test waiver: none.

## production evidence
- Worker version 7da07551-8f94-4253-8f90-a7583adc086a forwards observed public host and scheme.
- Public-origin signature through edge: 401. Signature for Railway origin sent through edge: 200.
- Direct Railway request carrying forwarded public host still rejects the public-origin signature: Railway replaces the authority headers.
- No carrier calls initiated.

## Red evidence
- 1 pass / 4 fail before production changes. Actual Twilio validator rejected the public signature and accepted the upstream signature; JSON and malformed configuration also failed as expected. The failing assertions were captured in the task execution output.

## workspace-owned: validation evidence

- 2026-10-28 17:34:59 `review.run`: passed — OK
- 2026-10-28 17:35:20 `verify`: passed — OK

## Green evidence
- Focused runtime signature and webhook boundaries: 14 pass, 0 fail, 39 assertions.
- Server typecheck and compiled build passed. Strict review: zero blocking or documentation findings.

## Full verify
- Passed 2026-10-28T17:35:27.751Z; publishValid=true. Logger and contacts prerequisites passed. Server suite: 224 pass, 85 PostgreSQL-gated skips, 0 fail. The earlier full integration release separately passed the PostgreSQL tests; this change affects signature authority only.
