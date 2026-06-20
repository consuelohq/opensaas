# revert sites launcher link behavior

branch: `task/workspace-agents/revert-sites-launcher-link-behavior`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1158/revert-sites-launcher-link-behavior
github pr: https://github.com/consuelohq/opensaas/pull/1158
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

- 2026-06-20 01:47:40 `review.run`: passed — OK
- 2026-06-20 01:48:16 `verify`: passed — OK

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

# revert sites launcher link behavior

branch: `task/workspace-agents/revert-sites-launcher-link-behavior`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1158/revert-sites-launcher-link-behavior
github pr: https://github.com/consuelohq/opensaas/pull/1158
started: 2026-06-20

## acceptance criteria

- [x] Restore previous new-tab behavior on the Workspace-generated Sites launcher.
- [x] Restore previous new-tab behavior on the OS Sites launcher.
- [x] Keep the requested Office archive behavior: archive cards/search results same-tab and command palette link execution same-tab.
- [x] Adjust tests to scope the no-new-tab assertion to Office archive cards rather than the whole source file.

## implementation

- Re-added `target="_blank" rel="noopener noreferrer"` to Workspace Sites launcher links only.
- Re-added `target="_blank" rel="noopener noreferrer"` to OS Sites launcher links and its test expectation.
- Preserved the Office archive index/search link markup without forced target attributes.
- Preserved Office command palette `window.location.assign(href)` behavior.

## validation evidence

- `bun --cwd packages/workspace test tests/office-theme.test.js`: passed, 15 tests. Trace `trc_06e89313d389`.
- `bun --cwd packages/os test tests/sites-cli.test.ts`: passed, 6 tests. Trace `trc_06e89313d389`.


## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/keep-office-links-in-same-tab.json`, `.task/tasks/workspace-agents/revert-sites-launcher-link-behavior.json`, `.task/workspace-agents/keep-office-links-in-same-tab/current.json`, `.task/workspace-agents/keep-office-links-in-same-tab/session.json`, `.task/workspace-agents/keep-office-links-in-same-tab/verify.json`, `.task/workspace-agents/keep-office-links-in-same-tab/workpad.md`, `.task/workspace-agents/revert-sites-launcher-link-behavior/current.json`, `.task/workspace-agents/revert-sites-launcher-link-behavior/session.json`, `.task/workspace-agents/revert-sites-launcher-link-behavior/workpad.md`, `packages/os/scripts/lib/sites.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/workspace/scripts/office.ts`, `packages/workspace/tests/office-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## validation gate

- `review.run` passed with 0 own issues, 0 pre-existing issues, and 0 blocking issues. Trace `trc_a9db2c519acc`.
- `verify` passed and wrote a publish-valid stamp. Trace `trc_f10c3562a706`.

