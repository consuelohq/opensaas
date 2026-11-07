# DEV-1697 — Starter authorization and paid team grace
branch: task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states
stream: stream/dialer
PR: https://github.com/consuelohq/opensaas/pull/2791
source main: cced8b89181225532bdf4c26d602d38c1c4b1f2e

## Acceptance criteria
- [ ] Only an explicitly granted Starter owner or valid assigned paid seat can start calls or be authorized for inbound; no unassigned CRM bypass.
- [ ] Initial verified CRM admin can bootstrap one durable Starter grant; foreign/unassigned/second admin fail; revocation and ownership drainage remain safe.
- [ ] Matched signed purchased seat quantity survives active, trialing and valid past_due grace, not unsigned/pending/expired/canceled/mismatched state.
- [ ] Stale generation, duplicate projection, cap and competing admin CAS remain safe.
- [ ] Focused real isolated PostgreSQL tests red then green, strict review/verify, exact-head release smoke, issue evidence update.
- [ ] Protect parallel workers; no live calls, real plan/payment/invitation/credential changes.

## Plan
1. Read commercial/team.ts, billing/application.ts canonical resolver, checkout projection and real PostgreSQL suite.
2. Freeze test command, add failing regressions and capture red.
3. Make narrow changes to commercial/team.ts and necessary runtime injection; use existing durable access grants and canonical billing resolver.
4. Run focused and broad tests, strict review and full verify. Publish only scoped source (not divergent stream wholesale).
5. Report source SHA/tree, green/deploy/smoke evidence and update issue.

## Test-first contract
Behavior: when no subscription, unassigned eligible reps and foreign reps cannot call; first verified admin can bootstrap a durable Starter grant, concurrent admins cannot obtain another. Purchase-before-subscription cannot silently grant team access. Trialing and past_due within configured grace preserve signed seat cap; expired/canceled/pending/mismatched do not. View generation, duplicate projection, concurrency and revocation remain correct.
Existing pattern: packages/dialer-server/src/commercial/team.postgres.integration.test.ts; real private disposable PostgreSQL, fake CRM membership and deterministic rep capacity.
Changed tests: add distinct authorized/foreign/unassigned reps, first-call bootstrap and second-admin rejection, pending purchase and canonical billing state table with active/trialing/grace/expired/canceled/mismatch/unsigned, plus stale-generation and CAS coverage.
Frozen focused red/green command: CONSUELO_RD5_PG_PORT=<private-loopback-disposable-PG> bun test packages/dialer-server/src/commercial/team.postgres.integration.test.ts
Expected red: an unassigned CRM rep currently passes assertCanCall without subscription; trialing and grace project zero seats.
No-test waiver: none.

## Files changed
- none yet

## Key decisions
- Signed purchase + matching provider subscription, same canonical resolveBillingAccess policy and configured grace, existing durable access rows.
- Do not modify Stripe products, checkout logic, invitations or live phone state.

## Notes for Ko
- PR #2791 from fresh main cced8b89. Stream review PR #2765 contains unrelated work and must not be released wholesale.

## Errors and recovery
- session.start required title and area; corrected to startFrom main.
- fs.search path for checkout was absent; corrected to src.
- fs.write needs force=true to replace existing starter workpad; corrected.

## Publish checklist
- [ ] red proof
- [ ] green and full tests
- [ ] strict review
- [ ] full verify
- [ ] task push + scoped promotion
- [ ] exact-source deploy and smoke
- [ ] Linear issue evidence

- 2026-11-07 05:10:29 write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-07 05:10:29 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:10:46 apply-patch: `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- 2026-11-07 05:11:31 apply-patch: `packages/dialer-server/src/commercial/team.ts`
- 2026-11-07 05:11:35 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-11-07 05:15:40 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/commercial-application.acceptance.test.ts`
- `packages/dialer-server/src/commercial/application.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/routes/commercial.ts`
- `packages/dialer-server/src/routes/inbound-operator.ts`

- 2026-11-07 05:14:48 apply-patch: `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- 2026-11-07 05:14:58 apply-patch: `packages/dialer-server/src/commercial/team.ts`
- 2026-11-07 05:15:18 apply-patch: `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- 2026-11-07 05:15:26 apply-patch: `packages/dialer-server/src/commercial/team.ts`
## Implementation and observed evidence (2026-11-07)

- Source checkout initial main cced8b89181225532bdf4c26d602d38c1c4b1f2e.
- Code changes: commercial/team.ts gains signed, matching purchase/subscription seat projection shared by view and assertCanCall, canonical resolveBillingAccess grace and clock; first authenticated CRM admin gets one durable Starter access row and immutable audit revision, with transaction/advisory serialization. Unassigned or unsigned seats fail closed. Explicit Starter grant survives a pending unpaid purchase, but another admin cannot bootstrap once a grant exists. Paid admitted only via an active assigned seat. runtime/railway.ts injects configured paymentGraceDays. Real database tests in team.postgres.integration.test.ts.
- Test-first original red: 7 pass / 4 fail, proving unassigned CRM pass, pending purchase pass, trialing/grace vanished. Additional red: unsigned subscription row improperly admitted an active seat (13 pass / 1 fail), and prior Starter owner denied during pending purchase (14 pass / 1 fail). Implemented fixes only after reproducing.
- Focused latest green: 15 pass, 0 fail, 82 assertions, disposable localhost PostgreSQL v16 and fake CRM/provider; includes grace exact boundary, stale provider generation, duplicate projection, concurrent admin CAS, revocation + uncertain owner draining, pending purchase and signed matching trial/grace.
- Initial typecheck: bun run --cwd packages/dialer-server typecheck -> exit 0.
- Initial ordinary suite: bun test packages/dialer-server/src -> 276 pass, 110 expected database skips, 0 fail; database paths separately executed.
- Full lab via package script bun run --cwd packages/dialer-server lab:verify -> 100 pass / 1 fail in database lane due **existing path bug in unrelated inbound/routing.integration.test.ts child Bun.spawn -e import**, which resolves ./packages/dialer-server/... relative to packages/dialer-server and cannot import. Exact log /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-qa-db-failure-OnDMHk/database-suites.log. No commercial suite failures. Recovery used equivalent root-invoked lab: CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1 bun test packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts -> 2 pass / 0 fail, full PostgreSQL/Redis and teardown; no unrelated code edited.
- Risk boundary: no real Stripe/CRM/Twilio modifications and no calls. The change relies on existing trusted checkout projection and authenticated CRM directory. User requested scoped release only; do not merge stream/dialer PR #2765 wholesale.
- Outstanding at this writing: strict review, formal verify, scoped task publish/promotion, exact-source CI/release/smoke, Linear update. Do not label issue Done before these.

- 2026-11-07 05:15:40 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

## workspace-owned: validation evidence

- 2026-11-07 05:16:02 `review.run`: passed — OK
- 2026-11-07 05:16:07 apply-patch: `packages/dialer-server/src/commercial/team.ts`
- 2026-11-07 05:16:32 `review.run`: passed — OK
- 2026-11-07 05:16:51 `verify`: passed — OK
