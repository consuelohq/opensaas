# RD5 inbound telephony runtime bridge and recovery

branch: `task/dialer/rd5-inbound-telephony-runtime-bridge-and-recovery`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2468/rd5-inbound-telephony-runtime-bridge-and-recovery
github pr: https://github.com/consuelohq/opensaas/pull/2468
started: 2026-09-13

## acceptance criteria

- [x] Preserve the already-live inbound customer carrier leg while an eligible human rep is selected and connected.
- [x] Validate signed public inbound ingress and resolve tenant/DID from configured carrier/account/number ownership.
- [x] Enforce authorized browser/phone endpoint admission against the current assignment generation and shared RD3 capacity authority.
- [x] Persist bridge commands/evidence and reconcile success, failure, and uncertain external effects without false `connected` state or blind duplicate bridge commands.
- [x] Preserve protected capacity while an escaped carrier effect is uncertain; release only after terminal/reconciled state through the shared authority.
- [x] Recover waiting/bridging state across process restart and converge cleanup without orphaned provider legs or capacity ownership.
- [x] Preserve outbound Dialer behavior and shared one-rep/one-voice-capacity semantics.
- [x] Keep transfer seams truthful without claiming unsupported inbound participant-capacity behavior or adding new transfer UI.
- [x] Keep inbound conversation recording/transcription off by default; voicemail remains explicit/configured with retention/deletion behavior.
- [x] Add `areas/dialer/rd/receipts/RD5.md` with bounded evidence and remaining live-test limitations.
- [ ] Pass canonical verify and task-to-stream promotion. Real carrier/audio proof remains separately authorized and is not implied by this task.

## plan

1. Recover the existing RD5 task/worktree and frozen RD graph/design/acceptance contract.
2. Review the inherited implementation by ingress/config, admission/capacity, durable commands/store, carrier/TwiML, reconciliation/restart, and outbound integration.
3. Validate focused behavior, full packages, real isolated Postgres integration, and the local Postgres+Redis failure lab.
4. Fix only RD5-scoped defects and workspace review blockers, then rerun all affected validation.
5. Write the RD5 receipt, run canonical verification, push PR #2468, and promote into `stream/dialer`.

## recovery state

- Recovered existing PR #2468 and its preserved worktree rather than creating duplicate RD5 ownership.
- The user-supplied Codex thread identifier was not directly exposed by the OS catalog, but the exact RD5 branch, PR, worktree, and inherited uncommitted implementation were recovered.
- Working tree at recovery: 42 files changed, 5,179 insertions, 113 deletions.
- Current task diff is approximately 43 files after adding the RD5 receipt and review-compliance edits.
- Current branch is based on the current remote `stream/dialer` RD7A head with zero stream commits missing at validation time.
- Stream-to-main promotion/release remains RD8 scope.

## Test-first contract

behavior under test: RD5 accepts a signed inbound call, preserves the existing caller leg, reserves/offers shared rep capacity, admits only the authorized winning endpoint, issues durable bridge commands, reconciles uncertain provider effects/restarts, and converges cleanup without regressing outbound shared capacity.

existing local pattern: RD1 durable lifecycle/journal contracts, RD2 isolated Postgres/Redis simulator/failure lab, RD3 fenced shared rep-capacity authority, and RD4 deterministic routing/evidence already landed on `stream/dialer`; RD5 composes those authorities rather than creating a second scheduler or allocation store.

recovery baseline: the prior Codex thread left both production and test edits uncommitted. Rewinding 5k+ lines solely to manufacture a historical red state would risk losing preserved work. The inherited focused suite was already green (30/30) when recovered. Later strict review exposed 67 mechanical async error-boundary findings; those were fixed without changing business semantics and all behavioral/service-backed tests remained green afterward.

no-test waiver: not applicable. RD5 is a runtime behavior change and has focused, package, real-Postgres, and local Postgres+Redis validation. Only the unavailable historical pre-implementation red run is a continuation-recovery constraint.

## delivered

