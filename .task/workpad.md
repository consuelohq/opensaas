# fix research ingest extracted text selection

branch: `task/workspace-agents/fix-research-ingest-extracted-text-selection`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/388
started: 2026-05-13

## acceptance criteria

- [x] Diagnose why a GitHub ingest wrote `readability` to `extracted.md` despite valid extracted content in raw summarize JSON.
- [x] Update `research-ingest.js` so extract-mode runs prefer `extracted.content` and related source-content fields before generic config fields.
- [x] Prevent recursive fallback from choosing known summarize configuration strings such as `readability`.
- [x] Add a focused regression test for the exact JSON shape that failed.
- [x] Validate syntax and the regression test.

## plan

1. Read repo standards and the current research ingest implementation.
2. Replace generic recursive text selection with ordered source-aware text selection.
3. Add a Vitest regression that runs the CLI with a fake summarize binary returning `input.markdown = readability` and `extracted.content = <real text>`.
4. Run syntax checks, focused test, audit/review/verify gates.
5. Push and promote to the stream review PR.

## files changed

- `packages/workspace/scripts/research-ingest.js`
- `packages/workspace/tests/research-ingest.test.js`

## key decisions

- Extract-mode output now checks `extracted.content`, `extracted.text`, `extracted.markdown`, `extractedContent`, `content`, `text`, and `transcript` before any recursive fallback.
- Summary-mode output keeps summary-like fields first, then falls back to extracted fields.
- Recursive fallback skips metadata/config branches: `input`, `env`, `metrics`, `diagnostics`, and `prompt`.
- Tiny known config values such as `readability`, `auto`, `md`, `xl`, and `xxl` are rejected as extracted text candidates.
- No docs update is required because command usage and output contract are unchanged; this is a parser correctness fix.

## validation

- `checkFiles` for `packages/workspace/scripts/research-ingest.js` and `packages/workspace/tests/research-ingest.test.js` passed after the parser patch.
- `cd packages/workspace && bun run test tests/research-ingest.test.js` passed: 1 test.
- `checkFiles` passed again after the final spacing patch.
- `cd packages/workspace && bun run test tests/research-ingest.test.js` passed again: 1 test.
- `workspace audit { scripts: true }` passed: 48 documented scripts, 48 actual scripts, no drift.
- `workspace review.run { base: "origin/main", noTests: true }` passed; no findings.
- `workspace verify { base: "origin/main", noDb: true }` passed.
- Diff inspected for `packages/workspace/scripts/research-ingest.js` and new `packages/workspace/tests/research-ingest.test.js`.

## notes for ko

- The original ingest fetched usable content. The wrapper selected `input.markdown: readability` before `extracted.content` because the old recursive search was key-name based and traversal-order dependent.

## improvements noticed

- `findText()` was too generic for structured summarize JSON. Ordered field selection is safer than recursive search as the primary path.

## errors i ran into

- First `task.pin` call failed because it passed both `taskSession` and `input.branch`; retried with only `taskSession` and it passed.
- One attempted inline multiline `fs.patch` for whitespace was rejected by the safety guard. No file was changed by that failed call.
- First workpad write omitted `force: true`; retried with `force: true` and it passed.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): select extracted content in research ingest" --changed
bun run task:pr
```

- 2026-05-13 05:44:40 write: `.task/workpad.md`