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

- `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- `packages/dialer-server/src/commercial/team.ts`
- `packages/dialer-server/src/runtime/railway.ts`

## workspace-owned: files changed

- `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- `packages/dialer-server/src/commercial/team.ts`
- `packages/dialer-server/src/runtime/railway.ts`

## workspace-owned: activity log

- 2026-11-07 05:10:29 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:10:46 apply-patch: `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- 2026-11-07 05:11:31 apply-patch: `packages/dialer-server/src/commercial/team.ts`
- 2026-11-07 05:11:35 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-11-07 05:15:40 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:18:55 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:19:37 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:20:24 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:21:08 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:21:44 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:22:31 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:24:04 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:25:01 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:28:52 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
- 2026-11-07 05:29:51 fs.write: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/TEAM-ACCESS.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/billing/application.ts`
- `packages/dialer-server/src/billing/native-checkout.ts`
- `packages/dialer-server/src/commercial-application.acceptance.test.ts`
- `packages/dialer-server/src/commercial/application.ts`
- `packages/dialer-server/src/commercial/persistence.ts`
- `packages/dialer-server/src/commercial/team-schema.ts`
- `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- `packages/dialer-server/src/commercial/team.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/plans/catalog.ts`
- `packages/dialer-server/src/routes/commercial.ts`
- `packages/dialer-server/src/routes/inbound-operator-access.test.ts`
- `packages/dialer-server/src/routes/inbound-operator.test.ts`
- `packages/dialer-server/src/routes/inbound-operator.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/lead-connector/src/application/team-members.ts`
- `packages/lead-connector/src/embed/internal-main.ts`

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
- 2026-11-07 05:24:33 `review.run`: passed — OK
- 2026-11-07 05:29:11 `review.run`: passed — OK
- 2026-11-07 05:29:43 `verify`: passed — OK

## CI wait checkpoint (2026-11-07T05:19Z)
Wait reason: exact-head GitHub Actions run 42342137892 is still in progress for SHA 624084522540bada71495f9b3edac2d6ec7d257d; do not merge before independent CI.
Duration: 30 seconds, bounded; recheck immediately and repeat only as needed.
Resume action: OS github raw gh run view 42342137892 with status, conclusion, headSha, jobs.
Expected signal: completed/success and all selected critical CI jobs success, headSha unchanged.
Fallback: if still queued/in_progress, repeat bounded polling; if failed, inspect exact failing jobs/logs and stop release until attributable failures resolved.

- 2026-11-07 05:18:55 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
CI wait checkpoint 1 wake: 2026-11-07T05:19:28Z. Run still in_progress at exact SHA 62408452. Changed-files, workflow-security, OS contracts, Sites/Cloudflare completed success; dialer and verify in_progress. Next bounded wait: 30s; recheck same run and job conclusions; on any failure stop and diagnose; do not merge until completed success.

- 2026-11-07 05:19:37 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
CI wait checkpoint 2: 2026-11-07T05:20:09Z still in_progress. Dialer job building Railway Docker image; verify job running workspace verify. Next wait 30s; then exact GitHub run status/headSha and job conclusions. Success=run completed success, failure=investigate logs and stop release.

- 2026-11-07 05:20:24 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
CI wait checkpoint 3: 2026-11-07T05:20:55Z. Workspace verify now completed/success; only dialer Docker build remains. Next bounded wait 20s, then inspect run 42342137892 status/headSha/job conclusions; hold merge until completed success.

- 2026-11-07 05:21:08 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
CI wait checkpoint 4: 2026-11-07T05:21:28Z. Dialer source tests/typechecks/build and all other CI jobs passed; Docker Railway image build in_progress since 05:20:05Z. Next 20-second wait, then exact CI status/job conclusions; no merge on pending or failure.

- 2026-11-07 05:21:44 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
CI checkpoint 5: 2026-11-07T05:22Z exact-head workflow 42342137892 completed SUCCESS, SHA 62408452. Main comparison behindBy0, only 8 scoped files. Final PR #2791 merge state UNSTABLE due external CodeRabbit IN_PROGRESS since 05:18:05Z, so no merge yet. Wait reason: external review completion. Duration: 30s. Resume: OS github pr.checks + pr.view. Success=review completed and PR clean; fallback=continue bounded polling or report blocker; never bypass pending review blindly.

- 2026-11-07 05:22:31 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

- 2026-11-07 05:23:29 apply-patch: `packages/dialer-server/src/routes/inbound-operator-access.test.ts`
- 2026-11-07 05:23:37 apply-patch: `packages/dialer-server/src/routes/inbound-operator.ts`

## Post-CI review finding and test-first follow-up

- 2026-11-07T05:23Z: exact-head GitHub CI on previous SHA 62408452 succeeded, but PR was UNSTABLE because CodeRabbit review pending. Codex completed code review on the same SHA and raised P1: `packages/dialer-server/src/routes/inbound-operator.ts` skips `authorizeRep` on heartbeat; a rep can renew inbound presence after revocation.
- Additional frozen focused test: `bun test packages/dialer-server/src/routes/inbound-operator-access.test.ts`. Added denial scenario requiring heartbeat 409 and no operator invocation when revoke, while readiness(false), decline, wrapUp and snapshot remain allowed; added permitted heartbeat (200) when current auth is valid.
- Observed RED before production edit: 0 pass, 2 fail. Revoked heartbeat returned 200 instead of 409 and eligible heartbeat never called authorizeRep (expected 1, received 0).
- Narrow change: authorizeRep on heartbeat as well as readiness(true) and offers/accept; leave readiness(false), decline, wrap-up and read-only snapshot unblocked. Frequency: UI sends ready heartbeat every 30s, so each renewal now checks current CRM directory/billing/seat before prolonging presence.
- New code files: `packages/dialer-server/src/routes/inbound-operator.ts`, `packages/dialer-server/src/routes/inbound-operator-access.test.ts`. Initial GREEN after edit: 2 pass, 0 fail, 14 assertions. Formal review, full verify, new exact-head CI and scoped release must be repeated on revised SHA; old green CI does not authorize merge.

- 2026-11-07 05:24:04 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

## Follow-up validation complete before new publication

- 2026-11-07T05:24Z: strict review `review.run --strict --mine`: zero findings, zero blockers, zero failed suites.
- `bun run --cwd packages/dialer-server typecheck`: exit 0.
- `bun test packages/dialer-server/src`: 277 pass, 114 expected PG integration skips, 0 fail, 1761 assertions.
- `CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1 bun test packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts` (repo-root): 2 pass / 0 fail; disposable PostgreSQL/Redis release lab and owned daemon cleanup, ~35s.
- New narrow heartbeat test: 2 pass, 14 assertions (earlier red 2 fail). Previous commercial/team suite: 15 pass 82 assertions (PG). No external provider calls.
- Outstanding: new formal verify, task.push revised SHA, exact-head GitHub CI, external review, direct scoped main merge, production Railway/Cloudflare release and safe smoke, issue evidence/status finalization.

- 2026-11-07 05:25:01 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

- 2026-11-07 05:27:54 apply-patch: `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- 2026-11-07 05:28:20 apply-patch: `packages/dialer-server/src/commercial/team.ts`

