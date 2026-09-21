# refresh OS script parity baseline

branch: `task/dialer-algorithm/refresh-os-script-parity-baseline`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2070/refresh-os-script-parity-baseline
github pr: https://github.com/consuelohq/opensaas/pull/2070
started: 2026-08-15

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

- 2026-08-15 11:13:16 fs.write: `.task/dialer-algorithm/refresh-os-script-parity-baseline/workpad.md`
- 2026-08-15 11:17:12 fs.write: `.task/dialer-algorithm/refresh-os-script-parity-baseline/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 11:16:59 `review.run`: passed — OK
- 2026-08-15 11:17:00 `review.run`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the committed OS script-parity classification baseline must exactly match the current `packages/os/scripts` inventory so `tests/audit/script-parity-audit.test.ts` passes deterministically in CI.
existing local pattern: use the audit test's canonical inventory/classification helper or repository generator; do not hand-edit classifications unless the repository explicitly requires manual rationale for a script.
new or changed tests: no new behavior test is expected; the existing script-parity audit is the executable contract. Update only the canonical baseline/generated audit artifact if drift is confirmed.
focused red command: `bun x vitest run tests/audit/script-parity-audit.test.ts` from `packages/os`.
expected red failure: `assertClassificationsMatchInventory` reports baseline script paths differing from current `inventory.allScripts`, matching CI on PR #2014.
no-test waiver: not applicable; existing audit test is the contract.

## CI blocker evidence

- Stream head `df8e3984ba81755f973215ce202b89da5636ff64` cleared the prior facade/media failures.
- `Consuelo / workspace contracts` now fails solely because `@consuelo/os` package test reports `tests/audit/script-parity-audit.test.ts` inventory mismatch at line 206/321.
- This is script classification/audit metadata drift; Dialer runtime/model behavior is not implicated.

- 2026-08-15 11:13:16 append: `.task/dialer-algorithm/refresh-os-script-parity-baseline/workpad.md`

## workspace-owned: files read

- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/bun-product-server-contract.test.ts`

## Final implementation and validation

- Updated only `tests/audit/fixtures/script-parity-classifications.json`; no production source changed.
- Current union inventory: 495 scripts (`packages/workspace/scripts`: 179, `packages/os/scripts`: 439).
- Baseline drift repaired:
  - removed 2 stale generated plist classifications no longer present in either script tree;
  - added 102 currently unclassified script paths;
  - reclassified 5 existing entries whose current relationship changed (`confirm.js`, `lib/code-call/service.ts`, `run-dialer-scenario.ts`, `subagent.ts`, `tools-search.ts`).
- New OS-only paths are conservatively `os-only-needs-review`; new workspace-only paths are `workspace-only-needs-port`. The refresh does not falsely mark new code as intentional/equivalent.
- RED: `tests/audit/script-parity-audit.test.ts` reproduced `assertClassificationsMatchInventory` mismatch exactly as CI.
- GREEN: script parity audit 1/1 passed, exit 0.
- GREEN: `tests/bun-product-server-contract.test.ts` 4/4 passed, exit 0.
- Full failed GitHub job enumeration found exactly one failing OS test file: `tests/audit/script-parity-audit.test.ts`; prior media/facade failures are cleared.
- Strict review reported 0 issues/blockers in current changes; it reused a cached review with 29 pre-existing Twenty/dialer findings outside this fixture update. Focused executable audit is the primary validation for this data-only baseline change.

- 2026-08-15 11:17:12 append: `.task/dialer-algorithm/refresh-os-script-parity-baseline/workpad.md`
