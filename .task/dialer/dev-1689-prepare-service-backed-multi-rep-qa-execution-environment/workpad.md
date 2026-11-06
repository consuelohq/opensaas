# DEV-1689 prepare service-backed multi-rep QA execution environment

branch: `task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2781/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment
github pr: https://github.com/consuelohq/opensaas/pull/2781
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-06 23:03:07 fs.write: `.task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment/workpad.md`
- 2026-11-06 23:07:02 fs.write: `.task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment/workpad.md`
- 2026-11-06 23:18:00 fs.write: `.task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 23:18:12 `review.run`: passed — OK
- 2026-11-06 23:18:52 `review.run`: passed — OK
- 2026-11-06 23:19:15 `verify`: failed — COMMAND_FAILED
- 2026-11-06 23:20:01 `verify`: passed — OK

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

## Acceptance and plan
User approved all larger-model prerequisites before Luna: build shared service-backed scenario environment, then device/admin features in separate tasks, then frozen Luna execution runbooks. This task owns QA0 only: reuse isolated Postgres/Redis lab; actual seeded caller/rep event schedules; distinct authenticated fixture identities; committed invariant checks/evidence; critical DB-skip inventory and executable worker contract. No carrier credentials/calls, production data/faults, purchases, billing mutations or broad stream merge.

## Test-first contract
behavior under test: seeded multi-rep concurrency must execute actual API/domain/Postgres/Redis effects, detect duplicate owner/oversubscription, replay safely and emit evidence distinct from component or live proof; isolated DB suites must not silently skip.
existing local pattern: inspect src/lab/local-dialer-lab.ts, local-dialer-lab.integration.test.ts, launch-scenarios.ts and existing inbound authority/lab simulation.
new or changed tests: targeted local harness/CLI contract and service-backed capacity/isolation/replay regressions.
focused red command: choose exact tests after reading current lab boundary; run red before implementation.
expected red failure: missing seeded multi-rep schedule/contract, not compilation or incidental environment breakage.
no-test waiver: none for behavior; documentation-only runbook sections use source/readback validation.

- 2026-11-06 23:03:07 append: `.task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment/workpad.md`

## Red evidence
CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1 bun test packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts: expected QA evidence level local-http-postgres-redis, received undefined after otherwise successful isolated lab. Full artifact /tmp/consuelo-qa0-red.log. Implement QA module using current Hono inbound/operator routes, actual Postgres authority and injected provider; retain old component CLI and existing 14-process-failure scenarios. Add optional --qa to existing lab, plus explicit DB-suite runner with credential allowlist. QA0 validates fixture/oracle infrastructure, leaves broad stress/soak execution to Luna lanes.

- 2026-11-06 23:07:02 append: `.task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment/workpad.md`

## Green and scope findings
Service-backed contract passes: actual loopback HTTP + current Hono routes/auth middleware + real Postgres/Redis at 1/2/5/20 distinct rep actors; seeded input order, foreign-owner rejection, two competing acceptances per rep, participant-confirmed synthetic connection, service recreation/index loss, replay and terminal capacity/effect cleanup. Explicit 11-file DB lane ran 86 cases with zero skips. Eight latent gated failures were historical-fixture drift: forward-only014/015/016 ledger entries prevented historical down-chain assertions, and outbound cases omitted commercial schema startup after DEV-1686. Fixed test fixture bootstrap only, preserving production migration guards. Local-only fixture helper rejects non UUID-named RD3–RD6 databases. Initial full diagnostics retained /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-qa-db-failure-RLb4d8/database-suites.log.
Ordinary cross-package regression:791 pass,93 intentionally gated skips,0 fail. Separate enabled integration:5 pass,0 fail including all86 selected DB cases and old14-process-recovery scenarios. Server tsc green. CLI disables dotenv and strips live env for DB children. README documents proof limits. Added exact-path QA-only production-release classification regressions; caught/fixed new QA file paths incorrectly classifying as runtime deployment. No production runtime/data/keys/calls affected. QA0 is a smoke foundation, not full carrier/browser/20-seat throughput proof; broad lane execution remains pending.

- 2026-11-06 23:18:00 append: `.task/dialer/dev-1689-prepare-service-backed-multi-rep-qa-execution-environment/workpad.md`
