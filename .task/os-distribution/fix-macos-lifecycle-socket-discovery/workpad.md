# fix macOS lifecycle socket discovery

branch: `task/os-distribution/fix-macos-lifecycle-socket-discovery`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1672/fix-macos-lifecycle-socket-discovery
github pr: https://github.com/consuelohq/opensaas/pull/1672
started: 2026-07-27

## acceptance criteria

- [x] Confirm the macOS app and daemon use the same owner-local lifecycle socket.
- [x] Confirm the first ENOENT was stale daemon version skew, not a path mismatch.
- [ ] A source-managed development daemon with config/node identity and no signed `runtime/current` release reports installed, running, and healthy.
- [ ] Source-managed snapshots identify the runtime as `source`, expose zero release updates, and explain that release management is unavailable.
- [ ] Source-managed snapshots suppress stale failed install/update/repair/rollback/uninstall operations.
- [ ] Source-managed endpoints reject release-only update, rollback, repair, and uninstall requests while preserving restart, diagnostics, preferences, and workspace actions.
- [ ] The macOS menu hides unsupported release-only actions and its command mapper rejects them if invoked programmatically.
- [ ] Release-managed and legacy snapshot behavior remains backward compatible.
- [ ] Focused TypeScript and Swift contract tests, strict review, and full verify pass before merge to `stream/os-distribution`.

## plan

1. Add failing TypeScript endpoint tests for source-runtime classification, operation suppression, action availability, backend rejection, and runtime-mode detection.
2. Add failing Swift contract tests for backward-compatible action defaults and source-runtime action gating/presentation.
3. Implement optional action availability in the shared snapshot contract and deterministic source-vs-release runtime detection.
4. Update the macOS menu and command mapper to consume the action contract.
5. Run focused tests, review, verify, publish PR #1672, request CodeRabbit, and merge only after gates are clean.

## test-first contract

- Behavior under test: a live repo/source daemon must not be misclassified as a broken signed-release installation merely because `~/.consuelo/runtime/current` is absent.
- Existing pattern: optional schema-v1 snapshot fields decode with safe defaults; the endpoint controller owns status projection and server-side mutation authorization; Swift `LifecycleCommandMapper` provides defense-in-depth action validation.
- New/changed tests:
  - `packages/os/tests/native-lifecycle-endpoint.test.ts`: source-managed status and action policy; stale release-operation suppression; source/release detection.
  - `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`: source mode remains healthy, release-only actions are unavailable, and old snapshots default to existing action availability.
- Focused RED commands:
  - `bun test packages/os/tests/native-lifecycle-endpoint.test.ts`
  - `swift run --package-path packages/os/native/macos ConsueloMacContractTests`
- Expected RED: missing management/action snapshot types and controller options; Swift models/mapper do not understand action availability.

## current status

- Product defect confirmed from Ko's first live alpha run.
- Source-runtime projection and action gating are implemented.
- Codex P2 review found that source mode could still display an unrelated activated release version; fixed test-first so source snapshots always use `sourceVersion`.
- Focused TypeScript and Swift contracts, strict review, and full verify are green.
- All three Codex P2 findings and both CodeRabbit findings are fixed.
- Ready to publish the final boundary correction, disposition both new Codex findings, and complete CI.
- Socket integration works after the human daemon restart checkpoint.
- Ko's daemon is source-managed from `/Users/kokayi/Dev/opensaas`, while lifecycle inspection assumes configured nodes are signed-release installations.
- `inspectLifecycleInstallState` reports `partial` because `runtime/current` is absent; endpoint projection maps `partial` to failed and exposes repair.
- Repair then attempts release-manifest fetch and fails because a source-managed daemon intentionally has no `CONSUELO_RELEASE_BASE_URL`.
- Do not uninstall or reinstall Ko's OS; that would mix installation models and conceal the regression.

## files changed

- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/tests/macos-platform.test.ts`


## workspace-owned: files changed

- task workpad only so far

## workspace-owned: activity log

- Read macOS transport, shared models, presentation/command mapper, menu app, lifecycle state/engine, endpoint controller, daemon launcher, and endpoint tests.
- Ran read-only local diagnostics for socket, launchd process, source timestamps, lifecycle home layout, and persisted operation output.

## workspace-owned: validation evidence

- Client and daemon both resolve `~/.consuelo/run/lifecycle.sock`.
- Socket exists and the menu receives status after Ko restarted the stale daemon.
- Live daemon entrypoint is outside `~/.consuelo/runtime`; no `runtime/current` exists.
- Screenshot and lifecycle diagnostics reproduce failed repair manifest fetch with missing `CONSUELO_RELEASE_BASE_URL`.
- RED: endpoint tests failed on missing management resolver/action contract; Swift failed on missing `LifecycleActionAvailability`.
- GREEN: 72 TypeScript tests passed across native lifecycle, local server, macOS, and runtime bundle suites.
- GREEN: `ConsueloMacContractTests` built and passed.
- GREEN: package syntax/typecheck passed.
- GREEN: strict review reported 0 owned, pre-existing, or blocking issues.
- GREEN: full verify passed with `publishValid: true` across 8 changed product/test files.
- RED correction: source status carrying stale release version `1.2.3` rendered that release instead of `source`.
- GREEN correction: source snapshots now always prefer `sourceVersion`; 72 focused tests, typecheck, strict review, and full verify passed again.
- CodeRabbit actionable RED: no concrete update target still rendered an Update button; Swift contract failed before `MenuBarActionPresentation` existed.
- CodeRabbit nitpick accepted: removed fragile source-string action assertions and moved action visibility into behavioral Swift contracts.
- GREEN: `MenuBarActionPresentation` requires a concrete update target and centralizes repair/rollback/restart/uninstall visibility.
- GREEN: `ConsueloMacContractTests`, `ConsueloMenuBarApp` build, 72 focused TypeScript tests, package typecheck, strict review, and full verify all pass.
- Codex P2 RED: staging/test-home/dev-slot entrypoints were misclassified as release-managed; source status with a corrupt unrelated release rendered failed.
- Codex P2 GREEN: release mode is limited to `runtime/current` and `runtime/releases`; source runtime health ignores partial/corrupt installed-release state.
- GREEN: 73 focused TypeScript tests, package typecheck, strict review, and full verify pass after the boundary corrections.
- 2026-07-27 18:07:36 `review.run`: failed — COMMAND_FAILED
- 2026-07-27 18:08:06 `review.run`: passed — OK
- 2026-07-27 18:08:30 `verify`: passed — OK
- 2026-07-27 18:15:02 `review.run`: passed — OK
- 2026-07-27 18:15:10 `verify`: passed — OK
- 2026-07-27 18:21:10 `review.run`: passed — OK
- 2026-07-27 18:21:20 `verify`: passed — OK
- 2026-07-27 18:24:44 `review.run`: passed — OK
- 2026-07-27 18:24:54 `verify`: passed — OK

## key decisions

- Model source-managed runtime explicitly rather than weakening signed-release integrity checks.
- Keep the signed-release lifecycle state machine unchanged; adapt only the native endpoint's projection and action policy for source runtime.
- Add server-side rejection in addition to hiding menu actions.
- Preserve schema version 1 by adding optional fields with backward-compatible defaults.
- Do not mutate Ko's installation while implementing or validating the repository fix.

## notes for ko

- No uninstall/reinstall is needed or recommended for this defect.
- The current menu app correctly exposed a real integration gap before the final epic review.
- A fresh artifact will be needed after this PR merges; first-run validation remains a human checkpoint.

## improvements noticed

- Future release UX could label source builds with a commit SHA, but `source` is sufficient for this fix.

## issues and recovery

- Some `batch` inner filesystem calls fail to inherit task selection in a workspace with many active worktrees. Recovered using direct task-scoped calls and task-scoped `code.run`.

---

## publish checklist

- [x] RED evidence recorded
- [x] GREEN focused TypeScript and Swift evidence recorded
- [x] strict review clean
- [x] full verify clean
- [x] corrective source-version test and implementation pushed to PR #1672
- [ ] CodeRabbit findings fixed locally; publish and post final dispositions
- [ ] task merged into `stream/os-distribution`

## workspace-owned: files read

- `packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift`
- `packages/os/package.json`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/workspace/scripts/task-push.js`
