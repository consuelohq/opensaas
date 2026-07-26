# align distribution rehearsal with mandatory lanes

branch: `task/os-distribution/align-distribution-rehearsal-with-mandatory-lanes`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1665/align-distribution-rehearsal-with-mandatory-lanes
github pr: https://github.com/consuelohq/opensaas/pull/1665
started: 2026-07-26

## acceptance criteria

- [ ] Platform evidence points to real workflow job IDs and matrix coordinates.
- [ ] The complete distribution rehearsal runs on the mandatory macOS and Windows lanes.
- [ ] The rehearsal includes clean-host installer, persisted Bun-path, and bootstrap-source contracts.
- [ ] The child Vitest process has a bounded CI timeout and preserves non-zero failure behavior.
- [ ] Workflow triggers cover the OS sources and tests exercised by the rehearsal.
- [ ] Focused contract, full rehearsal, strict review, and publish verification pass.

## plan

1. Expand the contract test first to require real job coordinates, full suite closure, workflow execution, trigger closure, and process timeout.
2. Run the focused test red against the merged Worker 24 implementation.
3. Update the runner and distribution workflow with the smallest coherent repair.
4. Run the focused contract and complete distribution rehearsal, then strict review and full verify.
5. Publish, merge into stream/os-distribution, and synchronize local refs.

## current status

- Implementation complete. Focused contracts and the complete 212-test distribution rehearsal are green; review and publish verification are pending.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/scripts/testing/distribution/integration-runner.ts`
- `packages/os/tests/daemon-bun-path.test.ts`
- `packages/os/tests/distribution/distribution-integration.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-26 21:00:57 `review.run`: passed — OK
- 2026-07-26 21:01:15 `verify`: passed — OK
- 2026-07-26 21:05:40 `review.run`: passed — OK
- 2026-07-26 21:05:49 `verify`: passed — OK

## test-first contract

- Behavior under test: the final rehearsal is a real bounded command executed by the registered macOS/Windows matrix lanes and includes clean-host Bun/bootstrap coverage.
- Existing pattern: `distribution-integration.test.ts` owns the executable rehearsal contract; the distribution workflow owns native evidence.
- Changed test: require real `native-runtime` matrix coordinates, three missing clean-host suites, a 15-minute process timeout, the workflow command, and broad OS trigger closure.
- Focused red command: `bun x vitest run tests/distribution/distribution-integration.test.ts` from `packages/os`.
- Expected red failure: missing timeout export/suites, stale `platform-contracts` coordinates, and absent workflow execution/trigger wiring.
- Observed red: all three contract cases failed for exactly those reasons; no unrelated failures were present.
- Full rehearsal red: 210/212 tests passed; both daemon Bun-path tests failed because the Vitest runtime does not define the Bun global. The test must use Node child-process APIs to remain executable across the mandatory matrix.

## key decisions

- Run the same complete rehearsal on every native matrix lane. This is stronger and simpler than maintaining a second partial platform command.
- Use broad `packages/os/scripts/**`, `packages/os/tests/**`, and `packages/os/cloudflare/**` triggers because the curated rehearsal spans all three surfaces.

## notes for ko

- Worker 24 itself was already merged as PR #1663. This repair makes its declared platform evidence executable and machine-checkable.
- The full rehearsal now runs on Linux, macOS, and Windows native matrix lanes. The launchd-specific Bun-path test skips only on Windows, where `/bin/bash` and launchd do not exist.
- The expected corrupt-provenance negative test emits a stack trace to stderr while passing; it is not an outcome-changing warning.

## improvements noticed

- none yet

## issues and recovery

- Initial focused red matched all planned gaps.
- First full rehearsal passed 210/212 tests; `daemon-bun-path.test.ts` depended on the Bun global under Vitest. Replaced it with `node:child_process.spawnSync` and made the launchd-specific suite explicitly skip on Windows. The rerun passed 212/212.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/scripts/testing/distribution/integration-runner.ts`
- `packages/os/tests/daemon-bun-path.test.ts`
- `packages/os/tests/distribution/distribution-integration.test.ts`
- `packages/os/tests/windows-platform.test.ts`

## validation summary

- Red: 3/3 focused contract cases failed on suite closure, job coordinates, and workflow wiring.
- Green: focused distribution contract 3/3.
- Portability regression: daemon Bun-path + integration contracts 5/5.
- Complete rehearsal: 17 files, 212/212 tests passed in 17.21 seconds.

## wait cycle 1

- Start: 2026-07-26T21:02:00Z
- Wait reason: GitHub required checks for PR #1665, including native Linux/macOS/Windows rehearsal lanes, are still running.
- Duration: 60 seconds.
- Resume action: query PR #1665 checks and merge state immediately.
- Expected signal: all distribution environment lanes and required repository checks are terminal green/skipped.
- Fallback: inspect exact failed platform logs and repair on this task branch; classify unassigned-runner queues separately.

## CI platform failure and recovery

- PR #1665 native Linux failed because the full macOS-oriented lifecycle suite builds Darwin fixtures and invokes macOS tools such as `plutil`; it is not a portable all-platform suite.
- PR #1665 native Windows failed before rehearsal because `windows-platform.test.ts` still asserted the removed partial workflow step.
- Recovery decision: macOS remains the authoritative complete lifecycle rehearsal. Linux and Windows run the portable distribution harness plus their existing dedicated platform contracts/acceptance. All three remain mandatory evidence lanes.

- Recovery red: updated source contracts failed because guarded macOS/full and non-macOS/portable steps were not yet present.
- Implementation: macOS executes the complete 212-test lifecycle rehearsal; Linux and Windows execute the portable distribution contracts after any Windows build cleanup. Dedicated Linux and Windows platform acceptance remains unchanged.

## platform recovery validation

- Focused cross-platform source contracts: 27/27 passed.
- Portable Linux/Windows distribution command: 12 files, 80/80 tests passed.
- Complete macOS lifecycle rehearsal: 17 files, 212/212 tests passed.
- The corrupt-provenance negative test still emits its expected stack trace while the suite exits zero.
