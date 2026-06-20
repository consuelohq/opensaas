# keep office links in same tab

branch: `task/workspace-agents/keep-office-links-in-same-tab`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1157/keep-office-links-in-same-tab
github pr: https://github.com/consuelohq/opensaas/pull/1157
started: 2026-06-20

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

- none yet

## workspace-owned: validation evidence

- 2026-06-20 01:36:45 `review.run`: passed — OK
- 2026-06-20 01:37:25 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

# keep office links in same tab

branch: `task/workspace-agents/keep-office-links-in-same-tab`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1157/keep-office-links-in-same-tab
github pr: https://github.com/consuelohq/opensaas/pull/1157
started: 2026-06-20

## acceptance criteria

- [ ] Office archive cards navigate in the same tab by default.
- [ ] Office search/result links navigate in the same tab by default.
- [ ] Workspace-generated Sites launcher links navigate in the same tab by default.
- [ ] OS Sites launcher links navigate in the same tab by default.
- [ ] Browser-native modifier-click behavior is preserved by using normal anchors without target forcing.
- [ ] Add focused regression coverage and run focused Workspace/OS tests.

## plan

1. Add regression assertions that generated Office/Sites surfaces do not force `target="_blank"` or JS `window.open(..._blank...)`.
2. Run focused tests red.
3. Remove forced new-tab targets and use same-tab navigation for command palette link execution.
4. Run focused tests green, inspect diff, then run review/verify.


## implementation

- Removed forced `target="_blank" rel="noopener noreferrer"` from Workspace-generated Office/archive/Sites launcher anchors.
- Replaced Office command palette link execution from `window.open(..., '_blank', ...)` to `window.location.assign(href)` for same-tab navigation.
- Removed forced new-tab attributes from the OS Sites launcher, including flat destination links and the jobs link.
- Added regression assertions for Workspace and OS generated surfaces to reject forced new-tab behavior.

## validation evidence

- Red focused test run failed as expected after changing tests first: Workspace Office theme rejected `window.open(... '_blank' ...)`; OS Sites CLI rejected `target="_blank"`. Trace `trc_fae30b02f2d9`.
- Green focused Workspace test passed: `bun --cwd packages/workspace test tests/office-theme.test.js`, 15 tests. Trace `trc_59b4306672d2`.
- Green focused OS test passed: `bun --cwd packages/os test tests/sites-cli.test.ts`, 6 tests. Trace `trc_59b4306672d2`.
- Static scan of touched implementation files found no `_blank` or old JS new-window opener remaining. Trace `trc_894db1b22669`.


## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/keep-office-links-in-same-tab.json`, `.task/workspace-agents/keep-office-links-in-same-tab/current.json`, `.task/workspace-agents/keep-office-links-in-same-tab/session.json`, `.task/workspace-agents/keep-office-links-in-same-tab/workpad.md`, `packages/os/scripts/lib/sites.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/workspace/scripts/office.ts`, `packages/workspace/tests/office-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## validation gate

- `review.run` passed with 0 own issues, 0 pre-existing issues, and 0 blocking issues. Trace `trc_3b96f210aa69`.
- `verify` passed and wrote a publish-valid stamp. Trace `trc_7e6c9458a7c8`.

