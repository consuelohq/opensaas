# verify embedded LeadConnector dialer and prepare safe live-call test

branch: `task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1753/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test
github pr: https://github.com/consuelohq/opensaas/pull/1753
started: 2026-08-01

## acceptance criteria

- [x] In the named LeadConnector sandbox, Opportunities and Contacts each mount exactly one native-page Dial launcher without requiring the user to leave the CRM workflow.
- [x] Opening the launcher creates the compact Worker `/overlay` experience; the sidebar Custom Page remains `/admin` for settings, analytics, permissions, diagnostics, and configuration only.
- [x] Predictive queue calls use the existing shared Whittle-index decision service with learned timing/economics inputs instead of FIFO insertion order.
- [x] Completed answered and all-no-answer carrier groups feed an atomic attempt/outcome learning loop without making callback success depend on model persistence.
- [ ] The Railway deployment containing the new ranker and learning adapter is healthy and verified through runtime logs/probes.
- [ ] The safe-number/live-call boundary is identified and verified without exposing full phone numbers in logs or task notes.
- [x] No carrier call is placed until Ko explicitly approves the exact live-call action at the final checkpoint.
- [x] Every defect changed in this task received a focused failing contract before production code was changed.

## plan

1. Reconstruct the merged LeadConnector embed, call-start, queue-selection, and safe-number boundaries from stream truth.
2. Verify the deployed Worker assets and the currently installed GoHighLevel draft through authenticated browser evidence.
3. Exercise Opportunities and Contacts launcher, popup, minimize/close/reload, and admin/sidebar separation without initiating a call.
4. Repair predictive queue selection and outcome learning through the existing shared dialer contracts.
5. Publish to `stream/dialer`, verify Railway health/runtime behavior, and run no-carrier provider preflight where available.
6. Resolve the redacted safe-number scope and stop at the explicit carrier-call approval boundary.

## current status

- Recovered from merged `stream/dialer`. PR #1682 is merged; PR #1687 was a closed duplicate.
- The installed GoHighLevel draft is correct: Contacts and Opportunities each expose one native Dial launcher and one lazy overlay host. Opening creates exactly one Worker `/overlay` iframe with microphone permission.
- The overlay recovered from an expired authentication handshake through its Retry path and reached the selectable-call state. Minimize, reopen, and close were exercised without starting a call.
- Direct Worker `/admin` renders readiness, performance, inventory, access, and browser diagnostics and contains no call-start, hang-up, or stop-dialing controls. Prior installed-draft evidence confirms the sidebar Custom Page targets `/admin`.
- A real integration gap was found: predictive multiline calls created a temporary queue from selected records, but the standalone Railway adapter resolved that queue FIFO. It also omitted learning for completed no-answer groups.
- The Railway adapter now ranks predictive candidates through the shared `WhittleIndexService`, merging existing shared hazard rows with LeadConnector-learned outcomes. Missing model data degrades deterministically to FIFO.
- Completed carrier legs now atomically update `contact_attempt_ledger` and a LeadConnector outcome table. Learning persistence failures emit a structured event and do not fail an otherwise successful carrier callback.
- No Worker or Marketplace artifact changed, so the installed GoHighLevel draft does not require another reinstall for this backend change.
- No carrier call has been placed.

## files changed

- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer/src/application/process-parallel-callback.ts`
- `packages/dialer/src/application/adapter-application.spec.ts`

## workspace-owned: files changed

- `.task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test/current.json`
- `.task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test/evidence-log.json`
- `.task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test/read-log.json`
- `.task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test/session.json`
- `.task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test/workpad.md`
- `.task/tasks/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test.json`

## TDD evidence

- Predictive ranking red: a fanout-one queue selected the first inserted contact instead of the higher-model-index contact.
- No-answer learning red: a completed no-winner group emitted zero telemetry records.
- Persistence red: the learning adapter did not exist, then returned `undefined`/rejected instead of reporting a non-fatal persistence result.
- Green contracts now prove:
  - shared hazard-model ranking before fanout;
  - LeadConnector-only learned-outcome ranking when shared model rows are absent;
  - atomic attempt and outcome persistence;
  - non-fatal learning persistence failure;
  - exactly-once telemetry for completed no-answer groups;
  - existing terminal-winner lifecycle remains intact.

## validation evidence

- Authenticated GoHighLevel browser verification:
  - Opportunities: one launcher, one host, zero iframe before open, one `/overlay` iframe after open.
  - Contacts: one launcher, one host, zero iframe before open, one `/overlay` iframe after open.
  - Overlay authentication recovery reached selectable-call state.
  - Minimize, reopen, and close passed without duplicate hosts/iframes or a call action.
  - Direct `/admin`: administration sections present; no calling controls.
- `bun test packages/dialer-server/src/runtime/railway.test.ts`: 6 passed, 0 failed, 13 expectations.
- `bun run --cwd packages/dialer-server test`: 44 passed, 0 failed, 216 expectations across 11 files.
- `bun run --cwd packages/dialer-server build`: passed; compiled standalone binary.
- Isolated `packages/dialer-server` TypeScript validation with the existing cached Bun type root: passed with no diagnostics.
- Strict `review.run --base origin/stream/dialer --mine --no-tests`: 0 issues in changed files, 0 blocking issues.
- Two broad shared-package typecheck findings are pre-existing: missing `bun:test`/`Bun` types in `packages/dialer` test configuration. No dependency or lockfile mutation was made for them.

