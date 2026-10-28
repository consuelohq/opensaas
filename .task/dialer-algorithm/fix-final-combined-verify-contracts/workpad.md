# fix final combined verify contracts

branch: `task/dialer-algorithm/fix-final-combined-verify-contracts`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2144/fix-final-combined-verify-contracts
github pr: https://github.com/consuelohq/opensaas/pull/2144
started: 2026-08-16

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

- 2026-08-16 07:20:43 fs.write: `.task/dialer-algorithm/fix-final-combined-verify-contracts/workpad.md`
- 2026-08-16 07:24:00 fs.write: `.task/dialer-algorithm/fix-final-combined-verify-contracts/workpad.md`
- 2026-08-16 07:25:23 fs.write: `.task/dialer-algorithm/fix-final-combined-verify-contracts/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 07:24:30 `review.run`: passed — OK
- 2026-08-16 07:25:07 `verify`: passed — OK
- 2026-08-16 07:25:51 `verify`: passed — OK

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

behavior under test: the synchronized Dialer stream must satisfy the shared repository verify contracts under CI load: durable subagent source changes select all three focused durable suites; OS script-parity classifications match the current stream inventory; process-heavy durable lifecycle regressions complete within an explicit realistic CI timeout instead of relying on Vitest's 5s default.
existing local pattern: test-selection expectations enumerate the exact focused suite names; script-parity audit treats the classification JSON as a reviewed mirror of the current `packages/os/scripts` inventory; process-heavy lifecycle tests already use local fake providers and are deterministic but can take longer under multi-suite CI load.
new or changed tests: update the existing test-selection expectation to include `OS durable subagent orchestration contracts`; refresh only stale/missing script-parity entries against the current stream inventory; give the three CI-timed-out lifecycle tests explicit bounded timeouts without changing runtime behavior.
focused red command: run the exact three failing contracts from GitHub CI before edits: the durable-subagent test-selection assertion, script-parity audit, and the three named lifecycle cases under the registry-style selected suite.
expected red failure: test-selection receives 3 suites but expects 2; script-parity baseline differs from inventory; three lifecycle cases can exceed the default 5000ms timeout under selected-suite load.
no-test waiver: not applicable.

## Acceptance criteria

- [ ] Durable subagent selection test expects the three focused suites and still excludes the broad OS package suite.
- [ ] Script-parity baseline exactly equals the current stream OS script inventory with no speculative classifications.
- [ ] The three process-heavy lifecycle tests have explicit bounded CI-safe timeouts and remain behaviorally identical.
- [ ] Focused contracts and the full durable subagent selected suite are green locally.
- [ ] Strict review and canonical verify are clean; promote only to `stream/dialer-algorithm`.

- 2026-08-16 07:20:43 append: `.task/dialer-algorithm/fix-final-combined-verify-contracts/workpad.md`

## RED and GREEN evidence

RED before edits:
- Durable subagent selection assertion failed because registry selected 3 focused suites while the test expected 2.
- OS script parity audit failed because the baseline was missing 10 current scripts; after inventory alignment, compatibility analysis found 2 existing entries (`code-call/policy.ts`, `code-call/types.ts`) whose relationship changed from byte-identical to changed-content.
- The three lifecycle cases pass standalone in ~1s total but GitHub selected-suite CI recorded 5000ms test timeouts under multi-suite load; this is CI-load RED evidence rather than a standalone functional failure.

Implementation:
- Updated focused selection expectation to include `OS durable subagent orchestration contracts` while preserving the assertion that broad `@consuelo/os` package tests are not selected.
- Added exactly 10 current inventory classifications; byte-identical shared files are `same`, changed shared `session-start.ts` is `changed-needs-review`, and OS-only files use conservative `os-only-needs-review` dispositions.
- Reclassified `scripts/lib/code-call/policy.ts` and `scripts/lib/code-call/types.ts` from `same` to `changed-needs-review` because their current Workspace/OS content hashes differ.
- Added one `PROCESS_HEAVY_TEST_TIMEOUT_MS = 15_000` constant and applied it only to the 3 CI-load-sensitive lifecycle tests; runtime wait deadlines and assertions are unchanged.

GREEN after edits:
- Focused test-selection contract: 1/1 passed.
- OS script parity audit: 1/1 passed across the complete 509-script current inventory.
- Durable selected suite: 4 files, 53/53 passed; the three previously timed-out cases completed locally in ~0.3–0.4s each.
- No production Dialer or OS runtime code changed in this task.

### Acceptance progress

- [x] Durable subagent selection expects all three focused suites and excludes the broad OS package suite.
- [x] Script-parity baseline matches current stream inventory and compatibility relationships.
- [x] Three process-heavy lifecycle tests have explicit bounded 15s CI-safe test timeouts with unchanged runtime semantics.
- [x] Focused contracts and full durable selected suite are green locally.
- [ ] Strict review and canonical verify clean.
- [ ] Promote only to `stream/dialer-algorithm`.

- 2026-08-16 07:24:00 append: `.task/dialer-algorithm/fix-final-combined-verify-contracts/workpad.md`

## Final validation

- Strict review: 0 findings / 0 blockers.
- Canonical verify: passed, publish-valid, 3 task files, zero DB risks/findings.
- [x] Strict review and canonical verify clean.
- [ ] Promote only to `stream/dialer-algorithm`.

This task changes only tests and reviewed audit metadata; no Dialer or OS production runtime behavior changes.

- 2026-08-16 07:25:23 append: `.task/dialer-algorithm/fix-final-combined-verify-contracts/workpad.md`
