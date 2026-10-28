# DEV-1614 — readiness, heartbeat, outbound capacity

branch: `task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility`
stream: `stream/dialer`
taskSession: `tsk_ef80b1feb408`
pr: https://github.com/consuelohq/opensaas/pull/2628

## acceptance criteria
- [x] Restored ready browser endpoint is registered with Twilio Voice before readiness is projected; media failure removes browser readiness.
- [x] Server rejects ready with empty or unhealthy endpoints; UI disables Go ready with none.
- [x] Open ready admin renews presence before 120s; away state cannot heartbeat back to ready.
- [x] Outbound reserves same fenced occupied capacity even when inbound away/stale/unprovisioned, without silently opting into inbound.
- [x] Keep unknown provider outcome occupied and stale generations fenced; decline enabled when Accept lacks healthy endpoint.
- [ ] Focused regressions, service-backed Postgres, review and verify; publish task into stream only. No calls, deployment, release, or merge main.

## plan
1. DEV-1614 and remote stream refresh confirmed.
2. Test first: reducer, operator/outbound Postgres integration, controller and view regressions; observe red.
3. Implement distinct outbound admission and lazy rep registration, readiness/heartbeat API, browser restoration and UI disabled-state split.
4. Run green, service-backed and broader validation; inspect git.diff, strict review/verify, task.push and task.pr.

## Test-first contract
behavior: Restored registered browser readiness, fail-closed on denial, no ready with zero healthy endpoints, heartbeat renews only already-ready capacity, independent outbound reservation with shared ownership despite stale/absent inbound provisioning, unknown protected, stale assignment fenced, Decline remains usable.

existing local pattern: `packages/dialer/src/inbound/rep-capacity.test.ts`, `packages/dialer-server/src/inbound/telephony.integration.test.ts` (real isolated Postgres and fake carrier), `packages/lead-connector/src/embed/controller.test.ts` and `inbound-operator.test.ts`.

new tests: domain heartbeat and outbound admission/fences; service-backed operator readiness/heartbeat and outbound away/unprovisioned/concurrent/unknown; restored media/heartbeat and markup decline.

focused red command: `bun test packages/dialer/src/inbound/rep-capacity.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/inbound-operator.test.ts` plus `CONSUELO_RD5_PG_PORT=<loopback> bun test packages/dialer-server/src/inbound/telephony.integration.test.ts`.

expected red: heartbeat/outbound action unsupported, media not prepared on restoration, missing heartbeat, invalid ready committed, outbound needs ready/provisioned browser, bad disabled flags.

no-test waiver: none. No live carrier tests or deployment; use isolated DB and simulated provider.

## files changed
- `packages/dialer/src/inbound/{rep-capacity-contracts,rep-capacity,lifecycle}.ts` and `rep-capacity.test.ts`
- `packages/dialer-server/src/inbound/{operator,outbound-capacity,rep-capacity-projection}.ts`, `telephony.integration.test.ts` and `routes/inbound-operator.ts`
- `packages/lead-connector/src/embed/{controller,inbound-operator,inbound-operator-view,internal-main}.ts` plus controller and operator tests.

## key decisions
- `startFrom: stream` explicitly because unshipped follow-up; remote refreshed to `b37d4c75820b0f2a7ac4e465d49e910eef69085f`, ancestor of task bootstrap.
- Preserve existing callback lifecycle and assignment fencing; never free unknown outcomes on provider timeout.
- Separate outbound occupancy from inbound endpoint/readiness preference; use isolated task worktree and preserve shared main's unrelated dirt.

## notes for ko
- Linear issue https://linear.app/consuelo/issue/DEV-1614/dialer-keep-rep-availability-accurate-across-reloads-idle-time-and
- Task PR #2628 (intermediate), final deliverable stream review PR only.

## improvements noticed
- none yet

## errors / recovery
- Unscoped git fetch was denied: mode=edit requires taskSession; task-scoped fetch succeeded.
- `status` unexpectedly returned shared dirty main; avoid using that for task proof.
- `fs.write` needed force for prebuilt workpad; retrying with force.

## publish checklist
- [x] focused red / green
- [x] Postgres-backed service and mock carrier
- [ ] review.run / verify
- [ ] task.push / task.pr
- [ ] task.finish if safe

