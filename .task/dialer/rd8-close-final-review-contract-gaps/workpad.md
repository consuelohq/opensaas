# rd8 close final review contract gaps

branch: `task/dialer/rd8-close-final-review-contract-gaps`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2483
started: 2026-09-19

## acceptance criteria

- [x] Cloudflare public-customer traffic carries an HMAC-authenticated per-client identity to Railway; forged, unsigned, stale, or misconfigured production attribution fails closed.
- [x] Confirmed booking cancellation is append-only and crash-safe; immutable `dialer_callback_bookings` rows are never updated or deleted, and uncertain provider cancellation is not repeated.
- [x] Public customer failures use the nested `{ error: { code, message, retryable } }` envelope and the browser client consumes it.
- [x] The booking-cancellation ledger ships as additive migration `20260919_012_callback_booking_events` without rewriting applied RD6/RD7B migrations.
- [x] Focused, full package, real-Postgres, compile/build, and isolated Postgres+Redis lab validation pass without live provider traffic.

## plan

1. Reproduce all three newest-stream Codex findings with focused RED tests.
2. Add authenticated edge identity, append-only booking cancellation evidence, and the standard public error envelope.
3. Preserve migration history with a new additive `012` migration and prove upgrade/rollback behavior.
4. Run focused GREEN, full package tests, typecheck/build, real Postgres integration, and the isolated Postgres+Redis lab.
5. Run strict workspace review and canonical verify against `origin/stream/dialer`, then publish/merge #2483 into the stream.
6. On the new stream head, require exact-head CI plus fresh review before #2436 may merge to `main`; then verify the existing production release workflow.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/README.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/lead-connector/README.md`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/customer.test.ts`
- `packages/lead-connector/src/embed/customer.ts`
- `packages/dialer-server/src/inbound/callback-booking-event-migration.ts`
- `packages/dialer-server/src/runtime/edge-client-identity.test.ts`
- `packages/dialer-server/src/runtime/edge-client-identity.ts`


## key decisions

- `DIALER_EDGE_PROXY_SECRET` is a dedicated Worker/Railway shared secret; the Worker signs the Cloudflare-observed client IP with method/path/query/timestamp, strips spoofable forwarding/internal headers, and the origin verifies with a 60s replay window.
- With edge trust configured, invalid attribution does not fall back to the Railway socket peer for callback admission. Local runtimes with no edge secret intentionally retain socket-peer behavior.
- Provider booking cancellation appends `cancel_dispatched` before the external call and `cancelled` only after durable provider evidence. A lost provider response leaves an explicit unknown state and retries do not call the provider again.
- The cancellation ledger is migration `20260919_012_callback_booking_events`; applied migration `010` remains unchanged from `stream/dialer`.
- No live carrier calls, provider spend, or production mutation is part of task-local validation.

## notes for ko

- The three newest Codex findings were reproducible and are now covered by regression tests.
- Final stream→main merge is still gated on this task landing, fresh exact-head CI/review, and deployment-secret availability.

## improvements noticed

- Customer API creation now accepts an injected fetch boundary, so error-contract tests no longer mutate global `fetch`.
- The local rollback proof now includes the new additive migration rather than silently editing historical migration SQL.

## errors i ran into

- First temporary Postgres starts failed because Homebrew Postgres required `LC_ALL=C`, then because the default initdb role was not `postgres`; the isolated test command now uses `LC_ALL=C` and `initdb -U postgres`.
- A self-added Worker regression caught that reconstructing a Request with object spread changed POST to GET and dropped its body; fixed by cloning the original Request first, then replacing headers.
- Migration/unit/lab fixtures initially expected 11 migrations; the additive ledger correctly makes the current count 12.
- LeadConnector typecheck rejected a bare global `fetch` test stub because Bun's fetch type includes `preconnect`; fixed by injecting a minimal fetch function through `createCustomerEntryApi`.

## validation evidence

