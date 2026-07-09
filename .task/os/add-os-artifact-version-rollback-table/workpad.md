# add os artifact version rollback table

branch: `task/os/add-os-artifact-version-rollback-table`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/945

## objective

Add OS-native artifact versioning so artifacts can be restored by version number or by time.

## Test-first contract

Behavior under test:
- Creating an artifact creates version 1 and marks it current.
- Updating an artifact creates version 2 and preserves version 1 bytes/metadata.
- History returns ordered versions with version numbers and current marker.
- Rollback to version 1 creates a new latest version with restored bytes and updates the artifact current pointer.
- Rollback before a timestamp selects the latest version at or before that time.

Existing pattern followed:
- `packages/os/scripts/lib/artifacts.ts` owns the artifact SQLite table and local byte writes.
- `packages/os/tests/artifacts.test.ts` already tests artifact creation through `CONSUELO_HOME` and `bun -e`.
- `materializeSites` runs after create/update/rollback so local Sites stay current.

## implementation

- Added `current_version_id` and `version_count` columns to `artifacts` with idempotent column migration.
- Added `artifact_versions` table with immutable version rows, version numbers, parent links, restored-from links, timestamps, byte size, SHA-256, local path, and metadata JSON.
- Changed artifact storage to immutable versioned paths: `artifacts/<artifact-id>/versions/000001/<filename>`.
- Added helpers in `scripts/lib/artifacts.ts`:
  - `updateWorkspaceArtifact`
  - `listWorkspaceArtifactVersions`
  - `getWorkspaceArtifactVersion`
  - `rollbackWorkspaceArtifact`
- Rollback creates a new latest version instead of mutating/deleting prior history.
- Added `scripts/artifacts.ts` CLI:
  - `bun ./scripts/artifacts.ts history --id <artifact-id> [--json]`
  - `bun ./scripts/artifacts.ts get --id <artifact-id> [--version <n>|--version-id <id>|--before <iso>] [--json]`
  - `bun ./scripts/artifacts.ts rollback --id <artifact-id> (--version <n>|--version-id <id>|--before <iso>) [--reason <text>] [--json]`
- Added `bun run artifacts` package script.
- Extended `ArtifactDescriptor` with `currentVersionId` and `versionCount`.

## validation

- `bun --cwd packages/os test tests/artifacts.test.ts` passed: 2 tests.
- Manual CLI smoke passed: create v1, update v2, `artifacts history --json` returns 2 versions, `artifacts rollback --version 1 --json` returns version count 3.
- `bun run --cwd packages/os typecheck` passed: workspace script syntax checks passed.

## files changed

- `packages/os/package.json`
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/tests/artifacts.test.ts`

## notes

This is the simple OS-level safety primitive we were missing. Site/wiki/reader-specific guardrails can use this later, but artifact rollback should not depend on the reader renderer.


- 2026-06-11 02:48:05 write: `.task/os/add-os-artifact-version-rollback-table/workpad.md`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/tests/artifacts.test.ts`

## workspace-owned: activity log

- 2026-06-11 02:48:05 fs.write: `.task/os/add-os-artifact-version-rollback-table/workpad.md`
- 2026-06-11 02:49:02 fs.patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-06-11 02:49:37 fs.patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-06-11 02:49:56 fs.patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-06-11 02:50:44 fs.patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-06-11 02:51:36 fs.patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-06-11 02:52:19 fs.patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-06-11 02:54:26 fs.patch: `packages/os/scripts/lib/artifacts.ts`

## workspace-owned: validation evidence

- 2026-06-11 02:48:34 `review.run`: passed — OK
- 2026-06-11 02:53:12 `review.run`: passed — OK
- 2026-06-11 02:55:32 `review.run`: passed — OK
- 2026-06-11 02:56:46 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/scripts/lib/artifacts.ts`

- 2026-06-11 02:54:26 patch lines 511-524: `packages/os/scripts/lib/artifacts.ts`

## workspace-owned: test selection

- changed files: `.task/os/add-os-artifact-version-rollback-table/current.json`, `.task/os/add-os-artifact-version-rollback-table/evidence-log.json`, `.task/os/add-os-artifact-version-rollback-table/read-log.json`, `.task/os/add-os-artifact-version-rollback-table/session.json`, `.task/os/add-os-artifact-version-rollback-table/workpad.md`, `.task/tasks/os/add-os-artifact-version-rollback-table.json`, `packages/os/package.json`, `packages/os/scripts/artifacts.ts`, `packages/os/scripts/lib/artifacts.ts`, `packages/os/scripts/lib/types.ts`, `packages/os/tests/artifacts.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
