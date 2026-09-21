# repair OS synthetic dry-run CI contract

branch: `task/dialer-algorithm/repair-os-synthetic-dry-run-ci-contract`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2069/repair-os-synthetic-dry-run-ci-contract
github pr: https://github.com/consuelohq/opensaas/pull/2069
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

- 2026-08-15 10:56:20 fs.write: `.task/dialer-algorithm/repair-os-synthetic-dry-run-ci-contract/workpad.md`
- 2026-08-15 11:00:25 fs.write: `.task/dialer-algorithm/repair-os-synthetic-dry-run-ci-contract/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 11:00:14 `review.run`: passed — OK

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

behavior under test: every manifest entry included in the OS facade's generic synthetic dry-run contract must return a deterministic `DRY_RUN` envelope without executing its underlying command, while tools whose example input is invalid for the facade must be handled explicitly rather than causing broad package-test failure.
existing local pattern: inspect `executeTool` ordering, manifest `exampleInput`, and existing generic dry-run loop before choosing whether the contract belongs in the executor or in the test's eligibility filter.
new or changed tests: update the focused facade dry-run contract first; production executor changes only if evidence shows `dryRun` is incorrectly being applied after command execution/validation.
focused red command: run the generic `supports synthetic dry-run` facade cases that GitHub CI reports, especially one media tool and `subagent`.
expected red failure: media examples return `VALIDATION_ERROR` and `subagent` returns `COMMAND_FAILED` instead of `DRY_RUN`.
no-test waiver: not applicable.

## CI evidence

- On stream head `552017af1bfd2ad6de4687204ef0e8f3fe9cfbee`, OS contracts are green and the prior SVG/ffmpeg failures are gone.
- Shared `Consuelo / workspace contracts` and `Consuelo / verify` both fail only because `@consuelo/os` package tests fail in `tests/facade/facade.test.ts` synthetic dry-run cases.
- Dialer package job is independent and still running; no Dialer runtime/model regression has been identified.

- 2026-08-15 10:56:20 append: `.task/dialer-algorithm/repair-os-synthetic-dry-run-ci-contract/workpad.md`

## workspace-owned: files read

- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tools/media/handler.ts`
- `packages/os/tools/media/manifest.ts`
- `packages/os/tools/media/schema.ts`
- `packages/os/tools/package.ts`
- `packages/workspace/tests/facade/facade.test.ts`

- 2026-08-15 10:58:58 apply-patch: `packages/os/tests/facade/facade.test.ts`
- 2026-08-15 10:59:12 apply-patch: `packages/os/tests/facade/facade.test.ts`

## Final implementation and validation

Acceptance criteria:
- [x] Generic facade tests only expect runner-level success/failure/timeout behavior from entries whose input schema exists and accepts the manifest example input.
- [x] Synthetic dry-run coverage only includes runnable, non-internal mutating entries whose schema preserves `dryRun: true` and which do not use a native dry-run flag.
- [x] Unsupported package-contributed media schemas remain explicitly unsupported by this legacy facade; no production executor/schema behavior was changed or falsely advertised.
- [x] Internal `subagent` is no longer incorrectly treated as a generic synthetic dry-run command.
- [x] No Dialer runtime/model code changed.

Key decision:
- Do not add placeholder Zod schemas or move the executor dry-run branch ahead of validation. The executor contract is correct: validate input first, then suppress execution for supported synthetic dry-runs. The CI bug was the test matrix treating manifest presence as proof of facade executability.
- Preserve the existing success/failure snapshot matrix for unsupported entries so their `missing input schema` envelopes remain covered. Apply the stricter `runnableEntries()` filter only where the test must reach the underlying runner (timeouts and synthetic dry-runs).

Validation:
- RED: focused `supports synthetic dry-run` run reproduced 18 failures: 17 package-contributed media entries returned `VALIDATION_ERROR`; internal `subagent` returned `COMMAND_FAILED`.
- GREEN: `supports synthetic dry-run` = 48 passed, 632 skipped, exit 0.
- GREEN: `returns a timeout envelope` = 110 passed, 548 skipped, exit 0.
- Full facade file after the repair: 658/658 tests passed, exit 0. Vitest wrote eight unrelated missing snapshot entries (`dailySchedules.publish`, `fs.list`, `monitor.errors`, `security.scan` success/failure); those pre-existing snapshot drifts were restored and intentionally excluded from this task.
- Strict review against `origin/stream/dialer-algorithm`: 1 changed code/test file, 0 issues, 0 blockers.
- Broad `@consuelo/os` package validation remains GitHub CI, which is the exact failing release-gate surface.

- 2026-08-15 11:00:25 append: `.task/dialer-algorithm/repair-os-synthetic-dry-run-ci-contract/workpad.md`
