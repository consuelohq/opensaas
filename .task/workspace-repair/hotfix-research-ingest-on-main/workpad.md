# hotfix research ingest on main

branch: `task/workspace-repair/hotfix-research-ingest-on-main`
stream: `stream/workspace-repair`
task session: `tsk_e40517f51c9f`
task PR: https://github.com/consuelohq/opensaas/pull/830
started: 2026-06-07

## objective

Restore the workspace-owned `research:ingest` entrypoint onto the main-derived path so Ko can run root `bun run research:ingest ...` again.

## test-first contract

Behavior under test:

- Root `package.json` script `research:ingest` resolves to an existing workspace script target.
- `packages/workspace/scripts/research-ingest.js` parses and exposes help.
- Existing workspace research ingest tests pass.
- Workspace script audit reports no missing documented scripts.

Existing pattern:

- `packages/consuelo-core/registry/scripts.json` marks `research:ingest` as workspace-owned and points the source of truth at `origin/stream/workspace-repair` commit `57bdf02cae`.
- Previous repair workpad says this entrypoint was restored after OS copy drift, but it never reached local/main.

Red evidence:

- Ko's terminal showed `error: Module not found "packages/workspace/scripts/research-ingest.js"` for every root `research:ingest` run.
- Local main is synced with `origin/main`, but `/Users/kokayi/Dev/opensaas/packages/workspace/scripts` did not contain `research-ingest.js`.

## implementation

- Restored `packages/workspace/scripts/research-ingest.js` from `origin/stream/workspace-repair`, matching the registry source of truth.
- No package script or registry command needed to change; the registry was already correct and the file was missing from main.

## validation

- PASS `node --check packages/workspace/scripts/research-ingest.js`, trace `trc_6307755c746f`.
- PASS `bun packages/workspace/scripts/research-ingest.js --help`, trace `trc_f02147a11448`.
- PASS target test inside broader workspace run: `tests/research-ingest.test.js` passed 2 tests in `bun --cwd packages/workspace test`, trace `trc_8a4a04e7c7f0`.
- PASS `bun run audit -- --scripts --json`, trace `trc_7f52c647435c`, with `missing: []` and `undocumented: []`.

## validation caveats

- Full `bun --cwd packages/workspace test` failed on unrelated existing tests: `tools-search-v2.test.ts`, `test-selection.test.js`, `codemode.test.ts`, and facade tests after the target research ingest tests passed.
- `bun --cwd packages/consuelo-core audit:registry` currently fails on unrelated missing local imports in codemode files: `./lib/codemode/tools/index` and `./types.js`. It no longer indicates the research ingest target is missing.
- A direct dry-run command with a positional source was blocked by the tool safety layer, but the help command, syntax check, script audit, and target tests validate the restored entrypoint.

## files changed

- `packages/workspace/scripts/research-ingest.js`

## workspace-owned: files changed

- `packages/workspace/scripts/research-ingest.js`

## workspace-owned: activity log

- 2026-06-07 09:12:35 fs.write: `.task/workspace-repair/hotfix-research-ingest-on-main/workpad.md`

## workspace-owned: validation evidence

- 2026-06-07 09:15:20 `review.run`: passed — OK
- 2026-06-07 09:15:35 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-repair/hotfix-research-ingest-on-main.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/current.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/evidence-log.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/read-log.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/session.json`, `.task/workspace-repair/hotfix-research-ingest-on-main/workpad.md`, `packages/workspace/scripts/research-ingest.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
