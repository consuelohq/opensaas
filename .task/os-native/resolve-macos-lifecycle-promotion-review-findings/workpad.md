# resolve macos lifecycle promotion review findings

branch: `task/os-native/resolve-macos-lifecycle-promotion-review-findings`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1669/resolve-macos-lifecycle-promotion-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1669
started: 2026-07-27

## acceptance criteria

- [x] Restart-affecting native lifecycle mutations execute in a detached canonical worker that survives daemon restart/stop.
- [x] Operation state is persisted owner-only and remains visible after daemon restart.
- [x] Snapshot freshness is scoped by a daemon instance identifier so a restarted daemon's sequence is accepted immediately.
- [x] Non-destructive retry and destructive repair have distinct, truthful behavior; unsupported destructive repair fails closed rather than reusing ordinary repair.
- [x] TypeScript and Swift protocol contracts, real socket tests, lifecycle restart/rollback tests, package build, strict review, and full verify pass.
- [ ] The repair merges into `stream/os-native`, updates promotion PR #1668, and main promotion resumes only after all review findings are dispositioned and CI is green.

## plan

1. Inspect the canonical lifecycle restart/service adapter, endpoint operation dispatch, TypeScript/Swift freshness logic, and repair UI semantics.
2. Add failing behavioral contracts for detached operation execution, persisted state across endpoint instances, restart-aware snapshot ordering, and destructive-repair fail-closed behavior.
3. Implement a minimal detached canonical operation worker and protocol epoch without duplicating lifecycle logic.
4. Run focused and broad native/lifecycle/Swift/package validation, strict review, and full verify.
5. Publish and merge PR #1669 into `stream/os-native`; re-review updated promotion PR #1668 and promote only when terminal green.

## current status

- The three main-target review blockers are repaired and independently validated; publish verification is the remaining pre-PR gate.
- Restart-affecting mutations now launch a detached Bun worker that invokes the unchanged canonical lifecycle engine and survives daemon restart/stop.
- Owner-only operation metadata is written atomically, remains visible after endpoint restart, detects dead or abandoned workers, and prevents overlapping live operations.
- Updates are pinned to the user-approved version inside the canonical manifest transaction, failing before bundle download or activation if channel head changes.
- TypeScript and Swift clients use a backward-compatible daemon `instanceId`, accepting a fresh low sequence after restart while rejecting a late snapshot from the old daemon.
- Unsupported destructive repair is rejected by the endpoint, rejected by the Swift command mapper, and removed from the menu; ordinary retry remains canonical repair.
- The detached worker is part of the required runtime-bundle closure and synthetic release fixtures.
- Broad native/lifecycle/server/distribution contracts: 13 files, 155/155 tests passed.
- Swift contract executable, debug menu build, unsigned production archive, plist validation, strict ad-hoc signature, arm64 binary, executable mode, and archive inspection passed.
- TypeScript syntax/type checks, owned ESLint, diff checks, and strict repository review passed with zero findings and zero blockers.
- No real-Mac app launch, install, update, restart, reset, repair, rollback, or uninstall was performed.

## files changed

- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`
- `packages/os/tests/native-lifecycle-endpoint.test.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/native-lifecycle-operation.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 03:20:37 `review.run`: passed — OK
- 2026-07-27 03:22:34 `review.run`: passed — OK
- 2026-07-27 03:23:03 `verify`: passed — OK
- 2026-07-27 03:30:45 `review.run`: passed — OK
- 2026-07-27 03:31:11 `verify`: passed — OK
- 2026-07-27 03:31:49 `verify`: passed — OK

## test-first contract

- Behavior under test: update/rollback/repair/restart/uninstall requests are accepted by the socket, delegated to a detached worker using the canonical lifecycle engine, and persist queued/running/terminal state independently of the daemon process.
- Snapshot ordering: every daemon endpoint instance emits a stable `instanceId`; clients compare sequence only within the same instance and accept the first snapshot from a new instance.
- Repair distinction: ordinary retry remains canonical `repair`; destructive repair is rejected until a separate destructive lifecycle authority exists.
- Focused red command: `bun x vitest run tests/native-lifecycle-operation.test.ts tests/native-lifecycle-endpoint.test.ts tests/native-lifecycle-client.test.ts tests/macos-platform.test.ts tests/distribution/runtime-bundle.test.ts` plus `swift run ConsueloMacContractTests`.

## key decisions

- Do not move lifecycle business logic into the endpoint or Swift.
- Do not treat `devReset` as destructive repair; it is a separate development-only operation with different retention semantics.
- Persist only non-secret operation metadata under `~/.consuelo/run/` with owner-only permissions.

## notes for ko

- Promotion PR #1668 remains paused until this follow-up merges and its main-target CI/reviews rerun cleanly.
- The macOS package script is invoked through `bash`; the GitHub API publisher does not preserve executable mode on task branches.
- Signing, notarization, and the human real-Mac checkpoint remain release-lane gates.

## improvements noticed

- Native lifecycle protocols need a daemon-instance epoch whenever sequence numbers are process-local.
- Restart-affecting operations must never execute inside the supervised daemon they may stop.
- Runtime-bundle required-input tests should be updated in the same change that adds a new installed entrypoint.

## issues and recovery

- Main-target review found the three blockers after the first repair passed stream-target checks; promotion was correctly paused and the findings were isolated into this fresh task.
- A harness-sensitive detached-child Vitest probe was replaced with deterministic launcher/exit coverage after direct Bun invocation proved the worker entrypoint writes terminal state correctly.
- Whole-file Prettier introduced large legacy formatting churn; those files were restored and only targeted lifecycle/fixture hunks were reapplied.
- `test:distribution:integration` is not present on `stream/os-native`; that script remains on the unpromoted distribution stream. Native promotion uses the available runtime-bundle, release-publication, lifecycle, retention, server, Swift, and platform contracts.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-native): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleModels.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/errors.ts`
- `packages/os/scripts/lib/lifecycle/reload-service-adapter.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`
- `packages/os/tests/native-lifecycle-endpoint.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`

## final validation summary

- TDD red reproduced daemon self-termination risk, restart sequence rejection, destructive-repair aliasing, missing worker closure, and update target race.
- Focused TypeScript + Swift repair contracts passed.
- Broad regression: 13 files, 155/155 tests passed.
- TypeScript syntax/typecheck: passed.
- Owned ESLint and diff checks: passed.
- Swift contract/build/package/archive gate: passed.
- Strict diff-scoped review: zero findings, zero blockers.

- PR #1669 Codex review found two additional ordering gaps: the Swift transport cache still compared sequence across daemon instances, and a completed in-process operation could mask a later detached operation. RED contracts were added for both boundaries before implementation.

- Observed RED: the endpoint projected the prior local `update/succeeded` instead of detached `restart/running`; the Swift transport retained `daemon-old` sequence 100 over `daemon-new` sequence 1. The transport now compares instance/observedAt across daemon epochs, and detached launch invalidates prior local-operation generations while active persisted state receives defensive precedence.

- PR #1669 review follow-up GREEN: endpoint precedence contract passed 9/9; Swift transport/client contracts passed; broad regression increased to 155/155; syntax/type checks and strict review remained clean with zero findings.
