# DEV-1655 manage rep answering devices

branch: `task/dialer/dev-1655-manage-rep-answering-devices`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2782/dev-1655-manage-rep-answering-devices
github pr: https://github.com/consuelohq/opensaas/pull/2782
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/ANSWERING-DEVICES.md`
- `packages/dialer-server/LAUNCH-QA.md`
- `packages/dialer-server/scripts/launch-scenarios.ts`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/endpoint-resolution.ts`
- `packages/dialer-server/src/inbound/operator.test.ts`
- `packages/dialer-server/src/inbound/operator.ts`
- `packages/dialer-server/src/inbound/rep-devices.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony-contracts.ts`
- `packages/dialer-server/src/inbound/telephony-endpoints.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/lab/bounded-qa-process.test.ts`
- `packages/dialer-server/src/lab/bounded-qa-process.ts`
- `packages/dialer-server/src/lab/historical-inbound-fixture.ts`
- `packages/dialer-server/src/lab/inbound-simulation-scenarios.ts`
- `packages/dialer-server/src/lab/launch-component-cli.test.ts`
- `packages/dialer-server/src/lab/launch-release-classifier.test.ts`
- `packages/dialer-server/src/lab/launch-scenarios.cli.test.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/rep-campaign.ts`
- `packages/dialer-server/src/routes/inbound-operator.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/inbound-operator.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/workspace-pages.ts`

## workspace-owned: files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/ANSWERING-DEVICES.md`
- `packages/dialer-server/LAUNCH-QA.md`
- `packages/dialer-server/scripts/launch-scenarios.ts`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/endpoint-resolution.ts`
- `packages/dialer-server/src/inbound/operator.test.ts`
- `packages/dialer-server/src/inbound/operator.ts`
- `packages/dialer-server/src/inbound/rep-devices.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony-contracts.ts`
- `packages/dialer-server/src/inbound/telephony-endpoints.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/lab/bounded-qa-process.test.ts`
- `packages/dialer-server/src/lab/bounded-qa-process.ts`
- `packages/dialer-server/src/lab/historical-inbound-fixture.ts`
- `packages/dialer-server/src/lab/inbound-simulation-scenarios.ts`
- `packages/dialer-server/src/lab/launch-component-cli.test.ts`
- `packages/dialer-server/src/lab/launch-release-classifier.test.ts`
- `packages/dialer-server/src/lab/launch-scenarios.cli.test.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/rep-campaign.ts`
- `packages/dialer-server/src/routes/inbound-operator.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/inbound-operator.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/workspace-pages.ts`

## workspace-owned: activity log

- 2026-11-06 23:26:24 fs.write: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`
- 2026-11-06 23:44:53 fs.write: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`
- 2026-11-06 23:54:23 fs.write: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`
- 2026-11-06 23:55:51 fs.write: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`
- 2026-11-06 23:59:06 fs.write: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`
- 2026-11-07 00:03:13 fs.write: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 23:36:51 `review.run`: passed — OK
- 2026-11-06 23:45:03 `review.run`: passed — OK
- 2026-11-06 23:53:55 `review.run`: passed — OK
- 2026-11-06 23:54:47 `verify`: failed — COMMAND_FAILED
- 2026-11-06 23:56:21 `verify`: passed — OK
- 2026-11-06 23:59:54 `verify`: failed — COMMAND_FAILED
- 2026-11-07 00:03:44 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract and acceptance
Approved larger-model prerequisite to Luna. Own durable personal answering devices, authenticated self-service Add/Edit/Remove and masked readback, browser preparation status, revision/race fences, and tests. Preserve shared stream/others' work; scoped main release because stream divergence is separately recorded in QA0. Never place calls, enable readiness, purchase numbers or rotate keys.
Behavior: device destination edits persist across server restart, only authorized rep can edit own settings, stale or busy/unknown edits fail; snapshot never claims healthy means configured/verified. Add focused real PostgreSQL and UI regressions before implementation; use existing inbound operator route, capacity lock and runtime tests. Expected red: missing durable device service/API/UI contract. No-test waiver: none. Plan: inspect contracts and provisioning, red tests, durable store/resolution, route/UI, enabled database+UI checks, strict review/full verify, exact-head release and Linear evidence.