- 2026-10-28 02:36:03 write: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 02:36:03 fs.write: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`
- 2026-10-28 02:38:34 apply-patch: `packages/dialer/src/inbound/rep-capacity.test.ts`
- 2026-10-28 02:39:04 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-10-28 02:39:14 apply-patch: `packages/lead-connector/src/embed/inbound-operator.test.ts`
- 2026-10-28 02:40:26 fs.write: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`
- 2026-10-28 02:50:59 fs.write: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`
- 2026-10-28 02:53:09 fs.write: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`
- 2026-10-28 02:55:50 fs.write: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/src/inbound/operator.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer/src/inbound/lifecycle.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/workspace/scripts/verify.js`

## red test evidence — 2026-10-28
- Command: `bun test packages/dialer/src/inbound/rep-capacity.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/inbound-operator.test.ts`.
- Result: 36 pass / 5 expected fail, trace `trc_669230721566`. Fails: restored browser prepare missing, failed prepare not marking away, unanswerable decline disabled, heartbeat action unsupported, outbound offer incorrectly inbound-gated.
- Additional real-Postgres regressions written in `packages/dialer-server/src/inbound/telephony.integration.test.ts` for invalid ready/offline, stale lease renewal, absent/outbound rep concurrent slot reservation+unknown, stale away outbound/inbound isolation. To run with isolated loopback Postgres after dev environment setup.

- 2026-10-28 02:40:26 append: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`

- 2026-10-28 02:41:03 apply-patch: `packages/dialer/src/inbound/rep-capacity-contracts.ts`
- 2026-10-28 02:41:03 apply-patch: `packages/dialer/src/inbound/rep-capacity.ts`

- 2026-10-28 02:42:09 apply-patch: `packages/dialer/src/inbound/lifecycle.ts`
- 2026-10-28 02:42:09 apply-patch: `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- 2026-10-28 02:42:23 apply-patch: `packages/dialer-server/src/inbound/outbound-capacity.ts`
- 2026-10-28 02:42:50 apply-patch: `packages/dialer-server/src/inbound/operator.ts`
- 2026-10-28 02:42:50 apply-patch: `packages/dialer-server/src/routes/inbound-operator.ts`
- 2026-10-28 02:42:50 apply-patch: `packages/lead-connector/src/embed/inbound-operator.ts`
- 2026-10-28 02:42:57 apply-patch: `packages/lead-connector/src/embed/inbound-operator-view.ts`
- 2026-10-28 02:44:17 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-10-28 02:44:36 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-10-28 02:44:36 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-10-28 02:44:59 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-10-28 02:47:18 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-10-28 02:47:18 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-10-28 02:49:24 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- 2026-10-28 02:49:24 apply-patch: `packages/lead-connector/src/embed/inbound-operator-view.ts`

- 2026-10-28 02:50:30 apply-patch: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`
## implementation and validation checkpoint — 2026-10-28
- Domain: `heartbeat` only renews ready+healthy endpoint presence; outbound `offer` reserves exactly one logical browser slot despite inbound away/stale/no provisioned endpoints, but still rejects occupied/cooling slots and requires versioned generation/assignment fences. Outbound `accept` bypasses *inbound-only* freshness and endpoint health tests; external-unknown outcomes retain ownership. Legacy capacity projection permits `unavailable -> reserved` for outbound, returns inactive reps through `available -> unavailable` on verified release.
- Runtime: outbound rep lazily registered inside tenant transaction using same durations as default inbound registration, no implicit inbound opt-in; operator readiness rejects empty/unhealthy selection, authenticated `heartbeat` checks ready/healthy configured rep and refreshes lease.
- Embed: registered browser device restored before projecting ready snapshot; on device failure, server readiness is reconciled to healthy active phone endpoints (or away), with recovery state if reconciliation fails. Admin heartbeat every 30s revalidates browser device before HTTP renewal; Decline no longer blocked by Accept endpoint health.
- Red: 36 pass, 5 fail expected (`trc_669230721566`). Focused green: **41 pass, 0 fail** (`trc_13ffc3176bf9`).
- Real Postgres 16.13 loopback port 55437 + simulated carrier: RD5 telephony suite **22 pass, 0 fail** (`trc_83f0a4f1ade9`); RD3 capacity suite **9 pass, 0 fail** (`trc_999e5a2b2017`); wider inbound suite (RD3/RD5 enabled) **49 pass, 0 fail, 81 discovered incl. opt-in skips** (`trc_e50189f9b2ca`).
- Pure inbound + embed: **153 pass, 0 fail** (`trc_7d266df26406`); typechecks `@consuelo/dialer` (`trc_5f9c9748d8c4`), `dialer-server` (`trc_0e172f821f0f`), `lead-connector` (`trc_dd9862d1b116`) all passed.
- A first broad browser architecture test flagged the word `Twilio` in a new comment (source-layer provider boundary restriction); removed it, reran broad suite green. First lead-connector typecheck caught test fixture's widened `presence` union; corrected literal annotation, green.
- Service lab: no existing Postgres service listening; initialized a **new isolated** test-only cluster under `/tmp/consuelo-dev-1614-tsk-ef80b1feb408-postgres/data`, started on `127.0.0.1:55437` with `LC_ALL=C` to prevent macOS Postgres multithreaded startup FATAL. No production database touched; suite creates/drops ephemeral databases. Shut cluster down after final review.
- Risks: live Twilio browser/device registration and carrier outcomes need integration in deployment owner's environment; 30s heartbeat is subject to browser background timer throttling, so long-suspended tabs can correctly expire; outbound-only policy durations mirror current runtime default and should be deduplicated later through coordinated shared config (out of current scope).
- Separation: no callback lifecycle edits, no live dialing, no deployment/release/build repair, no stream-to-main merge. Shared files edited only inside task worktree.

