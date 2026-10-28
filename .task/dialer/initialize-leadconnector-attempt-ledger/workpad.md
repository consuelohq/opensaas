# initialize LeadConnector attempt ledger

branch: `task/dialer/initialize-leadconnector-attempt-ledger`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1756/initialize-leadconnector-attempt-ledger
github pr: https://github.com/consuelohq/opensaas/pull/1756
started: 2026-08-03

## acceptance criteria

- [ ] Initialize the canonical `contact_attempt_ledger` table and last-attempt index in the standalone dialer database.
- [ ] Create the ledger before outcome persistence can execute and preserve deterministic DDL ordering.
- [ ] Preserve the existing LeadConnector outcome table and index.
- [ ] Pass focused/full dialer-server validation, strict review, and publish verification.
- [ ] Merge into `stream/dialer`, deploy an exact merged artifact, and verify both database objects plus healthy startup.
- [ ] Backfill exactly the already-completed 0892 -> 2191 call as a machine/no-answer attempt.
- [ ] Verify one ledger row and one LeadConnector outcome row without placing another carrier call.

## plan

1. Strengthen the initialization contract to require ledger table/index before outcome table/index.
2. Add the canonical text-keyed ledger schema and deterministic sequential initialization.
3. Run focused/full validation, strict review, and the publish safety gate.
4. Merge and deploy the exact stream artifact to Railway.
5. Verify schema, then persist the already-completed call telemetry exactly once without invoking Twilio.

## current status

- The authorized call occurred exactly once: 0892 -> 2191, 7 seconds, AMD `machine_start`.
- The previous hotfix deployed successfully; signed callback replay returned 200, completed the group, completed the leg, and released the caller-ID lock.
- Learning persistence logged `relation "contact_attempt_ledger" does not exist`, so no ledger or outcome row was written.
- The standalone ranker also reads this table, so its absence forces predictive selection to fall back to input order.
- Canonical schema exists in the Twenty runtime migration and uses text workspace/contact keys, matching external LeadConnector IDs.
- No additional call is authorized or required.

## test-first contract

- Behavior under test: initialization issues four dependent DDL statements in order: ledger table, ledger index, outcome table, outcome index.
- Controlled seam: a fake database keeps the first ledger-table query pending and records query invocation order.
- Expected red: current initialization begins with the outcome table and emits only two statements.
- Focused command: `bun test packages/dialer-server/src/runtime/lead-connector-learning.test.ts`.
- No-test waiver: none.

## files changed

- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts` (test first)
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-03 16:40:41 `review.run`: passed — OK
- 2026-08-03 16:40:41 `review.run`: passed — OK
- 2026-08-03 16:40:51 `verify`: passed — OK

## key decisions

- Reuse the canonical ledger columns and text primary key from the existing Twenty migration.
- Own the minimal ledger schema in standalone startup because its PostgreSQL service is intentionally independent.
- Backfill through the production telemetry persistence function after deployment; do not edit rows manually and do not replay a carrier call.

## notes for ko

- The phone call itself is finished; this task only restores the optimization/learning record that failed afterward.

## improvements noticed

- none yet

## issues and recovery

- Callback lifecycle repair succeeded, but telemetry persistence exposed the missing ledger relation.
- Because telemetry claim is already set on the completed group, backfill must call the same persistence function directly exactly once after schema initialization.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```


## implementation evidence

- Focused red observed two existing outcome DDL calls before any ledger creation.
- Added the canonical text-keyed `contact_attempt_ledger` table and workspace/last-attempt index.
- Startup now serializes ledger table -> ledger index -> outcome table -> outcome index.


## validation evidence

- Focused red: initializer emitted two outcome-model DDL statements before any ledger creation.
- Focused green: 1 passed, 0 failed, 6 expectations.
- Dialer-server suite: 45 passed, 0 failed, 222 expectations.
- Standalone dialer-server build passed.
