# add os sites page registry and publish guard

Final scoped workpad update for PR publication.

Changed:
- Added OS Sites page registry in `packages/os/scripts/lib/sites.ts`.
- Added immutable page versions and current page pointer under `sites/pages`.
- Added `sites publish` in `packages/os/scripts/os.ts`.
- Added base-version guard for existing page publishes.
- Added `--base-revision` alias and `--force-publish` recovery override.
- Updated Sites skill, scripts docs, data model notes, and Sites CLI tests.

Why:
- PR 1 gives Sites the same first overwrite-prevention layer as design wiki pages.
- Multiple agents cannot silently overwrite an existing Sites page without proving they read the current version.

Validation:
- `node --check packages/os/scripts/lib/sites.ts` passed.
- `node --check packages/os/scripts/os.ts` passed.
- `cd packages/os && bun test tests/sites-cli.test.ts tests/install-state.test.ts tests/artifacts.test.ts tests/skills-registry.test.ts` passed: 21 tests, 201 assertions.
- Review against `origin/stream/os` passed with 0 issues from this change.
- Verify against `origin/stream/os` passed with publishValid true.

Branch correction:
- The task initially bootstrapped from main, then was reset back to `origin/stream/os` before final commit.
- Final diff is scoped to PR1 files only.

Follow-ups:
- PR 2 should add typed reader rendering inside Sites.
- PR 3 should add section patching, leases, and trace-burn-intelligence playground migration.

- 2026-06-09 04:59:18 write: `.task/os/add-os-sites-page-registry-and-publish-guard/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-09 04:59:18 fs.write: `.task/os/add-os-sites-page-registry-and-publish-guard/workpad.md`
