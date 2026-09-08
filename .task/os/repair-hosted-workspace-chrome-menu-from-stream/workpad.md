# repair hosted workspace chrome menu from stream

branch: `task/os/repair-hosted-workspace-chrome-menu-from-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2398/repair-hosted-workspace-chrome-menu-from-stream
github pr: https://github.com/consuelohq/opensaas/pull/2398
started: 2026-09-05

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/workspace-chrome.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 03:34:58 fs.write: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`
- 2026-09-05 03:35:35 fs.write: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`
- 2026-09-05 03:38:36 fs.write: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`
- 2026-09-05 03:39:27 fs.write: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`
- 2026-09-05 03:40:21 fs.write: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 03:35:54 `review.run`: passed — OK
- 2026-09-05 03:37:02 `verify`: failed — COMMAND_FAILED
- 2026-09-05 03:39:40 `review.run`: passed — OK
- 2026-09-05 03:40:15 `verify`: passed — OK

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

## Acceptance criteria

- [ ] `internal.consuelohq.com` shows `Users & installs` in the workspace route menu on release-managed static shells such as Home and Tracing.
- [ ] Code, Artifacts, and the Internal dashboard keep exactly one `Users & installs` item when they already render the configured internal route.
- [ ] Non-internal workspace hosts never receive the private admin shortcut.
- [ ] The existing OS release snapshot refresh continues to propagate the shared chrome change across every release-managed static workspace shell.
- [ ] Focused tests, strict review, full verify, publication, release, and live browser checks all pass.

## Plan

1. Add a focused workspace-chrome regression and prove RED on the current `stream/os` baseline.
2. Add the smallest host-gated, deduplicating internal-route synthesis to the shared workspace chrome client.
3. Prove GREEN plus the adjacent launcher/release regression slice.
4. Review and verify against `origin/stream/os`, publish into `stream/os`, run the OS release path, and verify the live menu on Home, Tracing, Code, Artifacts, and Users.

## Test-first contract

behavior under test: stock release-managed workspace chrome served on `internal.consuelohq.com` synthesizes one `Internal` group with a same-origin `Users & installs` link when that link is absent; an already-rendered internal route is preserved without duplication; other hosts never synthesize the admin shortcut.
existing local pattern: `workspaceChromeClientScript()` already owns host-aware same-origin private-route handling, while the OS release builds shared stock snapshots and refreshes the IDs in `WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS`.
new or changed tests: extend `packages/os/tests/workspace-chrome.test.ts` with a host-aware internal-route client contract. Existing OS release-contract coverage remains the propagation proof unless current-stream inspection contradicts it.
focused red command: `bun --cwd packages/os x vitest run tests/workspace-chrome.test.ts`
expected red failure: the current client script has no internal-host route synthesis or dedupe logic, so the new contract must fail before implementation.
no-test waiver: not applicable.

## Key decision

The inconsistent live menu is caused by two rendering paths: Home/Tracing and the other release-managed shells come from shared snapshots built from an empty temporary OS home, so they cannot inherit Ko's local `launcher.extraSections`; Code/Artifacts read the live local config and therefore already show the custom route. The shared snapshot must remain safe for every workspace, so the internal admin shortcut will be synthesized only at runtime when the browser host is exactly `internal.consuelohq.com`.

- 2026-09-05 03:34:58 append: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`

- 2026-09-05 03:35:05 apply-patch: `packages/os/tests/workspace-chrome.test.ts`
- 2026-09-05 03:35:14 apply-patch: `packages/os/scripts/lib/workspace-chrome.ts`
## Current status

- Implementation is complete on the stream-based task. Only `workspace-chrome.ts`, its focused test, and task metadata are changed.
- No release-pipeline production code change is required: current `stream/os` already rebuilds shared snapshots from source and refreshes the route registry for every release-managed static shell after an OS release.

## Validation evidence

