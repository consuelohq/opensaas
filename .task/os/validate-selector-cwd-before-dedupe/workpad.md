# Validate selector cwd before dedupe

branch: `task/os/validate-selector-cwd-before-dedupe`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2295
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: suite de-duplication must preserve the distinction between an absent `cwd` and any explicitly present invalid `cwd` value, so invalid suites always reach fail-closed cwd validation instead of being silently collapsed with a valid repo-root suite; valid identical commands in different cwd values remain distinct.
existing local pattern: `commandKey(test)` currently serializes `[test.cwd || '.', test.command]`, so absent cwd, blank string, and `false` can share the same `.` key before `resolveSuiteCwd()` validates the selected suite.
new or changed tests: add collision regressions with identical commands where one suite omits cwd and the other uses invalid false/blank cwd, in both rule ordering directions; assert the invalid suite remains selected and `--run` fails with `INVALID_SUITE_CWD`. Preserve existing distinct-valid-cwd coverage.
focused red command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "cwd de-duplication"`.
expected red failure: one ordering silently deduplicates away the invalid suite because its key collides with the valid repo-root suite.
no-test waiver: not applicable.

red evidence: with the valid repo-root suite first, the invalid `cwd:false` suite was deduplicated away and the selector exited 0.

green evidence:
- de-duplication now distinguishes absent cwd from explicitly present cwd values before runtime validation.
- collision regression passes in both valid-first and invalid-first orderings; invalid present cwd survives selection and fails with `INVALID_SUITE_CWD`.
- full `packages/workspace/tests/test-selection.test.js`: 72/72 passed.

review context: Codex P2 on stream PR #2277 head `30c2f75` identified that `[test.cwd || '.', test.command]` could suppress fail-closed cwd validation during suite de-duplication. The key now encodes cwd field presence and raw value; `resolveSuiteCwd()` remains the authority for validity.

- 2026-08-29 07:01:57 append: `.task/os/validate-selector-cwd-before-dedupe/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 07:01:57 fs.write: `.task/os/validate-selector-cwd-before-dedupe/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/test-selection.js`

- 2026-08-29 07:02:43 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 07:02:59 apply-patch: `packages/workspace/scripts/test-selection.js`
- 2026-08-29 07:03:11 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-29 07:03:43 apply-patch: `.task/os/validate-selector-cwd-before-dedupe/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 07:04:02 `review.run`: passed — OK
- 2026-08-29 07:04:15 `verify`: passed — OK