- 2026-11-06 23:26:24 append: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`

## Implemented and verified
Red: operator projection expected masked destination/source, received undefined. Added forward-only017 durable personal device store with authenticated encryption bound to workspace+rep, revision CAS under inbound authority lock, provisioned-rep guard, no target identity accepted in body, owner guard including unknown, and readiness withdrawal on save/remove. Legacy defaults remain until first explicit edit; removal tombstone survives restart. Dynamic resolver used by snapshot/readiness/heartbeat/accept/offer preparation/provider dispatch/screening; provider destination captured under lock before command escapes. Browser remains prepared by explicit microphone/Voice registration before ready. UI shows masked suffix/provenance, phone Add/Edit/Remove, busy guard and honest readiness labels; no raw destination in projections or persistent browser storage.
Real Postgres regressions cover save/recreation/encryption/foreign identity/body spoof/stale readiness/actual synthetic offer destination/unknown edit rejection/concurrent edit/removal. Controller and UI regressions pass. Full enabled isolated Postgres/Redis lab green, all11 selected DB files run without skips (88 cases including two new device cases), actual HTTP multi-rep QA and14 process-recovery scenarios retain cleanup. Ordinary regression794 pass,95 gated skip,0fail; server tsc green. Logs /tmp/consuelo-device-lab.log and /tmp/consuelo-device-regression.log. Updated disposable historical fixtures for017, preserving production down guards. QA0 main bb4c24a integrated into owned task via API; committed baseline tree matched before aligning local head22772ce6. One import conflict combined, semantic duplicate rollback calls from formatter merge removed; other work preserved. No carrier calls/readiness/billing/keys changed. Documentation ANSWERING-DEVICES.md. Next: review/fullverify, scoped main-based PR/release, then DEV1657.

- 2026-11-06 23:44:53 append: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`

## QA review corrections included before Luna
Post-merge QA0 review correctly identified synthetic Redis keys unused by inbound services. Removed those no-op deletions from both multi-rep campaign and older inbound simulation, relabeled proof local-http-postgres / simulated-provider-real-postgres-and-worker-processes, and retained only actual Postgres service-recreation/replay claims. Real RedisParallelStore coordination remains a separate benchmark; no Redis recovery claim. Fixed current Linear/PR proof narrative in follow-up evidence. Already-shipped child --no-env-file flag addresses CodeRabbit dotenv comment.
Added bounded90s QA child runner with private TMPDIR. On deadline, kill Bun, inventory only child-owned PostgreSQL data directories and stop daemonized clusters (which are not killed with Bun), preserve partial output, fail closed on leaks/timeout. Enabled regression starts a real PostgreSQL daemon in a blocked child and proves it is stopped, port closed and files removed. New ordinary timeout/CLI tests pass. Older component CLI now rejects --seed because its fixed fixtures never consumed it; does not write an unapplied seed into evidence and uses no-dotenv bounded execution with root cwd. Seeded scheduling remains only the service-backed QA lane. Post-correction enabled lab2pass/48assertions; all88selectedDBcases no skips; multi-rep HTTP/replay/cleanup green. Ordinary full run had only old CLI dry-run seed expectation fail; updated that test to new truthful contract and rerun pending. Strict review zero blockers after all these corrections. Related pre-existing account/provisioning review hypotheses are separately tracked DEV1695 (blocks liveQA5) andDEV1696; no credential or carrier mutations made.

- 2026-11-06 23:54:23 append: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`

## Final local gate evidence
Post-correction ordinary regression797pass/96gatedskip/0fail,893 cases146files. Enabled integration2pass48assertions includes11databasefiles/88cases with zero skips, multi-rep1/2/5/20 and real timeout+daemon cleanup proof. Server tsc and strict review pass. Full verify exposed a related pre-existing launch CLI main error-handling static finding after formatting; wrapped dispatch with causal error context and retained deepest sanitized CLI reason. All5launchCLIregressions pass afterward. Full publish-valid verification rerunning before push. QA0 main release workflow42313250203 succeeded; device runtime remains undeployed. No calls/readiness/provider keys/billing changes.

- 2026-11-06 23:55:51 append: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`

## Pre-release rep permission correction
Initial publish0e02d732 is verified but not merged/deployed. A focused new regression exposed numbers() returning loading whenever admin-only commercialDashboard is null, blocking ordinary reps from personal device controls. Moved personal Receive controls before that guard; Call from inventory stays admin-managed. Verified red→green for null-dashboard rep rendering. Unprovisioned reps see loading/setup guidance rather than an unusable form. Final source re-verification and publish pending; no runtime changes live yet.

- 2026-11-06 23:59:06 append: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`

## Encryption capability review fixed
Valid new PR2782 finding: callback-disabled deployments can omit recipient cipher. Added explicit server deviceEditingAvailable capability and disabled phone editor with guidance unless true; no plaintext fallback and no newly required secret/startup break. API rejects all edits without cipher; existing browser answering remains usable. Added UI red→green and realPG negative/no-secret browser-readiness regression. Provisioned/nonadmin/unprovisioned UI fixtures now explicit. Final ordinary800pass97gatedskip0fail; enabled lab2pass48assertions includes89selectedDBcases/11files zero skips, real deadline/daemon cleanup, multi-rep HTTP smoke. Tsc green. Remaining provisioning hypothesis separately journaled DEV1696. Reverify and push this exact source before merge; prior0e02d732 never deployed.

- 2026-11-07 00:03:13 append: `.task/dialer/dev-1655-manage-rep-answering-devices/workpad.md`
