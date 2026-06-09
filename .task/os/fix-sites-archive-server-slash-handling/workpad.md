# fix sites archive server slash handling

branch: `task/os/fix-sites-archive-server-slash-handling`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/882
started: 2026-06-09

## issue

After the Sites archive shell landed, live refresh generated an invalid archive `server.ts` with `url.pathname.replace(//$/, "")`, so Bun failed to start the archive server and port `53935` closed.

## fix

- Removed the generated inline regex from the archive route check.
- Added a generated `cleanArchivePath` variable using `endsWith('/')` plus `slice(0, -1)`.
- Preserved canonical `/sites` and legacy `/design-wiki` route support.
- Added regression test markers so regex escaping drift does not return.

## validation

- `node --check packages/workspace/scripts/consuelo-design.ts` passed.
- `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed: 7 tests.
- Real `bun ./packages/workspace/scripts/consuelo-design.ts refresh --json` in the task worktree succeeded and left port `53935` open.
- `bun ./packages/workspace/scripts/consuelo-design.ts refresh --dry-run --json` returned `/sites`, `/design-wiki`, and both serve commands.
- `checkFiles` passed for touched files.

## files

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

- 2026-06-09 20:36:42 write: `.task/os/fix-sites-archive-server-slash-handling/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-09 20:36:42 fs.write: `.task/os/fix-sites-archive-server-slash-handling/workpad.md`
- 2026-06-09 20:45:25 fs.write: `.task/os/fix-sites-archive-server-slash-handling/workpad.md`

## workspace-owned: validation evidence

- 2026-06-09 20:39:11 `review.run`: passed — OK
- 2026-06-09 20:40:05 `verify`: passed — OK
- 2026-06-09 20:46:03 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-sites-archive-server-slash-handling/current.json`, `.task/os/fix-sites-archive-server-slash-handling/evidence-log.json`, `.task/os/fix-sites-archive-server-slash-handling/read-log.json`, `.task/os/fix-sites-archive-server-slash-handling/session.json`, `.task/os/fix-sites-archive-server-slash-handling/verify.json`, `.task/os/fix-sites-archive-server-slash-handling/workpad.md`, `.task/tasks/os/fix-sites-archive-server-slash-handling.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## publication note

After syncing the local task branch to the pushed commit, this workpad was updated again for the publish gate. The code fix is already pushed on `78889bdf593fb9e9f5dab4ef268012ea49a9ea8f`; this note records that the task is an emergency live Sites repair because the previously generated server crashed and closed port `53935`.

- 2026-06-09 20:45:25 append: `.task/os/fix-sites-archive-server-slash-handling/workpad.md`
