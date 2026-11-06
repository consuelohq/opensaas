# Build reproducible Dialer human-scenario stress harness and diagnostic capture

branch: `task/dialer/build-reproducible-dialer-human-scenario-stress-harness-and-diagnostic-capture`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2769
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-server/LAUNCH-QA.md`
- `packages/dialer-server/scripts/launch-scenarios.ts`

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

## Test-first contract — DEV-1675

behavior under test: safe, reproducible Dialer human-scenario catalog, selectable deterministic provider-free test lanes, immutable/sanitized acceptance evidence and real-call safety boundaries. No carrier calls during initial implementation.
existing local pattern: packages/dialer-server/src/lab/inbound-simulation-scenarios.ts, inbound-journal-scenarios.ts, scripts/local-dialer-lab.ts, INBOUND-TESTING.md; packaged Bun tests in dialer, dialer-server and lead-connector.
new or changed tests: packages/dialer-server/src/lab/launch-scenarios.test.ts first; explicit tests for exhaustive scenario coverage, stable IDs, required operator actions and invariants, verified automation mapping, finite fanout, one-call authorization, input redaction (tokens, phone numbers, SID, URL params), no fabricated live-pass, evidence lifecycle and unsafe auto-dial prohibition.
focused red command: bun test packages/dialer-server/src/lab/launch-scenarios.test.ts
expected red failure: Cannot find module ./launch-scenarios (or missing exported catalog and evidence functions), prior to adding implementation.
planned implementation: packages/dialer-server/src/lab/launch-scenarios.ts, scripts/launch-scenarios.ts, README launch-runbook and package scripts, with optional small regression fixes only after independently reproducing failures.
verification: focused red/green, existing linked package tests, full package tests, typecheck/build, strict review.run and formal verify. Ship only current verified head without changing other agents' work. Real carrier/live diagnostics require exact fresh source, destination, fanout, recording scope and authorization.

- 2026-11-06 02:00:33 append: `.task/dialer/build-reproducible-dialer-human-scenario-stress-harness-and-diagnostic-capture/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/LAUNCH-QA.md`
- `packages/dialer-server/scripts/launch-scenarios.ts`

## workspace-owned: activity log

- 2026-11-06 02:00:33 fs.write: `.task/dialer/build-reproducible-dialer-human-scenario-stress-harness-and-diagnostic-capture/workpad.md`
- 2026-11-06 02:03:05 apply-patch: `packages/dialer-server/src/lab/launch-scenarios.cli.test.ts`
- 2026-11-06 02:03:05 write: `packages/dialer-server/scripts/launch-scenarios.ts`
- 2026-11-06 02:03:05 fs.write: `packages/dialer-server/scripts/launch-scenarios.ts`
- 2026-11-06 02:03:46 apply-patch: `packages/dialer-server/src/lab/launch-scenarios.test.ts`
- 2026-11-06 02:03:46 apply-patch: `packages/dialer-server/package.json`
- 2026-11-06 02:03:46 apply-patch: `packages/dialer-server/scripts/launch-scenarios.ts`
- 2026-11-06 02:04:48 write: `packages/dialer-server/LAUNCH-QA.md`
- 2026-11-06 02:04:48 fs.write: `packages/dialer-server/LAUNCH-QA.md`
- 2026-11-06 02:05:39 apply-patch: `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- 2026-11-06 02:06:02 apply-patch: `packages/dialer-server/scripts/local-dialer-lab.ts`
- 2026-11-06 02:10:34 fs.write: `.task/dialer/build-reproducible-dialer-human-scenario-stress-harness-and-diagnostic-capture/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 02:08:02 `review.run`: passed — OK
- 2026-11-06 02:09:32 `review.run`: passed — OK
- 2026-11-06 02:09:35 `review.run`: passed — OK
- 2026-11-06 02:09:46 apply-patch: `packages/dialer-server/scripts/launch-scenarios.ts`
- 2026-11-06 02:10:05 `review.run`: passed — OK
- 2026-11-06 02:10:09 apply-patch: `packages/dialer-server/scripts/launch-scenarios.ts`
- 2026-11-06 02:10:24 `review.run`: passed — OK
- 2026-11-06 02:10:53 `verify`: passed — OK

## Implemented and proved — 2026-11-05

- Initial test-first focused red: launch-scenarios.test.ts could not resolve ./launch-scenarios; CLI integration 4 red due missing runner. Subsequent focused green: 10 passed, 0 failed, 310 assertions.
- Built 24 numbered human test scenarios S01–S24 with provider-free allowlisted automated mappings, GHL operator preconditions/actions/expectations and invariant/diagnostic fields.
- Added bash-free Bun test CLI lab:launch with list/show/run/record/report; one-shot carrier scope validator, secret/PII masking, owner-only evidence journal, explicit not-tested/unverified live status. Evidence archived locally under ~/.consuelo/dialer-launch-qa.
- Selected existing regression matrix: 148 passed across 19 files, all 24 scenario automation records captured, none claims live carrier acceptance.
- Full dialer, lead-connector, dialer-server unit/contract suites: 776 pass, 105 skipped service-backed integration cases, 0 failures, 4152 assertions.
- Disposable Postgres/Redis lab: initially red because historical rollback verification fixtures retained forward-only native billing migration 016 in the ledger. Fixed both isolated lab and rollback chain to remove only forward-only 014/015/016 ledger entries in disposable rollback checks, retaining schema and preserving production migration boundaries. Retested lab:verify green 1 pass, 0 fail, 39 assertions.
- Changed server lab catalog to provider-neutral wording to comply with architecture test. Full suite, package typecheck and compiled production build green.
- review.run strict mine=true vs stream/dialer: 0 blocking issues, 0 pre-existing; CLI output/error-handling improvements made and reviewed.
- GHL signed-in acceptance not performed: OS-owned browser redirects to login and no fresh exact source/recipient/fanout one-shot call authorization has been established. No calls, recordings, charges, number purchases, new credentials, or production deployment.
- Scoped task PR #2769, Linear DEV-1675. Unrelated work preserved. Next required gate: formal verify, push task branch, promote to stream; inspect main delta before any merge. No automatic provider effects.

- 2026-11-06 02:10:34 append: `.task/dialer/build-reproducible-dialer-human-scenario-stress-harness-and-diagnostic-capture/workpad.md`
