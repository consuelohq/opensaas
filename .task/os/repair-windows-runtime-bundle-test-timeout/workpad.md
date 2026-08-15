# repair windows runtime bundle test timeout

branch: `task/os/repair-windows-runtime-bundle-test-timeout`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1922/repair-windows-runtime-bundle-test-timeout
github pr: https://github.com/consuelohq/opensaas/pull/1922
started: 2026-08-13

## acceptance criteria

- [x] Native Windows runtime-bundle cleanup is not constrained by Vitest's 10-second default hook timeout.
- [x] Heavy runtime-bundle test retains its existing assertions, fixture contents, and 120-second test-body budget.
- [x] Exact runtime-bundle suite passes locally.
- [x] Task verification selects the focused runtime-bundle contract and excludes the unrelated broad OS package suite.
- [x] No production runtime, bundle contents, workflow matrix, cloud state, or release state changes.

## plan

1. Inspect the failing Windows job and identify whether line 138 is setup or cleanup.
2. Map fixture roots and existing heavy-test timeout semantics.
3. Use native-Windows CI failure as platform-specific RED evidence and safety-preflight the focused test.
4. Apply an explicit bounded cleanup-hook timeout matching the existing heavy-test budget.
5. Run exact runtime-bundle coverage, add focused selector ownership with RED/GREEN, run selected suites, strict review, full verify, then promote through #1901 and recheck Windows CI.

## current status

- Implementation complete: the file-level fixture cleanup hook now has a 120-second timeout, matching the heavy runtime-bundle test's existing body timeout.
- Exact runtime-bundle suite passes 20/20. Selector regression passes 27/27. Actual task selection passes all 5 selected suites with the broad OS package suite excluded.
- Ready for strict review and full publish-valid verification; native Windows #1901 rerun remains the final platform proof.

## files changed

- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-08-13 22:12:14 fs.write: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`
- 2026-08-13 22:13:48 fs.write: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`
- 2026-08-13 22:18:09 fs.write: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`

## workspace-owned: validation evidence

- Native Windows RED: heavy runtime-bundle test body completed, then `afterEach` timed out at 10s while deleting generated fixture roots (trace `trc_7c0f1c7bb6e9`).
- Exact runtime-bundle GREEN: 20/20 (trace `trc_e0dc3c9a0d7c`).
- Selector RED: 26/27; only missing focused runtime-bundle rule failed (trace `trc_e8b90f03e560`).
- Selector GREEN: 27/27 (trace `trc_cd6ce39f060b`).
- Remaining selected-test safety preflight: zero destructive-literal matches (trace `trc_234f7a20111b`).
- Actual selected execution: 5/5 suites passed, broad OS package suite absent (trace `trc_7f1c6a0f14f5`).
- 2026-08-13 22:17:15 `review.run`: passed — OK
- 2026-08-13 22:17:46 `verify`: passed — OK

## key decisions

- Treat this as a test cleanup-budget defect, not a production/runtime failure: Windows product/platform acceptance had already passed before the distribution suite failed.
- Match the cleanup hook's explicit 120-second timeout to the heavy test's existing 120-second body timeout instead of globally increasing Vitest hook timeouts.
- Give the exact runtime-bundle test critical/exclusive selector ownership so verifier runs the relevant contract instead of unrelated historical package failures.

## notes for ko

- none yet

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

## discovery — native Windows runtime-bundle timeout

- Scope: repair only the selected native Windows distribution test harness. #1901 native Windows reaches product/platform acceptance successfully, then fails in `tests/distribution/runtime-bundle.test.ts` setup because Vitest's default hook timeout is 10s.
- External RED evidence: #1901 run `31748565851`, native Windows job `94608811131`, annotation `Hook timed out in 10000ms` at `tests/distribution/runtime-bundle.test.ts:138:1`. Earlier Windows platform contracts, service-host build, and native acceptance all passed.
- Safety: no production runtime behavior, bundle contents, workflow platform matrix, cloud state, or release state should change. Test targets must be preflighted before execution.
- Discovery questions: what setup work runs in the hook, whether the repository has an established timeout constant/pattern for heavy distribution hooks, and whether the Windows selected command can be tested without changing production semantics.

## Test-first contract

- External platform RED is authoritative for this Windows-only timing defect: native Windows run `31748565851` executes 19/20 runtime-bundle tests successfully; the heavy `builds the real customer closure twice with clean-host inventory parity` body runs ~53.9s, then its file-level `afterEach` at line 138 times out after Vitest's default 10s while recursively deleting fixture roots (trace `trc_7c0f1c7bb6e9`).
- The heavy test already has an explicit 120-second body timeout, and it adds both the source fixture root and an extracted runtime root (including installed production dependencies) to `fixtureRoots`; Windows cleanup is materially heavier than POSIX cleanup.
- No equivalent local RED is expected on macOS because the failure is filesystem/platform timing. Waiver: use the captured native-Windows CI failure as RED evidence, then validate the exact runtime-bundle suite locally plus the next native-Windows #1901 rerun.
- Implementation contract: give only the fixture cleanup hook an explicit 120-second bounded timeout, matching the existing heavy-test budget. Do not change runtime-bundle code, fixture contents, workflow selection, or assertions.
- Safety preflight for the exact runtime-bundle test found zero destructive shell-command literal matches (trace `trc_75ea3d46c133`). The test deletes only its own generated temporary fixture roots through Node `rmSync`.

- 2026-08-13 22:12:14 append: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`

