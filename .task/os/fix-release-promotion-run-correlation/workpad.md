# fix release promotion run correlation

branch: `task/os/fix-release-promotion-run-correlation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2188/fix-release-promotion-run-correlation
github pr: https://github.com/consuelohq/opensaas/pull/2188
started: 2026-08-26

## acceptance criteria

- [x] Promotion completion is keyed to the exact signed target channel pointer (bundle ID + source commit), not a synthetic GitHub Actions display title.
- [x] The existing protected promotion workflow may keep its generic `Consuelo OS runtime promote` title.
- [x] The release command keeps waiting while any post-dispatch promotion run is active and fails closed once all post-dispatch runs are terminal without the exact signed pointer.
- [x] Existing protected environments, signing boundaries, immutable-bundle verification, and secret handling are unchanged.
- [x] Focused regression tests pass; strict review and verify are clean before publish.

## plan

1. Reproduce the mismatch between the release script's synthetic run-name assumption and the existing workflow title.
2. Add a pure correlation contract around post-dispatch workflow runs plus signed target-channel state.
3. Make the signed target pointer authoritative and keep GitHub Actions as the protected mutation boundary.
4. Run focused tests, strict review, and verify; publish a clean main-target PR before using the release tool on itself.

## current status

- Hotfix implemented. Focused RED reproduced the missing correlation helper; GREEN now covers generic workflow titles, concurrent/pending runs, exact-pointer success, and fail-closed terminal mismatch.

## files changed

- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-script-promotion-correlation.test.ts`

## workspace-owned: activity log

- 2026-08-26 03:16:11 fs.write: `.task/os/fix-release-promotion-run-correlation/workpad.md`
- 2026-08-26 03:16:33 fs.write: `packages/os/tests/release-script-promotion-correlation.test.ts`
- 2026-08-26 03:16:50 fs.write: `packages/os/scripts/lib/release-promotion-correlation.ts`

## workspace-owned: validation evidence

- Focused RED: missing `release-promotion-correlation` module failed exactly as expected (`trc_d6c156628221`).
- Focused GREEN: 10 passed, 0 failed across promotion correlation, orchestration, and release security (`trc_40c46c3f5735`).
- Test-selection coverage repaired: no changed code files are uncovered; 7/7 selected critical suites passed (`trc_e2bf85e29425`).
- Final strict review: 0 blocking issues and 0 documentation opportunities (`trc_07ffbe0eb6ba`).
- Final full verify: `passed: true`, `publishValid: true`, DB guard clean (`trc_3ad2322c5514`).
- 2026-08-26 03:17:40 `review.run`: passed — OK
- 2026-08-26 03:18:24 `verify`: failed — COMMAND_FAILED
- 2026-08-26 03:19:50 `review.run`: passed — OK
- 2026-08-26 03:20:06 `verify`: passed — OK

## key decisions

- Signed release-channel state is the authoritative release result. GitHub Actions run metadata is supporting execution evidence, not the identity of the promoted artifact.
- Correlation considers only promotion runs created after the pre-dispatch baseline. If any are still active, wait; if all are terminal and the exact target pointer never appears, fail closed.
- No workflow-file change is required, so Ko's existing authenticated GitHub CLI session remains sufficient.

## notes for ko

- PR #2185 is already merged and published to `dev` as `0.1.72`. This hotfix closes the one release-tool bug found before its first real canary/self-update run.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: release promotion must correlate success to the exact requested channel pointer/bundle without depending on a workflow run-name that the existing protected promotion workflow does not define.
existing local pattern: the release adapter dispatches `consuelo-os-runtime-promote.yaml`, records a baseline run ID, then should use signed channel state as the authoritative completion signal while keeping GitHub Actions as the protected mutation boundary.
new or changed tests: add a regression proving promotion succeeds when the workflow keeps its existing generic display title, and fails closed if the exact signed target pointer never appears.
focused red command: `bun test packages/os/tests/release-script-promotion-correlation.test.ts`
expected red failure: current `scripts/release.ts` searches for a synthetic `Consuelo OS promote ...` display title, so it cannot find the actual `Consuelo OS runtime promote` run and times out.
no-test waiver: not applicable.

- 2026-08-26 03:16:11 append: `.task/os/fix-release-promotion-run-correlation/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/release-orchestrator.ts`
- `packages/os/scripts/release.ts`

- 2026-08-26 03:17:19 apply-patch: `.task/os/fix-release-promotion-run-correlation/workpad.md`

- 2026-08-26 03:19:19 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-08-26 03:20:11 apply-patch: `.task/os/fix-release-promotion-run-correlation/workpad.md`