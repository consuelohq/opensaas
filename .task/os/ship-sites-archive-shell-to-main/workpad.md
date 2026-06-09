# ship sites archive shell to main

branch: `task/os/ship-sites-archive-shell-to-main`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/878
started: 2026-06-09

## issue

The prior PR recorded a task title on `stream/os`, but the actual files did not land. The live archive generator still used `/design-wiki`, `Consuelo Wiki`, and `https://wiki.consuelohq.com` defaults.

## acceptance criteria

- [x] Make `/sites` the canonical design archive route.
- [x] Keep `/design-wiki` as a legacy alias.
- [x] Prepare `https://sites.consuelohq.com` as default public origin.
- [x] Rename generated archive shell from Wiki to Sites.
- [x] Add functional archive filters and URL hash state.
- [x] Add command palette and new-window link behavior.
- [x] Verify actual working-tree diff exists before promotion.
- [x] Merge to stream and then main before live refresh.

## validation

- `git diff --stat` showed 2 changed files, 210 insertions, 73 deletions.
- `node --check packages/workspace/scripts/consuelo-design.ts` passed.
- `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed: 6 tests.
- `bun ./packages/workspace/scripts/consuelo-design.ts refresh --dry-run --json` returned canonical `/sites`, legacy `/design-wiki`, and both Tailscale serve commands.
- `checkFiles` passed for touched files.

## files

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

- 2026-06-09 20:18:00 write: `.task/os/ship-sites-archive-shell-to-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-09 20:18:00 fs.write: `.task/os/ship-sites-archive-shell-to-main/workpad.md`

## workspace-owned: validation evidence

- 2026-06-09 20:18:39 `review.run`: passed — OK
- 2026-06-09 20:19:30 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/ship-sites-archive-shell-to-main/current.json`, `.task/os/ship-sites-archive-shell-to-main/session.json`, `.task/os/ship-sites-archive-shell-to-main/workpad.md`, `.task/tasks/os/ship-sites-archive-shell-to-main.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
