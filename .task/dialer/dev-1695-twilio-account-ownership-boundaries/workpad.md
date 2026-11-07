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

- `packages/lead-connector/src/embed/team-access-policy.ts`
- `packages/lead-connector/src/embed/workspace-pages.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`


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

- `packages/dialer-server/src/application.ts`
- `packages/dialer-server/src/call-history-application.test.ts`
- `packages/dialer-server/src/call-operations/application.test.ts`
- `packages/dialer-server/src/call-operations/application.ts`
- `packages/dialer-server/src/call-operations/contracts.ts`
- `packages/dialer-server/src/call-operations/persistence.test.ts`
- `packages/dialer-server/src/call-operations/persistence.ts`
- `packages/dialer-server/src/call-operations/ports.ts`
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

## workspace-owned: activity log

- 2026-11-07 05:09:14 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:09:52 fs.write: `packages/dialer-server/src/runtime/account-ownership.test.ts`
- 2026-11-07 05:09:52 fs.write: `packages/dialer-server/src/runtime/workspace-media-boundary.test.ts`
- 2026-11-07 05:10:00 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:11:31 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:15:03 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 05:49:35 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:06:36 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:08:01 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:08:27 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:08:53 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:09:24 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:09:49 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
- 2026-11-07 06:28:20 fs.write: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/src/call-history-application.test.ts`
- `packages/dialer-server/src/call-operations/application.ts`
- `packages/dialer-server/src/call-operations/persistence.ts`
- `packages/dialer-server/src/commercial/team.postgres.integration.test.ts`
- `packages/dialer-server/src/commercial/team.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/historical-inbound-fixture.ts`
- `packages/dialer-server/src/routes/twilio.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/lead-connector/src/contracts/index.ts`
- `packages/lead-connector/src/contracts/team.ts`
- `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/workspace-pages.ts`

## workspace-owned: validation evidence

- 2026-11-07 05:15:36 `review.run`: passed — OK
- 2026-11-07 05:15:46 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-11-07 05:16:07 `review.run`: passed — OK
- 2026-11-07 05:16:43 `verify`: failed — COMMAND_FAILED
- 2026-11-07 05:16:57 apply-patch: `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- 2026-11-07 05:17:15 `review.run`: passed — OK
- 2026-11-07 05:17:47 `verify`: passed — OK
- 2026-11-07 05:52:48 `review.run`: passed — OK
- 2026-11-07 05:53:21 `review.run`: passed — OK
- 2026-11-07 05:54:00 `review.run`: passed — OK
- 2026-11-07 05:54:16 `verify`: passed — OK
- 2026-11-07 06:03:48 `review.run`: passed — OK
- 2026-11-07 06:05:35 `review.run`: passed — OK
- 2026-11-07 06:07:00 `verify`: passed — OK
- 2026-11-07 06:27:36 `review.run`: passed — OK
- 2026-11-07 06:27:53 `review.run`: passed — OK
- 2026-11-07 06:28:14 `verify`: passed — OK

## 2026-11-07 P1 recording ownership audit follow-up

Approval scope: user requested fix the newly confirmed recording callback P1 and ship DEV-1695 plus already-merged DEV-1697; shipping remains gated by exact-head tests and production Railway authentication. Do not read or rotate any production secret or initiate provider calls. Managed task remains isolated, preserve parallel work.

Test-first contract: Signed Twilio recording-status callbacks must be bound to an immutable, durable call-leg account and workspace even after Redis group expiry. Record providerAccountId per created call leg before it is used for recording callbacks; read unique owned call-leg row from Postgres; reject null/ambiguous ownership unless still backed by a signed Redis group and matching stored workspace; compare signed AccountSid to persisted account before any history mutation; scope SQL UPDATE by authenticated workspace. Wrong child, missing Redis, missing durable identity, forged workspace ID, duplicated call SID and unsigned callback must have zero mutations. Existing legitimate in-flight callbacks with matching owner must pass. No recording audio or real provider effects in tests.

Focused red: bun test packages/dialer-server/src/twilio-boundary.test.ts -t 'recording callbacks after Redis'; it must currently accept wrong child/missing ownership, hence red. Test fixture with immutable owner when Redis missing must pass only after repair. Add durable PostgreSQL boundary assertions and call-history group-owner snapshot proof.