- 2026-11-07 05:28:45 apply-patch: `packages/dialer-server/TEAM-ACCESS.md`
## CodeRabbit three Major findings — test-first resolution (2026-11-07T05:28Z)

Confirmed review on original 62408452 after GitHub CI success; these are actual customer access blockers:
1. Legacy signed Stripe subscription and active `dialer_team_seats` lack any public purchase, so original strict public-purchase check falsely denies all calls. Added PostgreSQL positive verified subscription-item test across active/trial/grace/canceled and negative seat plan mismatch; legacy only when no public purchase, requires provider subscription ID and positive trusted subscription-item quantities; existing unsigned subscription/seat test still rejects.
2. Public checkout disabled after claim can leave `dialer_public_purchases.provider_status` at past_due even after signed subscription status returns active. Changed projection from exact same status to confirmed previously paid trusted statuses + matching subscription ID; canonical live subscription/grace solely determines current call entitlement. Pending, canceled, unmatched ID and `paid_at=NULL` remain blocked.
3. Starter owner demoted/removed cannot be transferred, while demoted canCall user continued using grant. Added 2 recovery tests: secure CRM-admin-only revocation when original owner is ineligible or removed, roster shows missing owner as unavailable for UI selection, two transactionally serialized mutations with separate immutable revisions/events, new admin self-claims after old is disabled. Role-demoted owner can no longer call; eligible owner cannot be displaced; stale view rejected; only one enabled Starter grant.

Frozen existing PG focused command: `CONSUELO_RD5_PG_PORT=<disposable-loopback-port> bun test packages/dialer-server/src/commercial/team.postgres.integration.test.ts`.
Observed RED with added tests before production changes: 15 pass, 4 fail (demoted Starter still authorized, disappeared owner not visible, verified legacy paid seats=0, signed purchase active/subscription trialing mismatched=0). GREEN after narrow production edit: 19 pass, 0 fail, 103 assertions, isolated PostgreSQL; external network/billing not exercised.
Also documented authoritative state, compatibility, recovery and heartbeat rules in `packages/dialer-server/TEAM-ACCESS.md`.
Outstanding: strict review, full lab, full verify/new stamp, push revised commit, exact-head GitHub CI (old 62408452 green no longer sufficient), fresh external review, scoped main merge and automatic exact-source Railway/Cloudflare production smoke; Linear final evidence.

- 2026-11-07 05:28:52 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`

## Final revised-source pre-publish gates (2026-11-07)

- Scoped additional changes: commercial/team.ts, team.postgres.integration.test.ts, routes/inbound-operator.ts, routes/inbound-operator-access.test.ts, TEAM-ACCESS.md; original runtime/railway.ts injection retained from prior commit. Five changed product/document files plus task evidence; no unrelated stream or live provider changes.
- Strict `review.run --strict --mine`: zero findings, zero blockers.
- `bun run --cwd packages/dialer-server typecheck`: green.
- `bun test packages/dialer-server/src`: 277 pass / 118 database-dependent skips / 0 fail, 1761 assertions (database suites run separately).
- Disposable PostgreSQL/Redis service-backed lab (root cwd): 2 pass / 0 fail; 49 outer assertions and all internal DB suites; owned daemons torn down.
- Focused commercial PostgreSQL test-first suite: 19 pass / 0 fail / 103 assertions, after 4 targeted red failures.
- Heartbeat route authorization test-first: 2 pass / 0 fail / 14 assertions, after 2 targeted red failures.
- Formal managed `verify`: passed, publishValid=true, zero database risks/findings, scoped registry suites (dialer server package) green, new verify stamp written.
- Previous GitHub Actions run 42342137892 green only for old SHA 62408452; **must rerun on revised pushed SHA** before merge. CodeRabbit's original 3 Major findings now reproduced and addressed.

- 2026-11-07 05:29:51 append: `.task/dialer/dev-1697-fix-starter-assignment-authority-and-preserve-team-seats-during-entitled-billing-states/workpad.md`
