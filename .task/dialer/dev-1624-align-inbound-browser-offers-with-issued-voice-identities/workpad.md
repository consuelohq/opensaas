# DEV-1624: shared browser voice identity

## acceptance criteria
- An inbound browser offer uses the exact identity issued by the existing Voice SDK token path.
- Preserve the established user_ identity convention, raw authenticated rep IDs/capacity ownership, phone destinations and outbound acceptance checks.
- Focused Postgres-backed regression must fail before the fix; validate SDK/server builds, strict review and full verify before stream publication.
- No carrier calls, credential changes, database upgrade work, or GHL bootstrap changes in this source task.

## dependency and ownership graph
- Depends on accepted inbound SDK/server work and current signature repair in main 537d32d8a132e3dd6e186f5e70797f6c3cfbd114.
- Independent of DEV-1623 (database migration) and DEV-1619 (GHL installation/session). Those owners must not edit this task's voice-identity helper, token issuance, acceptance identity, or inbound offer destination.
- Own SDK identity helper/provider/compatibility identity and exports; server offer destination and focused telephony tests. Preserve all other work.
- Live validation remains a later gated step: the approved phone test was rejected by Twilio 21216 before creating a call, and the one-call authorization is consumed.

## Test-first contract
behavior under test: the Voice SDK issued identity and inbound carrier Client destination agree for the same raw rep ID.
existing local pattern: telephony.integration.test.ts uses isolated migrated Postgres databases and a simulated carrier.
new or changed tests: compare a real SDK-issued VoiceToken identity with the recorded browser offer destination and prove phone destinations remain unchanged.
focused red command: CONSUELO_RD5_PG_PORT=55415 bun test packages/dialer-server/src/inbound/telephony.integration.test.ts -t 'voice identity|phone offer destination'
expected red failure: client:alice differs from client:user_alice.
no-test waiver: none.

## Focused red evidence

Real Postgres on port 55415: browser identity regression failed with expected client:user_alice, received client:alice. Phone destination regression passed. No real carrier or browser interaction occurred.

## Compatibility test adjustment

The complete server suite exposed callback tests that asserted the same old client:alice destination. Shared telephony dispatch also serves callback rep offers, so update those destination expectations to client:user_alice while preserving all callback lifecycle, unknown-outcome and capacity assertions. No callback implementation files changed.

## workspace-owned: validation evidence

- 2026-10-28 19:23:14 `review.run`: passed — OK

## Verification tooling evidence

The background verify worker completed with exit 1 (not a crash). Its full result flagged an existing type-only Twilio peer import as OPTIONAL_IMPORT; the review facade omitted that related finding and returned zero issues. Use the equivalent inline TypeScript client type, preserving lazy runtime imports. Re-run the gates after this mechanical type change. Record the facade/pending-result discrepancy as separate OS follow-up; do not claim pending means pass.

## Validation and outcome

- Focused regression: red expected client:user_alice / received client:alice; green 2 pass / 0 fail / 8 assertions.
- SDK complete suite: 266 pass / 0 fail. Server complete suite with RD3/RD4/RD5/RD6/RD7B PostgreSQL flags on native port 55415: 304 pass / 1 unrelated lab opt-in skip / 0 fail, 1687 assertions.
- SDK and server typechecks/builds passed; SDK compiled entrypoint loads in Node.
- Full verification receipt: result pass, mode full, publishValid true, verifiedAt 2026-10-28T19:26:45.445Z. It ran all four selected suites, strict review, and the database guard. Default verify skips opt-in PG suites; the independent full PG run above supplies that evidence.
- OS follow-up DEV-1627 captures omitted review findings, repeated pending after terminal failure, and type-only peer import false positives. No OS source edited here.
- No deployment or live carrier initiation performed by this task. The earlier central test was rejected before creating a call (21216), original route restored, no capacity owner, authorization consumed.

## Coordinator handoff

Publish this task into stream/dialer. Keep main promotion/deployment centralized. Next interactive prerequisite is current Twilio Console Trust Hub eligibility/profile review; appropriate Primary profile approval is unproved. DEV-1619 still owns the manually reproduced GHL Retry/session loop. DEV-1623 remains independent migration work. Never retry the consumed one-run call authorization.
