# repair sites routes

branch: `task/design/repair-sites-routes`
stream: `stream/design`
pr: PR 920
started: 2026-06-10

## objective

Repair the public Sites routing contract. Root serves the launcher. Office serves the archive index. Office-prefixed artifact routes resolve. Existing root artifact routes keep working. Sites and design-wiki remain archive aliases. Documentation and decision links use the corrected destinations.

## test-first contract

Behavior under test: the generated public archive server renders a launcher at root, exposes Office as the canonical archive prefix, preserves root artifact compatibility routes, emits Office-prefixed archive links, and uses the corrected docs and article URLs.

Existing pattern: `packages/workspace/tests/consuelo-design-theme.test.js` checks source markers for generated archive shell behavior and server route generation.

Focused red command:

```bash
bun --cwd packages/workspace test tests/consuelo-design-theme.test.js
```

Expected red failure: missing Office path constant, missing launcher renderer, missing Office-prefixed artifact route aliases, and missing corrected docs or article URLs.

## acceptance

- [ ] Root renders launcher.
- [ ] Office renders the archive index.
- [ ] Office-prefixed spec route resolves.
- [ ] Root spec route still resolves.
- [ ] Sites and design-wiki remain archive aliases.
- [ ] Docs link is corrected.
- [ ] Decision article link is corrected.
- [ ] Stream changes are promoted to main.
- [ ] Archive is refreshed and live behavior is verified.

- 2026-06-10 03:08:59 write: `.task/design/repair-sites-routes/workpad.md`

## files changed

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: files changed

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: activity log

- 2026-06-10 03:08:59 fs.write: `.task/design/repair-sites-routes/workpad.md`
- 2026-06-10 03:09:37 fs.write: `packages/workspace/tests/consuelo-design-theme.test.js`
- 2026-06-10 03:11:00 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-10 03:12:04 fs.patch: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: files read

- `packages/workspace/package.json`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: validation evidence

- 2026-06-10 03:43:11 `review.run`: passed — OK
- 2026-06-10 03:43:32 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/repair-sites-routes/current.json`, `.task/design/repair-sites-routes/evidence-log.json`, `.task/design/repair-sites-routes/read-log.json`, `.task/design/repair-sites-routes/session.json`, `.task/design/repair-sites-routes/workpad.md`, `.task/tasks/design/repair-sites-routes.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