## workspace-owned: files read

- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Focused GREEN

- Exact runtime-bundle suite: `bun --cwd packages/os test tests/distribution/runtime-bundle.test.ts` passed 20/20; heavy clean-host closure test passed (trace `trc_e0dc3c9a0d7c`).
- Local macOS cleanup completes quickly, as expected. The native-Windows #1901 rerun remains the platform-specific acceptance proof for the explicit hook budget.

## Focused publish selection — test-first contract

- Current task selection falls through to `auto:@consuelo/os:package-test`, which is unrelated to this one-file distribution harness repair (trace `trc_6cf1eef66da5`).
- Behavior under test: changing `packages/os/tests/distribution/runtime-bundle.test.ts` must select only the exact runtime-bundle distribution contract and suppress `@consuelo/os package test`.
- Existing local pattern: the recent OS lockfile and install-state repairs use critical/exclusive focused rules with selector regressions asserting the exact command.
- Safety preflight for `packages/workspace/tests/test-selection.test.js` found zero destructive command-literal matches (trace `trc_483c938a95ce`).
- RED first: add a selector regression requiring `os-runtime-bundle-distribution-contract` and suite `OS runtime-bundle distribution contract`; expect failure before the rule exists.
- Selector RED reproduced exactly: 26/27 passed; only the new runtime-bundle ownership case failed because the selector still returned `auto:@consuelo/os:package-test` (trace `trc_e8b90f03e560`).
- Implementation: add critical/exclusive `os-runtime-bundle-distribution-contract` for the exact distribution test and run only `bun --cwd packages/os test tests/distribution/runtime-bundle.test.ts`, then regenerate the canonical selector registry.

- 2026-08-13 22:13:48 append: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`

- 2026-08-13 22:14:16 apply-patch: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`
- 2026-08-13 22:14:16 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-13 22:14:44 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-13 22:14:44 apply-patch: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`

- 2026-08-13 22:15:53 apply-patch: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`

## Final verification

- Strict review against `origin/stream/os`: 0 blocking findings / 0 pre-existing findings (trace `trc_3012ed221654`).
- Full `verify --base origin/stream/os`: passed with `publishValid: true`; focused selected tests passed and DB guard reported 0 risks/findings (trace `trc_08584aa055c9`).
- Final change surface: one bounded test cleanup-hook timeout plus focused test-selection rule/registry/regression. No production runtime, bundle contents, workflow matrix, cloud state, or release state changed.
- Ready for normal guarded task push and promotion through existing stream review PR #1901; native Windows rerun is the final platform-specific acceptance proof.

- 2026-08-13 22:18:09 append: `.task/os/repair-windows-runtime-bundle-test-timeout/workpad.md`
