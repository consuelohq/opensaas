# DEV-1695 Twilio account ownership boundaries

branch: `task/dialer/dev-1695-twilio-account-ownership-boundaries`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2790
started: 2026-11-07

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-server/src/call-history-application.test.ts`
- `packages/dialer-server/src/call-operations/application.test.ts`
- `packages/dialer-server/src/call-operations/application.ts`
- `packages/dialer-server/src/call-operations/persistence.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/outbound-account-routing.test.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/lab/historical-inbound-fixture.ts`
- `packages/dialer-server/src/routes/twilio-media.ts`
- `packages/dialer-server/src/routes/twilio.ts`
- `packages/dialer-server/src/runtime/account-ownership.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/workspace-media-boundary.test.ts`
- `packages/dialer-server/src/runtime/workspace-twilio.ts`
- `packages/dialer-server/src/transcription-boundary.test.ts`
- `packages/dialer-server/src/transfer-application.acceptance.test.ts`
- `packages/dialer-server/src/transfers/application.ts`
- `packages/dialer-server/src/twilio-boundary.test.ts`


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

## DEV-1695 scope and test-first contract (2026-11-07)

Source: remote main cced8b89, isolated task PR #2790; do not merge divergent stream/dialer, provision credentials, initiate calls or deploy unreviewed code. DEV-1696 follows after overlap in workspace-twilio.ts.

Behavior under test:
1. Completion cost fetch MUST use the providerAccountId of the persisted call group, regardless of later workspace reassignment; legacy persisted group without owner belongs to parent; missing or mismatched mappings fail closed.
2. Outbound capacity stores the exact provider account at begin and retains it through admission, progress, unknown, tick/restart and release. Pre-existing nullable bindings belong to parent; current workspace account never reinterprets old SIDs.
3. Transfer status callback accepts only a provider-signed AccountSid matching the persisted transfer's group owner (legacy parent fallback); wrong-account callbacks cannot mutate even before transferCallSid is committed; first early callback binds its SID.
4. Media handshake resolves an untrusted path callSid against trusted stored group ownership and persisted per-call consent, then verifies the matching provider signature. Parent, child, foreign tenant and consent-OFF paths are tested without real audio. Twilio Stream URL uses path, not query (query unsupported by Twilio Streams).

Existing patterns: RedisParallelStore group/call mapping and selectProviderDialerForGroup in runtime/railway.ts; inbound/telephony.integration.test.ts isolated PG harness; transfer-application.acceptance.test.ts; runtime/workspace-twilio.test.ts fake auth token signatures; twilio-boundary.test.ts; call-history-application.test.ts. New migration uses migrations ledger.

New/changed tests: focused authority/usage test for persisted group account; inbound/outbound-account-routing.test.ts plus telephony.integration.test.ts for cutover restart; transfer-application.acceptance.test.ts and twilio-boundary.test.ts signed wrong-account/early callback; runtime/workspace-twilio.test.ts signed Media upgrade account/consent matrix; call-history-application.test.ts Stream URL path/consent.

Focused red: bun test packages/dialer-server/src/runtime/workspace-twilio.test.ts packages/dialer-server/src/inbound/outbound-account-routing.test.ts packages/dialer-server/src/transfer-application.acceptance.test.ts packages/dialer-server/src/twilio-boundary.test.ts packages/dialer-server/src/call-history-application.test.ts

Expected red: wrong-account transfer currently accepted; child media handshake rejected or parent incorrectly selected; completion uses mutable workspace account; outbound recovery and admission use mutable workspace account. Real isolated Postgres integration will then check durable fields and restart.

No-test waiver: none. Record actual red and green outcomes below before production edits.

- 2026-11-07 05:09:14 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/runtime/account-ownership.test.ts`
- `packages/dialer-server/src/runtime/workspace-media-boundary.test.ts`

## workspace-owned: activity log

- 2026-11-07 05:09:14 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:09:52 fs.write: `packages/dialer-server/src/runtime/account-ownership.test.ts`
- 2026-11-07 05:09:52 fs.write: `packages/dialer-server/src/runtime/workspace-media-boundary.test.ts`
- 2026-11-07 05:10:00 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:11:31 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:15:03 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/src/call-history-application.test.ts`
- `packages/dialer-server/src/call-operations/application.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/historical-inbound-fixture.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer-server/src/runtime/railway.ts`

## workspace-owned: validation evidence

- 2026-11-07 05:15:36 `review.run`: passed — OK
- 2026-11-07 05:15:46 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-11-07 05:16:07 `review.run`: passed — OK
- 2026-11-07 05:16:43 `verify`: failed — COMMAND_FAILED
- 2026-11-07 05:16:57 apply-patch: `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- 2026-11-07 05:17:15 `review.run`: passed — OK
- 2026-11-07 05:17:47 `verify`: passed — OK