- Focused initial RED: 22 pass / 5 expected failures plus missing edge-verifier module, covering all three review findings.
- Focused GREEN after fixes: 30/30; hardened edge subset: 18/18.
- Real Postgres callback integration: 5/5, including append-only cancellation and single-shot unknown provider outcome.
- Dialer Server ordinary suite: 212 pass / 58 intentional service-backed skips / 0 fail.
- Dialer: 261/261 pass. LeadConnector full suite exits 0.
- Dialer Server typecheck + compiled build: pass. LeadConnector typecheck + browser build: pass. Dialer typecheck: pass.
- Isolated dialer lab: pass with real Postgres 16.13 + Redis 8.6.2, 12 migrations, rollback/reapply verified, 30 inbound assertions, 14 crash/replay scenarios, deterministic replay, no production credentials, no external providers, and complete cleanup.
- Diff audit: no `yarn.lock`, no `packages/twenty-server/**`, no logger changes, no `UPDATE`/`DELETE` against `dialer_callback_bookings`, and no flat public-customer `context.json({ error: ... })` responses.
- Strict workspace review against `origin/stream/dialer`: 0 task issues, 0 pre-existing issues, 0 blockers.
- Canonical verify against `origin/stream/dialer`: passed, publish-valid, stamp written. DB safety reported only the expected migration-script warnings and 0 findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
1. Public customer requests proxied through the Cloudflare edge preserve a per-visitor client identity that is authenticated by the edge/server shared trust boundary; direct callers cannot spoof that identity with forwarding/internal headers.
2. Cancelling or rescheduling a confirmed provider booking records cancellation append-only under the immutable booking schema; no UPDATE/DELETE of `dialer_callback_bookings` is required, retries do not falsely report the stale confirmed booking, and provider cancellation failure remains fail-closed.
3. Every public customer error response uses the repository-standard nested `{ error: { code, message } }` envelope with stable codes for validation, auth, conflict, throttling, and not-found cases.

existing local pattern: Cloudflare worker already owns the trusted edge-to-Railway proxy boundary; callback persistence is event/revision oriented and the booking table is explicitly immutable; Dialer Server has shared structured error envelopes in other route families.
new or changed tests: edge worker/server authentication contract tests; callback migration/persistence + unit/integration regression for append-only cancellation; public customer route envelope assertions.
focused red command: run only the affected LeadConnector worker tests plus Dialer Server callback/customer/architecture tests after adding assertions.
expected red failure: current edge proxy does not authenticate a visitor identity, booking reconciliation attempts a forbidden UPDATE, and public customer routes return flat string errors.
no-test waiver: not applicable.

Review source: Codex review `5256106687` on stream head `e95e7aad827616549b13f12aef6c37cafed97141`, comments `4053533585` (P1 edge client identity), `4053533590` (P2 immutable booking history), `4053533593` (P2 error envelope).

- 2026-09-19 15:06:51 append: `.task/dialer/rd8-close-final-review-contract-gaps/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-19 15:06:51 fs.write: `.task/dialer/rd8-close-final-review-contract-gaps/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `areas/dialer/rd/receipts/RD6.md`
- `packages/dialer-server/README.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/callback-migration.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/customer-entry-migration.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lead-connector-boundary.test.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/dialer-server/src/runtime/edge-client-identity.test.ts`
- `packages/dialer-server/src/runtime/edge-client-identity.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer/src/inbound/callback-contracts.ts`
- `packages/lead-connector/README.md`
- `packages/lead-connector/package.json`
- `packages/lead-connector/src/deployment/worker-release.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/customer.test.ts`
- `packages/lead-connector/src/embed/customer.ts`
- `packages/lead-connector/wrangler.jsonc`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/task-push.js`

## workspace-owned: validation evidence

- Focused initial RED: 22 pass / 5 expected failures plus missing edge-verifier module, covering all three review findings.
- Focused GREEN after fixes: 30/30; hardened edge subset: 18/18.
- Real Postgres callback integration: 5/5, including append-only cancellation and single-shot unknown provider outcome.
- Dialer Server ordinary suite: 212 pass / 58 intentional service-backed skips / 0 fail.
- Dialer: 261/261 pass. LeadConnector full suite exits 0.
- Dialer Server typecheck + compiled build: pass. LeadConnector typecheck + browser build: pass. Dialer typecheck: pass.
- Isolated dialer lab: pass with real Postgres 16.13 + Redis 8.6.2, 12 migrations, rollback/reapply verified, 30 inbound assertions, 14 crash/replay scenarios, deterministic replay, no production credentials, no external providers, and complete cleanup.
- Diff audit: no `yarn.lock`, no `packages/twenty-server/**`, no logger changes, no `UPDATE`/`DELETE` against `dialer_callback_bookings`, and no flat public-customer `context.json({ error: ... })` responses.
- 2026-09-19 15:54:49 `review.run`: passed — OK
- 2026-09-19 15:55:15 apply-patch: `packages/lead-connector/src/embed/cloudflare-worker.ts`
- 2026-09-19 15:55:39 `review.run`: passed — OK
- 2026-09-19 15:57:02 `verify`: passed — OK

- 2026-09-19 15:57:18 apply-patch: `.task/dialer/rd8-close-final-review-contract-gaps/workpad.md`
