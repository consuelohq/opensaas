# terminal style sites launcher

branch: `task/os/terminal-style-sites-launcher`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/908
started: 2026-06-09

## goal

Rework the OS Sites landing page into a minimal terminal-style Consuelo OS launcher using the existing dark terminal/mono design language. Do not create a separate Office top-level concept. Link the open Systems Engineer position to `/jobs` until the careers page exists.

## acceptance

- [x] Sites index title is `Consuelo OS Sites`.
- [x] Launcher renders `CONSUELO OS`, contact, location, online status, and open position.
- [x] Systems Engineer links to `/jobs`.
- [x] Launcher has exactly the flat primary destinations: Office, Diffs, Tracing, Documentation.
- [x] Primary destination links open in a new tab/window with safe rel attributes.
- [x] Documentation has a generated top-level local Sites page at `sites/docs/index.html`.
- [x] Launcher uses terminal-style CSS: black background, monospace font, underline links, top-left layout.
- [x] Existing Sites page registry, publish guard, typed reader render, patch, and lease tests keep passing.

## tdd

Red test added to `packages/os/tests/sites-cli.test.ts` before implementation: `renders the Sites launcher as a terminal-style Consuelo OS page with flat destinations`.

Focused red command:

```bash
bun --cwd packages/os test tests/sites-cli.test.ts
```

Expected red failure observed: generated index still had `<title>Sites</title>`, light Inter/card grid styles, and Pages/Office/Traces/Diffs cards.

## implementation

- Reworked `packages/os/scripts/lib/sites.ts` Sites index renderer into the terminal-style launcher.
- Kept the existing underlying style work: dark mono text, underline links, compact top-left operational layout.
- Added `docs/` as a reserved Sites destination/page.
- Retitled `Traces` display to `Tracing` for the launcher/destination page.
- Added docs path/status plumbing to `packages/os/scripts/os.ts`.
- Extended `packages/os/tests/sites-cli.test.ts` to cover the new launcher and docs path.

## validation

- `bun --cwd packages/os test tests/sites-cli.test.ts` passed: 6 tests.

## files changed

- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/sites-cli.test.ts`

## notes

- `/jobs` is intentionally used as the open-position target because the specific Systems Engineer careers page is being created separately.
- This PR does not restructure Office or move Office artifacts into another top-level concept.

- 2026-06-10 02:03:11 write: `.task/os/terminal-style-sites-launcher/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: activity log

- 2026-06-10 02:03:11 fs.write: `.task/os/terminal-style-sites-launcher/workpad.md`

## workspace-owned: validation evidence

- 2026-06-10 02:03:41 `review.run`: passed — OK
- 2026-06-10 02:04:32 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/terminal-style-sites-launcher/current.json`, `.task/os/terminal-style-sites-launcher/evidence-log.json`, `.task/os/terminal-style-sites-launcher/read-log.json`, `.task/os/terminal-style-sites-launcher/session.json`, `.task/os/terminal-style-sites-launcher/workpad.md`, `.task/tasks/os/terminal-style-sites-launcher.json`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/os.ts`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
