# fix sites archive interactions json data

branch: `task/os/fix-sites-archive-interactions-json-data`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/893

## test-first contract

Behavior under test: the generated Sites archive must keep the embedded archive data parseable as JSON so the client script registers event listeners for filters, search, and command palette controls.

Existing pattern: `packages/workspace/tests/consuelo-design-theme.test.js` checks generator source markers for archive shell behavior.

Focused red command:

```bash
bun --cwd packages/workspace test tests/consuelo-design-theme.test.js
```

Expected red failure: missing raw `searchDataJson` marker and presence of the escaped `escapeHtml(JSON.stringify(searchEntries))` archive-data script.

## finding

Live page controls were inert because the archive generator wrote HTML-escaped JSON into `<script type="application/json" id="archive-search-data">`. The browser saw `&quot;` entities and `JSON.parse(...)` threw before listeners were attached.

## acceptance

- [x] Replace escaped JSON script payload with parseable JSON text.
- [x] Preserve script-safety escaping for `<`, `>`, `&`, U+2028, and U+2029.
- [x] Add regression test so archive data is not generated with `escapeHtml(JSON.stringify(...))` again.
- [x] Verify filters, search toggle, and command palette open on the live page.

## validation

- `node --check packages/workspace/scripts/consuelo-design.ts` passed.
- `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed: 8 tests.
- `bun ./packages/workspace/scripts/consuelo-design.ts refresh --dry-run --json` passed.
- `bun ./packages/workspace/scripts/consuelo-design.ts refresh --json` passed in task worktree.
- Browser eval confirmed `Guide` filter becomes active and sets `#guide`, search row opens, and command palette opens with commands.

## note

The task-worktree refresh used the task archive data root and temporarily served an empty archive list. After this fix is merged to `main`, run `design.refresh` from the main checkout so the canonical archive data and fixed generator are served together.

- 2026-06-09 22:34:26 write: `.task/os/fix-sites-archive-interactions-json-data/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-09 22:34:26 fs.write: `.task/os/fix-sites-archive-interactions-json-data/workpad.md`

## workspace-owned: validation evidence

- 2026-06-09 22:34:52 `review.run`: passed — OK
- 2026-06-09 22:35:35 `review.run`: passed — OK
- 2026-06-09 22:35:57 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-sites-archive-interactions-json-data/current.json`, `.task/os/fix-sites-archive-interactions-json-data/evidence-log.json`, `.task/os/fix-sites-archive-interactions-json-data/read-log.json`, `.task/os/fix-sites-archive-interactions-json-data/session.json`, `.task/os/fix-sites-archive-interactions-json-data/workpad.md`, `.task/tasks/os/fix-sites-archive-interactions-json-data.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
