# Land workspace overview shell on current stream

branch: `task/os/land-workspace-overview-shell-on-current-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2039/land-workspace-overview-shell-on-current-stream
github pr: https://github.com/consuelohq/opensaas/pull/2039
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

- 2026-08-15 07:02:03 fs.write: `.task/os/land-workspace-overview-shell-on-current-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 07:05:45 `review.run`: passed — OK
- 2026-08-15 07:06:33 `verify`: passed — OK
- 2026-08-15 07:07:28 `verify`: failed — COMMAND_FAILED
- 2026-08-15 07:08:52 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the authenticated workspace shell lands on current `stream/os` without regressing newer auth/lifecycle behavior; `/` is Overview; the route picker has unsectioned Overview first, Observe/Configure groups, Guides/Documentation last, viewport-centered mobile geometry, semantic light/dark chrome; Overview has direct-labeled readiness context; Tools keeps the Tufte inventory/no-flash/re-enable behavior; daemon refresh cannot resurrect Nodes or the retired launcher.
existing local pattern: `packages/os/tests/settings-site.test.ts`, `launcher-nodes-materialization.test.ts`, `observability-traces-site.test.ts`, `sites-cli.test.ts`, install/connectivity tests, and the critical `os-internal-workspace-shell` selector from PR #2030.
new or changed tests: port the verified focused workspace-shell contracts onto current stream first, then adapt only where current stream intentionally changed APIs/auth boundaries. Keep the selector critical + exclusive.
focused red command: `bun --cwd packages/os test tests/settings-site.test.ts tests/launcher-nodes-materialization.test.ts tests/observability-traces-site.test.ts tests/sites-cli.test.ts tests/launcher-local-customization.test.ts tests/install-state.test.ts tests/local-agent-connectivity.test.ts`
expected red failure: current stream still serves the older configuration sidebar/launcher-root contracts and lacks the shared route picker, Overview readiness visualization, Guides/Documentation grouping, mobile centering, and Tools recovery surface.
no-test waiver: not applicable.

## Acceptance criteria

- [x] Preserve all current stream auth/lifecycle/Caddy behavior while restacking the UI from merge-conflicted PR #2030.
- [x] `/` deterministically materializes Overview after refresh/update/restart.
- [x] Shared macOS-style chrome is used by Overview, Tools, Nodes, Secrets, and Tracing.
- [x] Overview is first and unsectioned; Documentation is last under Guides.
- [x] Mobile route picker is centered on the viewport; light/dark mode is first-class.
- [x] Overview uses direct-labeled, accessible readiness visualization with signed snapshot hydration only.
- [x] Tools retains filters, visible disabled items, and re-enable controls.
- [x] Critical focused regression selector, browser visual proof, strict review, and verify against `origin/stream/os` all pass.

## Conflict note

PR #2030 could not merge because it was 54 commits behind `stream/os`. This task is intentionally started from current `stream/os` rather than overwriting newer stream code. Parallel PR #2035 was checked for overlap with the shared shell files and did not report any of the targeted paths.

## Validation evidence

- Current-stream focused baseline run was red before porting the shell (`trc_68139137880b`); the stream lacked the new UI contracts and also exposed one pre-existing flaky local-agent assertion on that run.
- Restacked only the reviewed UI/inventory/test files from PR #2030 onto current `stream/os`; newer auth/lifecycle/Caddy files outside those surfaces were not replaced (`trc_cc1e602a2263`).
- Critical workspace-shell implementation suite: 7 files / 69 tests passed, and OS syntax checks passed (`trc_63e1d28019ce`, before the selector assertion stage).
- Test-selection registry was regenerated from current stream rules plus the new critical exclusive `os-internal-workspace-shell` rule (`trc_b571dfcddfe9`). Selector unit tests then passed 35/35 (`trc_705f0c21e27b`).
- Desktop/light browser proof: 1440px viewport, picker center exactly 720px, Overview first, Guides last, Documentation `/docs`, light chrome/menu tokens resolved (`trc_2912bec60526`).
- Mobile/dark browser proof: 402px viewport, picker center exactly 201px, Overview first, Observe/Configure/Guides groups, Documentation last, dark chrome/menu tokens resolved (`trc_5a388ec1e4c3`).
- Strict review against current `origin/stream/os`: 0 issues / 0 blockers (`trc_b01521897d87`).
- Formal verify against current `origin/stream/os`: passed with `publishValid=true` (`trc_5c60d700e41d`).

## Status

Implementation is restacked on current `stream/os`, all acceptance criteria are satisfied, and the task is ready to publish/promote.

- 2026-08-15 07:02:03 append: `.task/os/land-workspace-overview-shell-on-current-stream/workpad.md`

## workspace-owned: files read

- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 07:04:27 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 07:05:17 apply-patch: `.task/os/land-workspace-overview-shell-on-current-stream/workpad.md`

- 2026-08-15 07:06:43 apply-patch: `.task/os/land-workspace-overview-shell-on-current-stream/workpad.md`
