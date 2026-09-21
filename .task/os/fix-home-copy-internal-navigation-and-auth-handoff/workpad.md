# fix Home copy internal navigation and auth handoff

branch: `task/os/fix-home-copy-internal-navigation-and-auth-handoff`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2353
started: 2026-09-01

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

behavior under test: Home keeps the heatmap but removes the hero description and heatmap headline/explanatory sentence; locally configured Internal navigation is present in every workspace chrome surface; clicking a private internal shortcut while already on internal.consuelohq.com goes directly to its target path instead of self-handoff, while cross-workspace clicks still use the secure handoff.
existing local pattern: Home/settings and Tracing receive WorkspaceChromeOptions from Sites materialization, but Artifacts and dynamic Diffs render chrome without those options. Private absolute internal links are always rewritten server-side to /auth/handoff/start, even when the rendered page is already on internal.consuelohq.com.
new or changed tests: extend Home regression assertions for removed copy; extend launcher/local chrome coverage across Artifacts and Diffs; add workspace chrome client contract for same-host private shortcuts and preserve cross-host handoff behavior.
focused red command: bun --cwd packages/os test tests/internal-launcher-regressions.test.ts tests/workspace-chrome.test.ts tests/launcher-local-customization.test.ts
expected red failure: current Home still emits all requested copy; Artifacts/Diffs omit the Internal custom section; same-host internal shortcut remains /auth/handoff/start and can land on Not found.
no-test waiver: not applicable.

- 2026-09-01 00:47:17 append: `.task/os/fix-home-copy-internal-navigation-and-auth-handoff/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 00:47:17 fs.write: `.task/os/fix-home-copy-internal-navigation-and-auth-handoff/workpad.md`
- 2026-09-01 00:58:35 fs.write: `.task/os/fix-home-copy-internal-navigation-and-auth-handoff/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/tests/internal-user-dashboard.test.ts`
- `packages/os/tests/workspace-chrome.test.ts`

## workspace-owned: validation evidence

- 2026-09-01 00:51:59 `review.run`: passed — OK
- 2026-09-01 00:53:49 `verify`: failed — COMMAND_FAILED
- 2026-09-01 00:55:29 `review.run`: passed — OK
- 2026-09-01 00:57:21 `verify`: failed — COMMAND_FAILED

## Validation evidence

- RED: focused Home/chrome/Artifacts/Diffs suite failed exactly on the requested copy, missing custom navigation on Artifacts/Diffs, and missing same-host private-route metadata.
- GREEN: `internal-launcher-regressions`, `workspace-chrome`, `launcher-local-customization`, `diffs-hono-routes`, `internal-user-dashboard`, and script parity audit pass: 6 files / 27 tests (trace `trc_d518793fa617`).
- Strict review against `origin/main`: 0 issues / 0 blockers; typecheck and static review clean (trace `trc_7036c6d459f6`).
- Formal verify still selects the entire `packages/os` suite and fails on broad pre-existing/non-task tests. The one task-caused audit inventory failure was fixed by classifying the new OS-only helper; after that the broad suite reports 12 failed files / 17 failed tests, while all task-local suites pass. Sample unrelated failures are installer runtime dependency fixtures, lifecycle help matcher support, skill migration parity, and subagent executable discovery.

## Root cause and implementation

- Home copy was embedded in both static markup and the heatmap refresh script; removed both while keeping Last seven days, totals, accessible grid labels, tooltip behavior, and the 7x24 scaffold.
- Local `launcher.extraSections` was only threaded through Home/settings and Tracing. Artifacts and dynamic Diffs bypassed it. Moved the loader to a shared helper and now thread it through all shared local chrome surfaces; the internal dashboard also exposes its Internal shortcut in chrome.
- Absolute `internal.consuelohq.com` shortcuts always used `/auth/handoff/start`, even when already on that host. Chrome now keeps secure handoff as the cross-host default but embeds validated target metadata and navigates directly to the root-relative target when the browser is already on the private host.

- 2026-09-01 00:58:35 append: `.task/os/fix-home-copy-internal-navigation-and-auth-handoff/workpad.md`