- Added signed inbound admission, tenant/DID configuration ownership, bounded wait/DTMF/fallback handling, explicit voicemail path, and authenticated RD7A operator endpoints.
- Added durable telephony sessions/effects/facts, migration 009, provider command dispatch, reconciliation, restart discovery, abandonment cleanup, and guarded rollback.
- Added browser/phone endpoint fencing against assignment generation and the shared RD3 capacity authority.
- Added carrier evidence rules that report `connected` only when caller and rep are actual conference participants and neither is muted/held.
- Composed outbound parallel dialing with the same capacity authority. Partial provider creation persists created-leg/predictive evidence incrementally and ambiguous effects retain capacity.
- Added explicit async error boundaries required by workspace review while preserving normal `Error` instances and normalizing only non-Error rejections.
- Added `areas/dialer/rd/receipts/RD5.md`.

## validation summary

- Focused recovery baseline: 30 passed / 0 failed.
- Dialer package: 252 passed / 0 failed (582 assertions); typecheck and build passed.
- Dialer Server package: 188 passed / 0 failed in the ordinary run (1,037 assertions); typecheck and build passed.
- Isolated real Postgres RD3/RD4/RD5: 34 passed / 0 failed (174 assertions), including 17 RD5 telephony integration cases.
- Isolated Postgres+Redis lab: 1 passed / 0 failed (35 assertions).
- Local smoke lab seed 4242: migration 009 applied, 30 inbound assertions, one concurrent winner, 14 deterministic crash/delivery/replay scenarios, Redis-loss state preservation, all workers exited, and all temporary services/data cleaned up.
- Strict review against `origin/stream/dialer`: 0 findings, 0 pre-existing findings, 0 blockers.
- Canonical verification: pending final publication gate.

## key decisions

- Treat Postgres/durable RD3 capacity as the sole allocation authority; Redis/provider state may accelerate or reconcile but cannot grant competing ownership.
- Permanently unknowable external provider effects retain protected capacity instead of being silently reused.
- Ordinary inbound conversation recording/transcription stays off; explicit voicemail is the only RD5 recording path.
- Inbound transfer participant-capacity behavior is not claimed by RD5; unsupported combinations remain fail-closed.
- No real carrier call, recording/transcription activation, number purchase, provider spend, production deploy, or main promotion is authorized by this continuation.

## issues and recovery

- Workpad was still a starter template despite a substantial inherited implementation; recovered and documented the actual state before further edits.
- RD5 receipt was missing at recovery; now created.
- Strict review initially found 67 `ERROR_HANDLING` findings in new async boundaries. Added explicit normalization boundaries and reran review to 0 findings.
- No live carrier/audio/provider-spend proof was performed; this remains an RD8/manual release gate rather than a hidden RD5 claim.

## publish checklist

- [x] Recover existing RD5 task/PR/worktree.
- [x] Validate focused and package suites.
- [x] Validate isolated real Postgres RD3→RD5 behavior.
- [x] Validate isolated Postgres+Redis failure lab.
- [x] Clear strict workspace review.
- [x] Write RD5 receipt.
- [ ] Canonical verify.
- [ ] Push/update PR #2468.
- [ ] Promote task into `stream/dialer`.

- 2026-09-13 18:06:59 write: `.task/dialer/rd5-inbound-telephony-runtime-bridge-and-recovery/workpad.md`

## files changed

- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/routes/twilio.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `areas/dialer/rd/receipts/RD5.md`
- `packages/dialer-server/src/inbound/operator.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony-config.ts`
- `packages/dialer-server/src/inbound/telephony-configuration-store.ts`
- `packages/dialer-server/src/inbound/telephony-contracts.ts`
- `packages/dialer-server/src/inbound/telephony-endpoints.ts`
- `packages/dialer-server/src/inbound/telephony-migration.ts`
- `packages/dialer-server/src/inbound/telephony-reconciliation.ts`
- `packages/dialer-server/src/inbound/telephony-store.ts`
- `packages/dialer-server/src/inbound/telephony-twiml.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/inbound/twilio-carrier.ts`
- `packages/dialer-server/src/routes/inbound-operator.ts`
- `packages/dialer-server/src/routes/inbound.ts`
- `packages/dialer-server/src/runtime/inbound.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-13 18:06:59 fs.write: `.task/dialer/rd5-inbound-telephony-runtime-bridge-and-recovery/workpad.md`

## workspace-owned: validation evidence

- 2026-09-13 18:07:14 `verify`: passed — OK
- 2026-09-13 18:09:32 `verify`: passed — OK

## workspace-owned: files read

- `packages/workspace/scripts/lib/git.js`
