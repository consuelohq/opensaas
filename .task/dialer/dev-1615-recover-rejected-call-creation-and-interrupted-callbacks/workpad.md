# DEV-1615 recover rejected call creation and interrupted callbacks

branch: `task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2629
started: 2026-10-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer/src/index.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`


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

## DEV-1615 scope and acceptance
Source: Linear DEV-1615 (read 2026-10-27); explicit stream/dialer base. Resolve definitive create rejection without releasing ambiguous offers; reconcile ownerless dialing/unknown/cancel_pending attempts after crash at capacity release; fence delayed webhooks by attempt/effect identity; terminalize or retry definitively failed pre-customer rep bridge. Preserve all provider-unknown capacity and other agents' ownership. No live calls, merge, or deploy. Do not alter rep readiness, release/build, deployment.
Plan: inspect fresh remote and current implementation, define Postgres-backed focused red tests, implement narrow effect/reconciliation fixes, run green + service-backed review/verify, publish via task push/pr/finish. Controlled carrier evidence remains out of scope without authorization.
## Test-first contract
Behavior under test: four crash/correlation cases above; local existing test conventions pending inspection.
Existing local pattern: pending repository inspection.
New or changed tests: focused Postgres-backed inbound/callback tests.
Focused red command: pending test discovery.
Expected red failure: regressions expose stranded capacity, incorrect attempt binding, and rejection handling.
No-test waiver: none.

- 2026-10-28 02:30:35 append: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 02:30:35 fs.write: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`
- 2026-10-28 02:37:25 fs.write: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`
- 2026-10-28 02:45:22 fs.write: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`
- 2026-10-28 02:46:51 fs.write: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`
- 2026-10-28 02:48:51 fs.write: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/inbound/README.md`
- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/rep-capacity.ts`
- `packages/dialer-server/src/inbound/routing.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony-reconciliation.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer/package.json`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/infrastructure/twilio/create-outcome.ts`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/verify.js`

## TDD red / source evidence (2026-10-27)
Fresh fetch: origin/stream/dialer b37d4c75820b0f2a7ac4e465d49e910eef69085f; task bootstrap ff81c9a7d46061efe101d1a1667f2625b567547a. Test pattern: callback-telephony.integration.test.ts uses isolated migrated databases via CONSUELO_RD6_PG_PORT and simulated carrier. Isolated Postgres 16 at 127.0.0.1:55415 (LC_ALL=C startup) runs without external calls.
Red: CONSUELO_RD6_PG_PORT=55415 bun test packages/dialer-server/src/inbound/callback-telephony.integration.test.ts => 8 pass, 5 fail. Definitive rejected rep create leaves owner unknown; released capacity leaves dialing/cancel_pending; pre-customer rep terminal leaves owner unknown; delayed-webhook attempt scenario setup also fails pending second-retry acceptance and needs fixture repair. Existing ambiguous-provider tests remain green. First production edit permitted.

- 2026-10-28 02:37:25 append: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`

- 2026-10-28 02:37:36 apply-patch: `packages/dialer/src/index.ts`
- 2026-10-28 02:37:36 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`
- 2026-10-28 02:39:28 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`
- 2026-10-28 02:39:42 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`

- 2026-10-28 02:41:35 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`

- 2026-10-28 02:43:50 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`

- 2026-10-28 02:44:41 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
## Implemented + green evidence
Files: packages/dialer/src/index.ts; packages/dialer-server/src/inbound/telephony-commands.ts; callback-telephony.ts; callback-telephony.integration.test.ts. Existing Twilio not-created classifier shared through package index. Definitive rejected offers settle as failed; callback-specific reconciliation drains safely only when every offer is definitively failed/SID absent. Unknown provider creates remain protected. Callback customer URLs encode stable callback+attempt identity; callback webhook validates exact active attempt and status. Reconciles ownerless dialing/unknown/cancel_pending after capacity-release/result-write gap only after known provider legs terminal; failed pre-customer bridge fences pending customer and releases capacity. A previous-test fixture initially retried before reoffer cooldown; repaired to 14-second offset (>12s offer expiry+1s routing reoffer). The new explicit unknown rep-create regression proves capacity retained.
Green Postgres commands: CONSUELO_RD6_PG_PORT=55415 bun test packages/dialer-server/src/inbound/callback-telephony.integration.test.ts => 14 pass, 0 fail, 85 assertions (trace trc_d4c32d5cb3b3). CONSUELO_RD5_PG_PORT=55415 CONSUELO_RD6_PG_PORT=55415 bun test packages/dialer-server/src/inbound/telephony.integration.test.ts packages/dialer-server/src/inbound/callbacks.integration.test.ts => 28 pass, 0 fail (trace trc_8b893f3339b8). cd packages/dialer-server && bun run typecheck => exit0 (trace trc_c62737b2ea2f). git diff --check clean.
Risks: only simulated carrier/Postgres, no approved live call/carrier evidence; rollout of new attempt-identifying callback URLs must account for older in-flight URLs (old reference fails closed, no incorrect binding). No production activation, deployment or main merge.

- 2026-10-28 02:45:22 append: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 02:45:42 `review.run`: passed — OK
- 2026-10-28 02:46:08 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`
- 2026-10-28 02:46:08 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`
- 2026-10-28 02:46:23 `review.run`: passed — OK
- 2026-10-28 02:46:29 `verify`: passed — OK

## Review/verify checkpoint
Strict review.run base origin/stream/dialer: 0 your issues, 0 preexisting, 0 blocking, tests passing after try/catch rule fixes. Initial verify before commit returned passed=false/publishValid=false with 0 files and head bootstrap ff81c9; this verify path appears to inspect committed revision rather than working-tree changes. Will rerun after task.push; do not mistake initial no-files result as validation. No merge or deployment.

- 2026-10-28 02:46:51 append: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`

## Final full verify evidence
Failure diagnosed: default Corepack project-spec rejects Yarn invocation of contacts-build prerequisite because root packageManager is bun@1.3.14. No build/release source changed. Environment-only COREPACK_ENABLE_PROJECT_SPEC=0 resolved Yarn 1.22.22 execution. Full gate with COREPACK_ENABLE_PROJECT_SPEC=0 CONSUELO_RD5_PG_PORT=55415 CONSUELO_RD6_PG_PORT=55415 bun packages/workspace/scripts/verify.js --base origin/stream/dialer --json => review passed, all 3 registry suites passed (dialer specs, contacts prerequisite build, server Hono), DB guard passed, publishValid true, verify.json written; trace trc_9da9c2c336bb. Strict review zero findings. All provider behavior simulated, no live calls.

- 2026-10-28 02:48:51 append: `.task/dialer/dev-1615-recover-rejected-call-creation-and-interrupted-callbacks/workpad.md`
