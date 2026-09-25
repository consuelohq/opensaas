# fix macos lifecycle environment fallback before stable

branch: `task/os/fix-macos-lifecycle-environment-fallback-before-stable`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2576
started: 2026-09-24

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

behavior under test: macOS lifecycle restart must discover installed restartable/legacy sidecar LaunchAgents using the process environment when `createReloadServiceController` is called without an explicit `environment` object.
existing local pattern: lifecycle restart contract tests inject a fake process runner and HOME/launchd fixtures, then assert launchctl discovery/bootstrap/kickstart behavior.
new or changed tests: add a regression in `packages/os/tests/lifecycle-restart-contract.test.ts` that omits `input.environment`, supplies HOME through `process.env` for the test scope, and proves an installed heartbeat plist is discovered/restarted.
focused red command: `cd packages/os && bun test tests/lifecycle-restart-contract.test.ts`
expected red failure: current helper receives `undefined`, resolves no HOME, returns no sidecars, and therefore emits no launchctl calls for the installed heartbeat plist.
no-test waiver: none.

- 2026-09-24 00:29:37 append: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-24 00:29:37 fs.write: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`
- 2026-09-24 00:32:50 fs.write: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`
- 2026-09-24 00:37:36 fs.write: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`
- 2026-09-24 00:38:07 fs.write: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## Validation evidence

- Red: focused lifecycle restart suite failed exactly because an omitted controller environment discovered no legacy heartbeat LaunchAgent.
- While implementing the fallback, an existing test revealed host-environment leakage for ordinary restartable sidecars; the fix was narrowed to the legacy-heartbeat helper only, matching the original review finding.
- Added fail-closed inspection for legacy heartbeat retirement so an unknown `launchctl print` error preserves the plist instead of deleting the definition without confirmed unload.
- Updated one pre-existing controller unit test with explicit `HOME: ''` to keep it hermetic now that legacy-heartbeat discovery intentionally falls back to `process.env`.
- Green: `cd packages/os && bun test tests/lifecycle-restart-contract.test.ts` => 27 passed, 0 failed, 109 assertions.

- 2026-09-24 00:32:50 append: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`

## Broad-suite triage

- The task worktree initially had an almost-empty `packages/os/node_modules`; main has the real package dependencies. A local-only symlink to `/Users/kokayi/Dev/opensaas/packages/os/node_modules` restored `tree-sitter` and `@tanstack/virtual-core`. This is ignored worktree setup, not source.
- After dependency repair, the previously failing provider/trace/ExploreBench cases passed. 30/31 of the targeted broad failures were green.
- The sole remaining failure is `explore-index-hydration-fallback.test.ts` / `should avoid a second query-time wait when semantic hydration hangs`, which deterministically reaches its 20s timeout even when run alone.
- Neither that Explore test nor its index implementation differs from `origin/stream/os`; this is a pre-existing stream/environment failure outside the lifecycle patch. No unrelated Explore code will be changed in this task.
- Lifecycle patch validation remains green: 27/27, 109 assertions.

- 2026-09-24 00:37:36 append: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`

## workspace-owned: validation evidence

- Red: focused lifecycle restart suite failed exactly because an omitted controller environment discovered no legacy heartbeat LaunchAgent.
- While implementing the fallback, an existing test revealed host-environment leakage for ordinary restartable sidecars; the fix was narrowed to the legacy-heartbeat helper only, matching the original review finding.
- Added fail-closed inspection for legacy heartbeat retirement so an unknown `launchctl print` error preserves the plist instead of deleting the definition without confirmed unload.
- Updated one pre-existing controller unit test with explicit `HOME: ''` to keep it hermetic now that legacy-heartbeat discovery intentionally falls back to `process.env`.
- Green: `cd packages/os && bun test tests/lifecycle-restart-contract.test.ts` => 27 passed, 0 failed, 109 assertions.
- 2026-09-24 00:32:50 append: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`
- 2026-09-24 00:37:56 `review.run`: passed — OK

## Review / publish evidence

- Strict review against `origin/stream/os`: 0 blocking issues, 0 pre-existing issues, 0 failed suites. One non-blocking documentation opportunity only; this change repairs internal restart/retirement safety rather than changing the public install contract.
- Focused lifecycle suite: 27/27 passed, 109 assertions.
- Broad dependency failures were repaired locally by restoring the ignored package dependency symlink. Provider cutover, trace request budget, and ExploreBench then passed.
- The sole remaining broad-suite failure is an unchanged pre-existing Explore hydration timeout; `git diff origin/stream/os -- packages/os/scripts/lib/index packages/os/tests/explore-index-hydration-fallback.test.ts` is empty.
- Ko explicitly approved finishing and shipping the Stable release. Use the approved publish escape hatch only for this unrelated pre-existing broad-suite failure; do not waive any lifecycle regression.

- 2026-09-24 00:38:07 append: `.task/os/fix-macos-lifecycle-environment-fallback-before-stable/workpad.md`
