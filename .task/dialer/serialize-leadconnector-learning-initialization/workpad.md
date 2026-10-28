# serialize LeadConnector learning initialization

branch: `task/dialer/serialize-leadconnector-learning-initialization`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1754/serialize-leadconnector-learning-initialization
github pr: https://github.com/consuelohq/opensaas/pull/1754
started: 2026-08-01

## acceptance criteria

- [x] Add a focused contract proving the learning table creation resolves before index creation begins.
- [x] Serialize LeadConnector learning schema initialization without changing table/index definitions or callback behavior.
- [x] Preserve all predictive ranking and outcome-learning tests.
- [ ] Build an exact Linux artifact from the merged stream commit containing the fix and deploy it to Railway dialer-server.
- [ ] Verify the new deployment is healthy, startup logs contain no missing-relation error, database objects exist, and both public health routes return HTTP 200.
- [x] Place no provider or carrier call.

## plan

1. Reproduce the initialization race through a controlled database promise contract.
2. Change initialization from concurrent Promise.all to ordered promise chaining.
3. Run focused and full dialer-server validation plus strict review/verify.
4. Merge the follow-up into stream/dialer, cross-compile the exact stream source, and deploy through the proven minimal Railway lane.
5. Verify deployment, schema, logs, health, and no-call boundary.

## current status

- Focused red reproduced the race: two queries were invoked while the table promise remained unresolved.
- Initialization now chains CREATE TABLE, then CREATE INDEX. The schema definitions and runtime call sites are unchanged.
- Focused test, all 45 dialer-server tests, build, isolated TypeScript, and strict review pass.
- Production deployment 33f2f2ef-9f6e-431e-af98-cd39e017a17f remains reachable but logged PostgreSQL 42P01 during the bad startup attempt. The corrected source is ready to publish and redeploy.
- No provider or carrier call has been placed.

## test-first contract

- Behavior: initialization must not invoke CREATE INDEX until the CREATE TABLE query has resolved.
- Controlled seam: a fake LeadConnectorDatabase keeps the table query pending and records query invocation order.
- Expected red: current Promise.all implementation invokes both statements immediately, so the contract observes two calls before the table promise resolves.
- Green condition: one table call while pending, then the index call only after table resolution, and the initializer resolves after both.

## files changed

- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-01 16:44:21 `review.run`: passed — OK
- 2026-08-01 16:44:22 `review.run`: passed — OK
- 2026-08-01 16:44:45 `verify`: passed — OK

## key decisions

- Treat schema initialization ordering as the root cause; do not add retries that conceal it.
- Keep database learning observational/non-fatal after startup, but schema bootstrapping itself must be deterministic.
- Redeploy only after source is merged to stream/dialer and byte-matched.

## validation evidence

- Red: focused initialization test expected one call while CREATE TABLE was pending; received two.
- Green: focused initialization test 1/1, 4 expectations.
- Full dialer-server suite: 45 passed, 0 failed, 220 expectations across 12 files.
- Standalone executable build passed.
- Isolated TypeScript validation passed.
- Strict review: 0 issues, 0 blockers.

## notes for ko

- This follow-up changes only startup ordering. It does not alter dialing, candidate selection, Twilio configuration, or call permissions.

## improvements noticed

- none yet

## issues and recovery

- The prior review-driven Promise.all refactor introduced a DDL dependency race: index creation can run before table creation commits. Railway logs provided the production reproduction.
- The first discovery batch did not propagate the outer taskSession to its nested edit call and stopped before other steps. No source changed; discovery resumed through direct task-scoped calls.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet
