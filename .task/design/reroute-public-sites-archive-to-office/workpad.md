# reroute public sites archive to office

branch: `task/design/reroute-public-sites-archive-to-office`
stream: `stream/design`
pr: https://github.com/consuelohq/opensaas/pull/912
started: 2026-06-10

## objective

Fix the public Sites archive surface Ko showed in the screenshot. The current public root still renders the old `Sites` archive page. The public root should send users to `/office`, `/office` should serve the archive list, the docs link should go to the website blog, and existing artifact routes should keep working.

## test-first contract

Behavior under test: the generated public archive server routes root and `/sites` aliases to an Office entry point, serves the archive at `/office`, preserves entry/version routes, and points documentation to `https://consuelohq.com/blog/`.

Existing pattern: `packages/workspace/tests/consuelo-design-theme.test.js` checks source markers for generated archive shell behavior and server route generation.

Focused red command:

```bash
bun --cwd packages/workspace test tests/consuelo-design-theme.test.js
```

Expected red failure: missing public Office path constants, missing root redirect helper/route, missing blog docs URL, and server still returning the archive index for `/`.

## acceptance

- [ ] Public root redirects users to `/office`.
- [ ] Public `/sites` aliases also redirect to `/office`.
- [ ] Public `/office` serves the archive page currently shown at root.
- [ ] Docs/Documentation command/link points to `https://consuelohq.com/blog/`.
- [ ] Existing artifact and version routes still resolve from their original root paths.
- [ ] Archive is refreshed and live behavior is verified.

- 2026-06-10 02:25:17 write: `.task/design/reroute-public-sites-archive-to-office/workpad.md`

## files changed

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: files changed

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: activity log

- 2026-06-10 02:25:17 fs.write: `.task/design/reroute-public-sites-archive-to-office/workpad.md`
- 2026-06-10 02:25:48 fs.write: `packages/workspace/tests/consuelo-design-theme.test.js`
- 2026-06-10 02:29:18 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:29:30 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:29:41 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:29:53 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:30:15 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:30:26 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:30:35 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:30:44 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:30:54 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:31:17 fs.write: `packages/workspace/tests/consuelo-design-theme.test.js`
- 2026-06-10 02:32:08 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 02:32:17 fs.write: `packages/workspace/tests/consuelo-design-theme.test.js`
- 2026-06-10 02:34:02 fs.write: `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: files read

- `packages/workspace/package.json`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

- 2026-06-10 02:34:02 write: `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: validation evidence

- 2026-06-10 02:35:12 `review.run`: passed — OK
- 2026-06-10 02:35:35 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/reroute-public-sites-archive-to-office/current.json`, `.task/design/reroute-public-sites-archive-to-office/evidence-log.json`, `.task/design/reroute-public-sites-archive-to-office/read-log.json`, `.task/design/reroute-public-sites-archive-to-office/session.json`, `.task/design/reroute-public-sites-archive-to-office/workpad.md`, `.task/tasks/design/reroute-public-sites-archive-to-office.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
