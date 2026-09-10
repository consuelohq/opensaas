# finalize synced OS script parity baseline

branch: `task/dialer-algorithm/finalize-synced-os-script-parity-baseline`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2072/finalize-synced-os-script-parity-baseline
github pr: https://github.com/consuelohq/opensaas/pull/2072
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

- 2026-08-15 11:36:05 fs.write: `.task/dialer-algorithm/finalize-synced-os-script-parity-baseline/workpad.md`
- 2026-08-15 11:40:18 fs.write: `.task/dialer-algorithm/finalize-synced-os-script-parity-baseline/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 11:39:23 `review.run`: passed — OK
- 2026-08-15 11:39:24 `review.run`: passed — OK

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

behavior under test: the committed OS script-parity classification baseline must exactly match the final combined `stream/dialer-algorithm` script inventory after current-main lineage and CI compatibility fixes are present.
existing local pattern: preserve valid reviewed classifications and reasons; remove only nonexistent paths, add only missing current paths with conservative review statuses, and reclassify only entries whose workspace/OS relationship changed.
new or changed tests: no new behavior tests; `tests/audit/script-parity-audit.test.ts` is the executable contract.
focused red command: `bun x vitest run tests/audit/script-parity-audit.test.ts` from `packages/os`.
expected red failure: inventory mismatch identifying the remaining current-main path(s), previously `scripts/lib/workspace-chrome.ts` in GitHub merged-context CI.
no-test waiver: not applicable.

## Acceptance criteria

- Parity fixture keys exactly equal the combined workspace+OS script inventory on the current Dialer stream.
- All status/category compatibility and reason-quality assertions pass.
- No production source changes.
- After promotion, PR #2014 must reach zero failed and zero pending required checks before merge.

- 2026-08-15 11:36:05 append: `.task/dialer-algorithm/finalize-synced-os-script-parity-baseline/workpad.md`

## Final validation before publish

- RED: `tests/audit/script-parity-audit.test.ts` failed because the baseline had 495 keys while the combined stream inventory had 496; the sole missing path was `scripts/lib/workspace-chrome.ts`.
- Inventory evidence: `scripts/lib/workspace-chrome.ts` exists only in `packages/os` (not `packages/workspace`), so it is conservatively classified `os-only-needs-review` rather than being assumed intentional/equivalent.
- GREEN: `bun x vitest run tests/audit/script-parity-audit.test.ts` = 1/1 passed, exit 0.
- Product/audit diff: only `packages/os/tests/audit/fixtures/script-parity-classifications.json` changes (+4 lines) outside normal task metadata; no production source changes.
- Review recovery: first strict review call hit a transient network error; retry returned 0 issues / 0 blockers but reused a cached review and reported `files: 0`. Because `git.diff` independently proves the one-file fixture change, the focused parity test plus diff are the primary validation evidence for this data-only task.
- Pre-existing review output contains legacy Twenty lint/typecheck findings unrelated to this fixture update; none are owned by this change.

- 2026-08-15 11:40:18 append: `.task/dialer-algorithm/finalize-synced-os-script-parity-baseline/workpad.md`
