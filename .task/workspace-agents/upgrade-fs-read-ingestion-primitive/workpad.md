# upgrade fs read ingestion primitive

branch: `task/workspace-agents/upgrade-fs-read-ingestion-primitive`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1065/upgrade-fs-read-ingestion-primitive
github pr: https://github.com/consuelohq/opensaas/pull/1065
started: 2026-06-15

## acceptance criteria

- [x] `fs.read` returns bounded structured JSON for typed/facade and `--json` callers.
- [x] Text reads return a `text-page` result with path, MIME, UTF-8 encoding, offset, limit, content, truncation state, and `next` when more content remains.
- [x] `from` / `to` remain accepted CLI/facade aliases, while `offset` / `limit` are the preferred page semantics.
- [x] Reads are bounded by hard caps for lines, bytes, and line length.
- [x] Large text reads do not load the whole file just to serve a small page.
- [x] Binary, PDF, invalid UTF-8, directory, missing path, permission, and path traversal failures are returned as stable structured result/error objects.
- [x] PNG/JPEG/GIF/WebP files are detected by magic bytes and returned as bounded media descriptors with base64 content when under the media cap.
- [x] Multi-file reads preserve partial success and per-file errors.
- [x] Pretty output stays isolated to non-json human CLI mode; typed JSON has no ANSI/grid decoration.
- [x] Manifest, generated docs, generated types, and SCRIPTS guidance describe `fs.read` as bounded ingestion.
- [x] `fs.search`, `fs.list`, `fs.write`, `fs.apply_patch`, `fs.trash`, and HTTP are not migrated or redesigned.

## Effect scope decision

`packages/workspace` does not currently depend on `effect`, and the active filesystem script is a CommonJS/Bun `.js` CLI. Adding Effect here would introduce package dependency churn and a TS/runtime migration for one script. This task implements the same product contract with focused plain JavaScript modules and records Effect as deferred for this package. The implementation remains Effect-shaped at the boundary: explicit contracts, typed-ish result objects, typed error codes, resource-safe streaming, bounded reads, and composable read helpers.

## Test-first contract

Behavior under test:
- CLI `read --json` returns a single structured `text-page` for a small UTF-8 file.
- Large text reads return only the requested page, include `truncated: true` and `next`, and do not expose full-file arrays.
- Offset out of range returns a stable per-file error with the requested offset in the message.
- Limit above the hard cap is capped explicitly in the result.
- Long lines are truncated with a visible suffix.
- Null-byte files, PDF magic headers, and invalid UTF-8 are rejected as structured binary/invalid-text errors rather than dumped as text.
- PNG/JPEG/GIF/WebP magic bytes return `media` objects under the media cap.
- Directory paths return a stable directory-not-readable error.
- Path traversal and symlink escape are rejected relative to the current working root.
- Multi-file reads return `results` with partial failure isolation.
- Human pretty mode may still render line-numbered text, but `--json` output contains no ANSI/grid decoration.
- Facade transport maps top-level `offset`/`limit` and per-file `files[]` page flags to the CLI.

Existing local pattern followed:
- Workspace filesystem behavior is covered with Vitest subprocess tests, as in `packages/workspace/tests/fs-apply-patch.test.ts`.
- The facade schema, manifest, generated docs, and generated types are sourced from `packages/workspace/scripts/lib/facade/schemas.ts` and `packages/workspace/tooling/tool-manifest.json`.

New or changed tests:
- Added `packages/workspace/tests/fs-read.test.ts` as the public behavior specification for `packages/workspace/scripts/fs.js read --json`.
- Updated `packages/workspace/tests/facade/facade.test.ts` with `offset`/`limit` and `files[]` CLI transport coverage.

## implemented

- Added `packages/workspace/scripts/lib/fs/read.js` as the dedicated read implementation module.
- Replaced only the `fs.read` command branch in `packages/workspace/scripts/fs.js` with the new bounded read service.
- Added `text-page`, `media`, `binary`, and structured `error` JSON shapes.
- Added read caps: `MAX_READ_LINES = 2000`, `MAX_READ_BYTES = 64 * 1024`, `MAX_LINE_CHARS = 2000`, `MAX_MEDIA_INGEST_BYTES = 20 * 1024 * 1024`.
- Added chunked file reads via `fs.openSync` / `fs.readSync` with `finally` close.
- Added strict UTF-8 decoding with fatal `TextDecoder`.
- Added binary detection by extension, null bytes, PDF magic, non-printable ratio, and invalid UTF-8.
- Added PNG/JPEG/GIF/WebP media magic detection and base64 media output under the media cap.
- Added root containment and symlink escape checks.
- Added directory-not-readable and offset-out-of-range typed errors.
- Added multi-file partial success output.
- Updated facade schemas, manifest, generated workspace types, generated TOOLS docs, and SCRIPTS guidance.

## validation

Passed:
- `bun x vitest run packages/workspace/tests/fs-read.test.ts` — 11 tests passed.
- `bun x vitest run packages/workspace/tests/facade/facade.test.ts` — 563 tests passed.
- `bun run generate-types` — passed.
- `bun run generate-docs` — passed.
- `checkFiles` on changed JS/TS/test/JSON/generated files — passed.
- `review.run --mine --no-tests` — passed with 0 issues in this task's changes; only pre-existing findings outside the diff were reported.
- `verify` — passed, publish-valid stamp written; selected facade input contract and audit docs suites passed.
- Manual CLI JSON smoke: `read sample.txt --offset 2 --limit 1 --json` returned `text-page` with `truncated: true` and `next: 3`.

Expected/intentional notes:
- Initial `checkFiles` run included Markdown docs and failed because the checker invokes `node --check` on `.md`; rerun on code/generated files passed.
- Stale scan still finds `fs.search --then-read` using full-file `readFileSync`; this was intentionally not rewritten because `fs.search` migration is out of scope. Future work should make search then-read call the new read service.
- No `packages/workspace/tests/*manifest*` file exists in this repo snapshot.

## current status

- Implementation and focused tests are complete.
- Review and verify passed. Push/promote remain.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/scripts/lib/fs/read.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-read.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## notes for Ko

- ELI5: `fs.read` now stops dumping a whole book and hands agents one safe labeled page at a time.

## improvements noticed

- `FsReadOutput` is still represented as a generated type signature string, not a runtime output validator.
- `fs.search --then-read` still has its own old full-file range implementation and should be a follow-up integration point.

## issues and recovery

- Facade transport tests initially failed with `TASK_SESSION_REQUIRED`; fixed by using real task-session fixtures, matching existing facade test conventions.
- `checkFiles` failed on Markdown because it ran `node --check` against `.md`; reran on code/generated files only.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): bound fs read ingestion" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-15 07:07:57 write: `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/workpad.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/scripts/lib/fs/read.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-read.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-06-15 07:07:57 fs.write: `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/workpad.md`

## workspace-owned: validation evidence

- 2026-06-15 07:09:21 `review.run`: passed — OK
- 2026-06-15 07:09:22 `review.run`: passed — OK
- 2026-06-15 07:10:35 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/upgrade-fs-read-ingestion-primitive.json`, `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/current.json`, `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/evidence-log.json`, `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/read-log.json`, `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/session.json`, `.task/workspace-agents/upgrade-fs-read-ingestion-primitive/workpad.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/facade/types.ts`, `packages/workspace/scripts/lib/fs/read.js`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-read.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