Deployment finding: exact billing release job 42343259764 returns 'Invalid RAILWAY_TOKEN' at Configure dialer edge identity secret; no provider secrets exposed. This must be resolved via an authorized credential/permission repair before releasing billing or DEV-1695. Do not bypass or rotate.

- 2026-11-07 05:49:35 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

- 2026-11-07 05:49:41 apply-patch: `packages/dialer-server/src/twilio-boundary.test.ts`

- 2026-11-07 05:50:11 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-11-07 05:50:11 apply-patch: `packages/dialer-server/src/call-operations/ports.ts`
- 2026-11-07 05:50:11 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-11-07 05:50:36 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-11-07 05:50:45 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-11-07 05:50:48 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`

- 2026-11-07 05:50:54 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-11-07 05:50:59 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-11-07 05:51:04 apply-patch: `packages/dialer-server/src/routes/twilio.ts`
- 2026-11-07 05:51:19 apply-patch: `packages/dialer-server/src/call-history-application.test.ts`
- 2026-11-07 05:51:19 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-11-07 05:51:19 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-11-07 05:51:24 apply-patch: `packages/dialer-server/src/twilio-boundary.test.ts`
- 2026-11-07 05:51:44 apply-patch: `packages/dialer-server/src/call-history-application.test.ts`
- 2026-11-07 05:51:44 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`

- 2026-11-07 05:51:56 apply-patch: `packages/dialer-server/src/call-history-application.test.ts`
- 2026-11-07 05:51:56 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-11-07 05:52:12 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`

- 2026-11-07 06:01:48 apply-patch: `packages/dialer-server/src/twilio-boundary.test.ts`
- 2026-11-07 06:02:01 apply-patch: `packages/dialer-server/src/call-operations/ports.ts`
- 2026-11-07 06:02:01 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-11-07 06:02:01 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-11-07 06:02:01 apply-patch: `packages/dialer-server/src/contracts.ts`
- 2026-11-07 06:02:01 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-11-07 06:02:11 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-11-07 06:02:11 apply-patch: `packages/dialer-server/src/call-history-application.test.ts`
- 2026-11-07 06:02:11 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-11-07 06:02:18 apply-patch: `packages/dialer-server/src/routes/twilio.ts`
- 2026-11-07 06:02:33 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- 2026-11-07 06:03:14 apply-patch: `packages/dialer-server/src/twilio-boundary.test.ts`

- 2026-11-07 06:03:27 apply-patch: `packages/dialer-server/src/routes/twilio.ts`

- 2026-11-07 06:04:05 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-11-07 06:04:05 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-11-07 06:04:05 apply-patch: `packages/dialer-server/src/routes/twilio.ts`
- 2026-11-07 06:04:11 apply-patch: `packages/dialer-server/src/twilio-boundary.test.ts`
- 2026-11-07 06:04:11 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`

## 2026-11-07 follow-up — status and customer TwiML callback security

Security reproduction (RED): with Redis group mapping absent, a signed fixture for another active child AccountSid returned HTTP 200 on `/webhooks/twilio/status` and called the call-history persistence layer. A signed foreign child on `/webhooks/twilio/customer-twiml` likewise produced HTTP 200 instead of 401. Both are separate from the already-fixed recording-status bug. After fix, signed callbacks resolve immutable Postgres call-leg owner, reject foreign/ambiguous/different live vs durable accounts, and allow validated Redis-only startup window. The route passes the authenticated owner workspace into `processTwilioStatus`; Postgres call-leg transition updates are workspace-scoped. Recorded owner null is immutable legacy parent, never rewritten by a later workspace child account assignment. Recording and TwiML reuse the same owner-matching check.

Green: `bun test packages/dialer-server/src`: 296 pass / 120 opt-in skipped / 0 fail. `bun test packages/dialer-server/src/inbound/telephony.integration.test.ts` against isolated local PG: 32/32 pass, 193 assertions, including status owner without consent, duplicate CallSid in two workspaces, scoped leg transition and legacy null owner. `bun packages/dialer-server/scripts/verify-native-billing.ts`: 6/6 passed. `bun run --cwd packages/dialer-server typecheck` passed. `review.run strict` against origin/main: 0 blockers. Isolated PG fixture stopped and removed.