- RED: `bun --cwd packages/os x vitest run tests/workspace-chrome.test.ts` failed exactly the new internal-host synthesis contract (1 failed / 2 passed) before production code changed; trace `trc_c978050e00e8`.
- GREEN: same focused suite passes 3/3; trace `trc_f13d7f0432ad`.
- Adjacent slice passes 28/28 across `workspace-chrome`, `internal-launcher-regressions`, `launcher-local-customization`, and `os-device-authority-release-contract`; trace `trc_a30a93fa4ec7`.
- Diff inspection confirms the task is now isolated from the unrelated main-vs-stream changes seen in the discarded main-based task: production scope is one shared chrome file plus one regression test.

## Implementation notes

- Shared snapshot HTML remains host-neutral. The browser synthesizes the private shortcut only when `window.location.hostname` is exactly `internal.consuelohq.com`.
- The insertion uses DOM APIs, not HTML interpolation.
- Dedupe checks the synthetic marker, an existing private-route `/users` return path, and an existing direct `/users` link before inserting.
- The synthesized link reuses the existing private-route data attributes, so same-host navigation goes directly to `/users` through the existing handler.

- 2026-09-05 03:35:35 append: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`

## Test-selection recovery contract

behavior under test: changing `packages/os/tests/workspace-chrome.test.ts` is owned by the existing exclusive `os-internal-workspace-shell` rule, runs that focused test inside the critical shell suite, and does not fall through to the historically red broad `@consuelo/os package test`.
existing local pattern: the rule already marks `workspace-chrome.ts` and adjacent shell test files as exclusive, and its selector regression asserts the broad package suite is not selected.
new or changed tests: extend the existing selector regression to include `workspace-chrome.test.ts` as a changed file and as a required command member.
focused red command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "routes internal workspace shell and root Sites changes through loud focused contracts"`
expected red failure: current rule does not list `workspace-chrome.test.ts`, so the auto package rule is selected and the focused suite omits the new regression file.
no-test waiver: not applicable.

## Verify recovery

Full verify reached the intended critical shell suite (85/85 passing) and syntax gate, but then the changed `workspace-chrome.test.ts` fell through to the broad OS package suite because it is missing from the exclusive shell rule. The broad suite failed on unrelated existing baselines (`lifecycle-help`, `skill-migration`, daemon reliability, and other package-wide state). This is a selector ownership gap directly exposed by this task, so the recovery is to bind this test file to its existing focused critical rule rather than weaken verification.

- 2026-09-05 03:38:36 append: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`

- 2026-09-05 03:38:40 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-05 03:38:47 apply-patch: `packages/workspace/test-selection.rules.json`

## workspace-owned: files read

- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/test-selection.js`

## Test-selection recovery evidence

- RED selector regression: the focused selector test failed because `workspace-chrome.test.ts` still selected `auto:@consuelo/os:package-test`; trace `trc_ab9db2bd7e57`.
- Added `workspace-chrome.test.ts` to the existing exclusive `os-internal-workspace-shell` source list and critical contract command, then regenerated `packages/workspace/test-selection.registry.json` from the canonical generator.
- GREEN selector regression: targeted selector test passes; trace `trc_6b4166ab3e07`.
- Full test-selection suite passes 73/73; trace `trc_579d5233609f`.
- This does not waive the broad package suite; it restores the existing design intent that this shell surface is verified by the explicit critical suite instead of unrelated historically red package-wide tests.

- 2026-09-05 03:39:27 append: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`

## Final pre-publish validation

- Strict review against `origin/stream/os`: 0 issues, 0 blockers; trace `trc_e1bff27c62ca`.
- Full verify now passes with `publishValid: true`; critical shell contracts, focused selector ownership, syntax/type/static checks, and DB guard are green; trace `trc_33dc72172396`.

## Files changed

- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/workspace-chrome.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json` (regenerated)
- `packages/workspace/tests/test-selection.test.js`
- task-local workpad/verification metadata

## Notes for Ko

- The earlier task #2397 was intentionally abandoned because it started from `main` while `stream/os` is divergent; this task #2398 starts directly from current `stream/os` and contains only the intended fix plus the selector ownership repair.

- 2026-09-05 03:40:21 append: `.task/os/repair-hosted-workspace-chrome-menu-from-stream/workpad.md`
