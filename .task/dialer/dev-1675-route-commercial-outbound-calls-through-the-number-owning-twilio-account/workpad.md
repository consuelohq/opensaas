# DEV-1686 — Tenant-isolated Twilio commercial calling and Web Voice

task: `tsk_bbb5a6babff9`
branch: `task/dialer/dev-1675-route-commercial-outbound-calls-through-the-number-owning-twilio-account`
stream: `stream/dialer`
task PR: https://github.com/consuelohq/opensaas/pull/2777
Linear: https://linear.app/consuelo/issue/DEV-1686/dialer-route-commercial-twilio-calls-and-web-voice-through-owning
blocks: DEV-1675 S01

## Acceptance criteria

- [x] Query canonical assigned/active commercial caller IDs and owning workspace Twilio subaccount; fail closed on unavailable Voice credentials, cross-user or disabled ownership before provider side effects.
- [x] Use parent-auth scoped child Twilio REST client for call creation, conference winner, status callbacks, cleanup, recording and usage; persist providerAccountId in Redis group for restart recovery.
- [x] Issue matching child-subaccount Web Voice JWT using child API key and TwiML app, without parent/child conference split. Parent JWT remains only for legacy parent-owned workspaces.
- [x] Encrypt new child API key secret with AES-256-GCM + workspace/account AAD, using existing Railway-held encryption root; no plaintext in DB, logs, source or browser.
- [x] Verify child-signed Twilio webhooks with account-specific signing auth token and reject callbacks from wrong authenticated account before group updates; retain legacy parent signed Media Stream handshake only on its exact route.
- [x] Preserve recording/transcription opt-out, fanout 1, no retries/redials, current tenant boundary, existing numbers and billing; native-billing verification green.
- [x] Deterministic tests for fail-closed ownership/credentials, cryptographic envelope, JWT claims, webhooks, group routing/restart and cross-tenant callback fences.
- [x] Strict local formal review zero findings; focused and full suites green; TypeScript/build passes; formal verify publish-valid **prior to final cross-tenant callback additions**; run final verify again.
- [ ] Publish reviewed source through isolated PR #2777 into main without merging the stream backlog; run GitHub exact-head CI, deploy only dialer-server from exact main tree, production smoke and no-call checks.
- [ ] No DEV-1675 S01 carrier call; no live inbound readiness, Keychain edit, Arc interaction, number purchase, billing change or unrelated merges.

## Engineering changes

- `packages/dialer/src/types.ts`: Twilio `authAccountSid`; durable `providerAccountId` fields.
- `packages/dialer/src/infrastructure/twilio/call-provider.ts`, `providers/twilio.ts`, `services/conference.ts`: Twilio REST account-scoped client, parent credentials for child account context.
- `packages/dialer/src/domain/parallel-group.ts`, `ports/parallel-compatibility.ts`, `application/parallel-compatibility-application.ts`: persist provider account with group; require signed Web SDK account matches group before returning conference TwiML.
- `packages/dialer-server/src/runtime/workspace-twilio.ts` and `src/runtime/environment.ts`: verified owning account, encrypted child key, child signed JWT, account-specific webhook signature, parent legacy compatibility.
- `packages/dialer-server/src/runtime/railway.ts`: child Dialer pool with durable account selection for start, callback, cleanup; preflight auth and voice credentials before initiating any provider calls; correct account for usage completion. `createWorkspaceVoiceRuntime`.
- `packages/dialer-server/src/commercial/persistence.ts`: encrypted Voice credential table, idempotent schema. `commercial/application.ts`: workspace-scoped usage resolution.
- `packages/dialer-server/src/contracts.ts`, `application.ts`, `routes/twilio.ts`: expose authenticated account ownership, fence signed callbacks from other Twilio accounts, including recording, customer and agent TwiML.
- `packages/dialer-server/scripts/provision-workspace-twilio-voice.ts`: confirmed, idempotent one-workspace child Voice key/app provisioning, encrypted persistence and rollback of freshly created unused key if DB write fails.
- Tests `packages/dialer-server/src/runtime/workspace-twilio.test.ts`, `twilio-boundary.test.ts`, `packages/dialer/src/application/account-scoped-agent-twiml.test.ts`.

## Verification results

- Before final account callback changes: 257 server tests passed, 93 skipped due to PG lab; 268 Dialer passed; 252 LeadConnector passed. Zero failures. Both TypeScript checks and server compile passed.
- After callback hardening: 21 focused tenant/auth tests passed; both TypeScript checks passed; strict review again zero findings. Run full suites and formal verify after last edit.
- Formal verification had passed all 5 selected suites including disposable PostgreSQL native billing, zero DB guard findings, publish-valid prior to callback hardening.
- Production child account credentials were provisioned **once, authorized by Ko** after verification of the initial scope. One child TwiML app and one child Voice API key created. The API secret was encrypted into commercial credential storage; no provider secret logged. Ten independent read-only checks passed: child account ownership, encrypted DB row, no plaintext, JWT subject child, JWT issuer child key, matching Voice app, production TwiML URL and POST method, key exists on child, active source caller ownership. No live calls, number purchases or transfers.
- Production existing `CONSUELO_SCENARIO_SAFE_FROM_NUMBERS` was previously staged with approved source 3891, preserved 2 prior entries, `railway variable set --skip-deploys`. Running server has not reloaded staged config. The destination ending 2191 stays allowlisted; Keychain untouched.
- Before deployment, PostgreSQL zero unended calls/legs/outbound effects, Twilio owning child zero calls/conferences, Redis zero caller-ID locks. GHL separate headed Chrome signed in with recording OFF and transcription OFF, sequential 1 line, and microphone permission still prompt. Inbound ready=false is not required for outbound.

## Plan and release boundary

1. Final full suites, formal review and `verify` publish-valid.
2. Publish the exact isolated changes to PR #2777; target main for the release to avoid unrelated `stream/dialer` backlog. Do not accidentally promote the stream backlog.
3. Run exact-head GitHub CI and confirm status; merge only verified isolated PR to main.
4. Deploy only Railway production dialer-server from the exact merged tree using existing authenticated CLI if automated workflow still fails due to stale RAILWAY_TOKEN. Do not rotate or expose that token. Worker UI has no changes.
5. Production health/smoke, read-only account JWT and signed-webhook verification, no-call preflight. S01 one-shot prior approval remains unused.

## Notes for Ko

The prior thought that inbound `ready:false` blocked outbound was wrong: existing `inbound/telephony.integration.test.ts` demonstrates outbound reservation when no inbound endpoint is ready. Do not enable inbound automatically. Child account bootstrap is complete but code is not yet deployed. Recording and transcription remain OFF. No live calls have been initiated.

## Improvements noticed

- Separate production integration environment for complete account-scoped Voice SDK/Twilio webhook cycles without consuming live call minutes.
- Existing stale GitHub Actions Railway deploy token should be remediated independently from source release (no credential changes authorized).

## Errors I ran into

- OS command facade rejected a Python heredoc in `code.call`; switched to direct Python code.
- Read-only test imports must use absolute task-worktree path when `code.call` wraps scripts in a temp location.
- One build check created a transient `.bun-build` file in verify mode; automatic rollback confirmed it was not retained.
- Initial strict review flagged 13 style/error handling findings; all fixed; subsequent strict review reported zero.

## Files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-06 04:44:28 fs.write: `.task/dialer/dev-1675-route-commercial-outbound-calls-through-the-number-owning-twilio-account/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 04:44:38 `review.run`: passed — OK
- 2026-11-06 04:44:59 `verify`: passed — OK