## key decisions

- Treat the native CRM launcher plus `/overlay` as the primary agent experience; treat the sidebar page as administration/analytics only.
- Keep explicit record click-to-call direct. Use predictive ranking for queue/multiline calls only, matching the core contract that queue calls require `selectionStrategy: predictive`.
- Reuse the shared `WhittleIndexService` and existing attempt ledger. Do not create a second scoring formula.
- Merge shared hazard data and LeadConnector-owned observed outcomes by attempt number and sample size.
- When learned inputs or optional shared tables are unavailable, preserve deterministic input order rather than inventing scores.
- Model persistence is observational. It must never make a valid Twilio status callback fail.
- Keep all runtime observability structured and redacted; no phone numbers are written by the new events.

## scope note

- This task makes predictive selection real for the candidate set passed by the embedded overlay. It does not yet turn the launcher into an automatic crawler of every row in the current GoHighLevel filter.
- The current overlay still lets the agent select candidate records. The decision engine determines priority before constrained fanout. A future dedicated “recommend next contact” action would require a candidate-source/recommendation endpoint and is separate from proving live-call correctness here.

## notes for ko

- Full phone numbers, tokens, OAuth codes, and customer PII are not copied into the workpad or chat.
- A real carrier call remains a human approval checkpoint even when the destination is on the configured safe list.

## improvements noticed

- The shared `packages/dialer` tsconfig includes Bun tests without resolving Bun types. This is pre-existing and should be repaired in a separate tooling task.
- The Railway status/log facade has intermittently returned 502 responses. Deployment truth must be rechecked after publish instead of inferred from local validation.

## issues and recovery

- The initial discovery batch did not propagate the outer taskSession to a nested edit-mode `code.call`. No source files changed. Recovered by running the workpad edit directly in the task session.
- One read-only status batch inspected the main checkout because its nested task session was not propagated. It made no changes; all edits and validation remained in the active task worktree.
- A browser open wrapper returned a misleading 502 while the authenticated GHL page had loaded. DOM and accessibility snapshots proved the application state, so verification continued through direct browser evidence.
- The GHL sidebar item uses a `javascript:void(0)` handler that the automation wrapper did not trigger. Prior installed-draft evidence and the direct admin route confirm the Custom Page target; no installed configuration contradiction was found.
- Railway log/status calls previously failed with connector-level 502 responses. This remains unresolved until the post-publish deployment check.

---

## publish checklist

- [ ] Push task branch.
- [ ] Refresh PR #1753 and review final diff.
- [ ] Merge task into `stream/dialer` through the task workflow.
- [ ] Verify Railway deployment status, health, and relevant structured events.
- [ ] Verify safe-number allowlist in redacted form.
- [ ] Run no-carrier provider-test preflight if production credentials/tooling permit.
- [ ] Present the exact redacted live-call scope to Ko and wait for explicit approval.

## workspace-owned: files read

- `.task/dialer/build-lead-connector-admin-and-progressive-overlay/workpad.md`
- `.task/dialer/verify-embedded-leadconnector-dialer-and-prepare-safe-live-call-test/workpad.md`
- `packages/api/src/services/queue-selection.ts`
- `packages/dialer-server/README.md`
- `packages/dialer-server/railway.json`
- `packages/dialer-server/scripts/validate-local-runtime.ts`
- `packages/dialer-server/scripts/validate-provider-test.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/src/application/adapter-application.spec.ts`
- `packages/dialer/src/application/process-parallel-callback.ts`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/services/whittle-index.service.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- `packages/lead-connector/src/embed/view.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/call-timing-store.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/whittle-index-store.service.ts`
- `packages/workspace/senior-engineer.md`

## workspace-owned: validation evidence

- Authenticated GoHighLevel browser verification:
  - Opportunities: one launcher, one host, zero iframe before open, one `/overlay` iframe after open.
  - Contacts: one launcher, one host, zero iframe before open, one `/overlay` iframe after open.
  - Overlay authentication recovery reached selectable-call state.
  - Minimize, reopen, and close passed without duplicate hosts/iframes or a call action.
  - Direct `/admin`: administration sections present; no calling controls.
- `bun test packages/dialer-server/src/runtime/railway.test.ts`: 6 passed, 0 failed, 13 expectations.
- `bun run --cwd packages/dialer-server test`: 44 passed, 0 failed, 216 expectations across 11 files.
- `bun run --cwd packages/dialer-server build`: passed; compiled standalone binary.
- Isolated `packages/dialer-server` TypeScript validation with the existing cached Bun type root: passed with no diagnostics.
- Strict `review.run --base origin/stream/dialer --mine --no-tests`: 0 issues in changed files, 0 blocking issues.
- Two broad shared-package typecheck findings are pre-existing: missing `bun:test`/`Bun` types in `packages/dialer` test configuration. No dependency or lockfile mutation was made for them.
- 2026-08-01 16:28:45 `review.run`: passed — OK
- 2026-08-01 16:29:11 `verify`: passed — OK
