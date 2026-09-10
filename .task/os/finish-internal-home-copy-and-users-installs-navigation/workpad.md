# finish internal home copy and users installs navigation

branch: `task/os/finish-internal-home-copy-and-users-installs-navigation`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2410
started: 2026-09-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/tests/settings-control-plane.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`


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

## Acceptance criteria

- [ ] Home no longer renders the introductory description, the empty-state `Live trace activity will appear here` heading, or the `Calls, tokens, and cost by local hour...` helper copy requested by Ko.
- [ ] `Users & installs` is rendered from the shared workspace chrome on every internal workspace surface that uses the shared chrome, rather than only a subset of pages.
- [ ] Clicking `Users & installs` from `internal.consuelohq.com` reaches `/users` directly and does not fall into a same-host `/auth/handoff/start` 404.
- [ ] Cross-host private navigation still uses the authenticated handoff and preserves existing security constraints.
- [ ] Focused tests, review, verify, stream promotion, main merge, release, and a live smoke check complete.

## Plan

1. Read the Home renderer, shared chrome/custom-route plumbing, and workspace-edge handoff route plus their focused tests.
2. Add focused regressions for the requested copy removal, consistent internal menu rendering, and same-host direct navigation; run RED.
3. Implement the smallest shared fix, rerun GREEN, then review/verify and publish through `stream/os`.
4. Merge the stream to `main`, release the affected internal workspace surface, and smoke the live Home and Users route.

## Test-first contract

behavior under test: Home omits the three requested copy blocks; shared chrome consistently exposes `Users & installs`; private navigation uses direct same-origin `/users` when already on `internal.consuelohq.com` and reserves `/auth/handoff/start` for cross-host transitions.
existing local pattern: `settings-site.ts` owns Home markup/hydration, `workspace-chrome.ts` owns shared menu/private-route link rendering, and `workspace-edge` owns authenticated cross-host handoff validation.
new or changed tests: extend the nearest Home/settings-site assertions and `workspace-chrome.test.ts`; add or adjust workspace-edge/auth regression only if the handler contract itself changes.
focused red command: run the focused OS tests owning Home/settings-site, workspace chrome, and internal launcher regressions after adding assertions.
expected red failure: current Home still contains all three strings, and current chrome serializes same-host internal links through `/auth/handoff/start`.
no-test waiver: not applicable.

- 2026-09-08 14:25:48 append: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:25:48 fs.write: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`
- 2026-09-08 14:30:52 fs.write: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`
- 2026-09-08 14:35:47 fs.write: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`
- 2026-09-08 14:38:39 fs.write: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-chrome-config.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/internal-launcher-regressions.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/os/tests/settings-control-plane.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Current status

- The three Home copy removals and same-host private-route click interception were already present on `stream/os`; the stream was 60 commits behind `main`, so I synced `stream/os` with current `main` before continuing and merged that updated stream into this task worktree.
- The remaining reproducible inconsistency was in settings rematerialization: `applySettingsOverlayPatchEffect` called `materializeConfigurationSite(home)` and that function defaulted `chromeOptions` to `{}`, so any settings mutation regenerated Home/Tools/Nodes/Environments/Secrets without launcher `extraSections`. That directly explains why `Users & installs` could be present on some shared surfaces but disappear on rematerialized configuration surfaces.
- The cross-host handoff endpoint is present in the current Workspace Edge source and has an existing integration contract; the shared chrome also intercepts same-host internal navigation and sends it straight to `/users`, avoiding the handoff path when already on `internal.consuelohq.com`.

## Files changed

- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/tests/settings-control-plane.test.ts`

## Key decisions

- Fix the bug at the materialization boundary instead of only in `settings-control-plane.ts`: `materializeConfigurationSite(home)` now loads launcher chrome options by default, so every caller that rematerializes configuration pages preserves custom routes unless it intentionally supplies explicit chrome options.
- Keep the existing authenticated handoff model for cross-host navigation; do not weaken it. Same-host direct navigation remains handled by the shared chrome client.

## Validation evidence

- RED: new `settings-control-plane` regression failed because regenerated configuration HTML lacked `data-custom-route-group="internal"` and `Users & installs` (trace `trc_3e86f7732a22`).
- GREEN: the same focused test passes 4/4 after the materialization default fix (trace `trc_61aa4f3b9bd0`).
- Combined focused suite passes 27/27 across settings rematerialization, Home copy, launcher customization, shared chrome same-host routing, and universal login/private handoff (trace `trc_6f4c5faa46cc`).
- Existing Home regression contract explicitly proves all three requested strings are absent from rendered Home.

## Issues and recovery

- Initial `stream.sync` call included a facade-supported `repo` field that the underlying script does not accept; retried without `repo` and the stream sync completed successfully.
- Initial code-edit call placed `maxResultChars` at the outer OS envelope instead of inside `code.call` input; retried with the correct typed shape.

- 2026-09-08 14:30:52 append: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`

## workspace-owned: validation evidence

- RED: new `settings-control-plane` regression failed because regenerated configuration HTML lacked `data-custom-route-group="internal"` and `Users & installs` (trace `trc_3e86f7732a22`).
- GREEN: the same focused test passes 4/4 after the materialization default fix (trace `trc_61aa4f3b9bd0`).
- Combined focused suite passes 27/27 across settings rematerialization, Home copy, launcher customization, shared chrome same-host routing, and universal login/private handoff (trace `trc_6f4c5faa46cc`).
- Existing Home regression contract explicitly proves all three requested strings are absent from rendered Home.
- 2026-09-08 14:31:58 `review.run`: passed — OK
- 2026-09-08 14:33:59 `verify`: failed — COMMAND_FAILED
- 2026-09-08 14:37:45 `review.run`: passed — OK
- 2026-09-08 14:38:29 `verify`: passed — OK

## Test-selection contract

behavior under test: settings-control-plane regressions that exercise configuration rematerialization belong to the existing exclusive `os-internal-workspace-shell` gate, so changing that focused test must not fan out into the unrelated historically-red full `@consuelo/os` package suite.
existing local pattern: the internal workspace shell rule is already critical+exclusive and owns `settings-materialization.ts`, but its source/test command list omits `settings-control-plane.test.ts`; therefore the changed test independently triggers auto package discovery.
new or changed tests: extend the existing workspace test-selection regression to include `packages/os/tests/settings-control-plane.test.ts`, require no auto package rule, and require the focused shell suite to execute that test.
focused red evidence: full verify selected the focused shell suites successfully but also selected and failed the unrelated `@consuelo/os package test`; the focused shell contracts themselves passed 88/88 and syntax passed (trace `trc_6e5116352791`).
expected green: selector maps both the production file and its new regression exclusively to `os-internal-workspace-shell`; full verify no longer fans out into unrelated OS package failures.
no-test waiver: not applicable.

- 2026-09-08 14:35:47 append: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`

## Final local validation

- Test-selection RED: adding `settings-control-plane.test.ts` to the changed-file scenario still selected `auto:@consuelo/os:package-test` before registry ownership was updated (trace `trc_0ceecb7ef69b`).
- Test-selection GREEN: after adding the regression to the exclusive internal workspace shell rule and regenerating the registry, the focused selector contract passes (trace `trc_e0f15cd19083`).
- Strict review against `origin/stream/os`: 0 issues / 0 blockers across Consuelo OS + Workspace selector changes (trace `trc_8f02426d26b0`).
- Full verify against `origin/stream/os`: passed, `publishValid=true`; focused internal workspace shell + selector gates own the change (trace `trc_c3c9cc55125f`).

## Acceptance checklist

- [x] Requested Home introductory/empty-state/helper copy is absent in the current stream render contract.
- [x] Settings rematerialization preserves launcher custom routes, including `Users & installs`, across configuration-owned surfaces.
- [x] Same-host internal navigation remains direct to `/users`; cross-host handoff remains authenticated and host allow-listed.
- [x] Focused regressions pass.
- [x] Strict review passes.
- [x] Full verify is publish-valid.
- [ ] Promote to stream, merge to main, release, and live-smoke the hosted internal workspace.

- 2026-09-08 14:38:39 append: `.task/os/finish-internal-home-copy-and-users-installs-navigation/workpad.md`