Deployment gate: DEV-1697 merge SHA e75e6e36 is in main but GitHub Actions production release fails at `Configure dialer edge identity secret` with `Invalid RAILWAY_TOKEN`. Verified GitHub environment `consuelo dialer / production` has secret `RAILWAY_DIALER_PROJECT_TOKEN` last updated 2026-09-21; Railway project contains the corresponding project token metadata. Local authenticated Railway user may read project tokens but `projectTokenCreate` for this exact project+environment returned GraphQL `Not Authorized`. No new token was created, no GitHub secret mutated, no Twilio/Stripe secrets touched. **Do not circumvent this credential/role gate via ad-hoc deploy.** The PR can pass exact-source verification; production release/smoke is blocked until an authorized Railway admin restores a valid scoped deployment token.

- 2026-11-07 06:06:36 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

## Exact-head CI wait (2026-11-07)
Wait reason: GitHub Actions run 42345593203 for DEV-1695 exact task HEAD c687b6de is in progress; do not merge before exact-head success.
Duration: 15 seconds per bounded attempt, max 2 attempts.
Resume action: run `gh run view 42345593203 --repo consuelohq/opensaas --json status,conclusion,headSha,jobs,url` immediately after waking using Consuelo OS task tools.
Expected signal: run completed with conclusion=success, headSha=c687b6de734b138188f3cb323c59974f3c5586a6, no failed jobs.
Fallback: leave PR as draft and report CI pending/failure; no release or deployment. Separate Railway production token remains invalid and project-token minting was denied; no bypass.

- 2026-11-07 06:08:01 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

CI wait attempt 1: 2026-11-07T06:08:05Z to 06:08:20Z (15s). Immediate `gh run view` observed `in_progress` at correct head c687b6de, changed-files/workflow-security/OS contracts/gateway passed, dialer+verify in progress. Next: second bounded 15s wait then identical exact-head read-only check. Never merge while production token invalid.

- 2026-11-07 06:08:27 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

CI wait attempt 2: 15s bounded wait completed; immediate GitHub read showed run 42345593203 still in_progress at c687b6de with verify+dialer jobs active, other jobs succeeded. Extend once by 15s due running jobs (not a failure). Resume action: same gh run view; success when completed/success/exact-head. Fallback: draft PR remains blocked, report pending to user and stop polling.

- 2026-11-07 06:08:53 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

Exact-head CI check: at 2026-11-07T06:09Z both nonfinal jobs remain running, with active steps `Run workspace verify` and `Build Railway dialer container`; no failure. Next bounded wait 15s; immediately check same SHA and job conclusions; fallback remain draft.

- 2026-11-07 06:09:24 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

CI wait observed: workflow verify has now passed on exact task head c687b6de; only `Consuelo / dialer` build job still active. Next: bounded 15s wait then exact-head checks, no merge/deploy until production credential restored.

- 2026-11-07 06:09:49 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`

- 2026-11-07 06:27:22 apply-patch: `packages/lead-connector/src/embed/team-access-policy.ts`
- 2026-11-07 06:27:22 apply-patch: `packages/lead-connector/src/embed/workspace-pages.ts`
- 2026-11-07 06:27:22 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-07 06:27:22 apply-patch: `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`

## DEV-1697 Starter recovery UI co-release (2026-11-07)
A separate Codex P1 identified `packages/lead-connector/src/embed/workspace-pages.ts:110` disabling the Starter checkbox for **every** Starter owner; `internal-main.ts:1063,1321` forced enabled=true in change/submit even for former owners. Server `commercial/team.ts` deliberately permits revocation when prior owner removed, demoted, or `canCall=false`, and rejects revocation for current eligible admin. Fixed both UI paths with a single pure `isProtectedStarterOwner` / `requestedTeamEnabled` helper; only an eligible callable CRM admin remains protected. Ineligible/demoted Starter owners can uncheck and submit a full revoke, then replacement admin can claim. Browser-rendered JSDOM regression covers eligible admin, removed rights, demotion; UI state and submit policy share one helper. This is co-released with DEV-1695 in the existing isolated PR so there is no intermediate deployment of vulnerable backend alone. Tests: LeadConnector full 266 passed / 0 failed, server 296 passed / 120 opt-in skipped, billing+historical migration isolated PG 6 passed, both build/typecheck passed, strict review 0 blocking issues, formal verification publishValid true. Next exact-head task.push + CI then reviewed release to main; GitHub Actions runs full production dialer pipeline on merged source with Railway and Cloudflare worker and non-call smoke.

- 2026-11-07 06:28:20 append: `.task/dialer/dev-1695-twilio-account-ownership-boundaries/workpad.md`