- 2026-10-28 02:50:59 append: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 02:51:22 `review.run`: passed — OK
- 2026-10-28 02:52:02 apply-patch: `packages/dialer-server/src/inbound/operator.ts`
- 2026-10-28 02:52:02 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-10-28 02:52:16 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-10-28 02:52:37 `review.run`: passed — OK
- 2026-10-28 02:52:44 `verify`: passed — OK

## review/verify checkpoint
- Strict `review.run({strict:true,base:'origin/stream/dialer'})` passed with **0 must-fix, 0 test failures** (`trc_d1b96e3d76be`). Initial review (`trc_ba19403696a9`) flagged 3 explicit async catch requirements; each corrected.
- Post-review combined focused/real-PG test **63 pass, 0 fail** (`trc_c01b23e3fc67`); all three TypeScript typechecks + `git diff --check` pass (`trc_938f12e412d2`).
- First `verify` before commit returned `passed:false,publishValid:false,headSha:04917e8e...` and `files.total:0` (`trc_5878cadab23b`) because it verifies the committed revision rather than worktree edits. Next: `task.push` commits scoped files, then rerun `verify` for exact implementation SHA before `task.pr`.

- 2026-10-28 02:53:09 append: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`

## final pre-publish gate and parallel work
- `verify` first failed despite green source review because its registry calls `yarn nx run @consuelo/contacts:build`; Corepack rejected project `bun@1.3.14`. No package manager or build scripts modified.
- Validation-only environment `COREPACK_ENABLE_PROJECT_SPEC=0` uses the installed Yarn 1.22.22 and succeeds: canonical `bun run verify -- --base origin/stream/dialer --json` returned `exitCode=0,mode=full,publishValid=true`, **4 registry suites passed**, DB guard 0 findings, verification stamp `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/verify.json` (`trc_c5b04655bfab`). This is a tooling workaround, not build/release repair.
- Second remote refresh detected `origin/stream/dialer` advanced from `b37d4c75820b0f2a7ac4e465d49e910eef69085f` to `4bda792af2e2b911658af0422f58f1bbdd8f963f` while this task ran. New DEV-1615 callback lifecycle changes are **disjoint files** (callback-telephony.ts, callback-telephony.integration.test.ts, telephony-commands.ts, packages/dialer/src/index.ts, DEV-1615 task meta). This task did not edit any of those. Preserve the new stream tip in task.pr promotion; no main merge or callback edits.

- 2026-10-28 02:55:50 append: `.task/dialer/dev-1614-restore-rep-readiness-heartbeat-and-outbound-eligibility/workpad.md`
