# add wiki revision guard

branch: `task/design/add-wiki-revision-guard`
stream: `stream/design`
pr: https://github.com/consuelohq/opensaas/pull/823
started: 2026-06-06

## goal

Prevent multiple agents from overwriting each other's design wiki/doc artifact work by adding an optimistic revision guard to `consuelo-design publish`.

This is the first safety layer. It does not yet implement full section-level patch merge or leases, but it blocks stale whole-page publishes and gives agents a deterministic recovery/rebase signal.

## backup

Before changing code, manually backed up the current trace page/archive state to:

```text
/tmp/trace-burn-intelligence-backup-20260606T191434Z
```

Backup manifest found two live entries:

- `/design/trace-burn-intelligence` with target `https://trace-burn-intelligence.localhost:1355`, updated `2026-06-06T15:47:30.928Z`.
- `/trace-burn-intelligence` with artifact `artifacts/trace-burn-intelligence/index.html`, current version `2026-06-05T20-37-01-477Z`.

## implementation

- Added `--base-version <id>` and alias `--base-revision <id>` to `consuelo-design publish`.
- Added `--force-publish` as an explicit intentional overwrite escape hatch.
- Added `currentArchiveVersionForPath` and `assertArchiveRevisionWritable`.
- Existing pages now require the caller to provide the current page version unless `--force-publish` is used.
- Dry-run plans include `currentVersionId`, `requiredBaseVersion`, and `forcePublish` so agents know what to pass before real publish.
- Added AGENTS guidance for the new publish concurrency guard.
- Added source-level regression coverage in `packages/workspace/tests/consuelo-design-theme.test.js`.

## validation

- Backup command succeeded: trace `trc_6fa09a89a75c`.
- Red test established: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` failed before implementation on missing `baseVersion?: string;`, trace `trc_5b0d62c99bb4`.
- Syntax: `node --check packages/workspace/scripts/consuelo-design.ts` passed, trace `trc_fb7836dda704`.
- Green test: `bun --cwd packages/workspace test tests/consuelo-design-theme.test.js` passed, 5 tests, trace `trc_92a09d08413c`.
- Static: `checkFiles` passed for `packages/workspace/scripts/consuelo-design.ts` and `packages/workspace/tests/consuelo-design-theme.test.js`, trace `trc_bb12e82a04f1`.
- New-page dry-run smoke passed and surfaced `currentVersionId: null`, `requiredBaseVersion: null`, `forcePublish: false`, trace `trc_cf8990f1ff63`.
- Existing-page guard smoke passed: dry-run without base version failed with `stale design wiki publish rejected`; dry-run with `--base-version rev-current` passed and returned `currentVersionId: rev-current`, trace `trc_aabd9984febf`.
- Cleaned task-local fake archive `.od` after smoke, trace `trc_99b5459d745e`.
- Design boundary check passed: `cd packages/workspace && bun run consuelo-design check --json`, trace `trc_f011a2c46b0e`.

## next layer

Follow-up should add section/component-level patches and leases:

- `wiki:patch` for typed section/component patches against `baseVersion`.
- Per-section/component IDs in artifact manifests.
- Auto-merge for non-overlapping section changes.
- Conflict packet when two agents edit the same section from the same base.
- Optional TTL leases for high-traffic pages like `trace-burn-intelligence`.

## files changed

- `areas/consuelo-design/AGENTS.md`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: files changed

- `areas/consuelo-design/AGENTS.md`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: activity log

- 2026-06-06 19:19:46 fs.write: `.task/design/add-wiki-revision-guard/workpad.md`

## workspace-owned: validation evidence

- 2026-06-06 19:20:18 `review.run`: passed — OK
- 2026-06-06 19:20:31 `verify`: passed — OK
- 2026-06-06 19:22:08 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/add-wiki-revision-guard/current.json`, `.task/design/add-wiki-revision-guard/evidence-log.json`, `.task/design/add-wiki-revision-guard/read-log.json`, `.task/design/add-wiki-revision-guard/session.json`, `.task/design/add-wiki-revision-guard/verify.json`, `.task/design/add-wiki-revision-guard/workpad.md`, `.task/tasks/design/add-wiki-revision-guard.json`, `areas/consuelo-design/AGENTS.md`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final publish note — 2026-06-06

This task intentionally shipped the first safety layer only: optimistic revision checking at publish time. It does not migrate or rewrite `trace-burn-intelligence`; the live page was backed up before work began, and all mutation/test smoke after that used task-local dry-run/fake archive state.

Why this changed:

- Multiple agents were editing/publishing the same artifact and stale whole-page publishes could overwrite newer work.
- Page versioning lets us recover, but it does not prevent stale writes.
- `--base-version` makes the agent prove it read the latest page revision before publishing over an existing page.

Behavior now:

- New pages can publish without a base version.
- Existing pages reject publish without `--base-version` / `--base-revision` unless `--force-publish` is used.
- Existing pages reject publish if the supplied base version does not match the current archive version.
- Dry-run exposes the current version fields so agents know what to pass before real publish.

Follow-up remains section-level patching/leases. This guard is the minimum viable overwrite blocker.
