# fix review client newline escaping

## problem

After fixing PR data boot order, the live PR page still froze on `Loading...` because the generated inline browser module had invalid JavaScript syntax. Newline literals inside the TypeScript template were emitted as actual newlines inside quoted browser JavaScript strings.

Observed failure from deployed HTML script extraction:

```text
SyntaxError: Invalid or unexpected token
return lines.join('
```

## fix

- Double-escaped newline literals inside the generated review client script.
- Preserved the previous boot-order fix: `loadLiveData();` still runs before `loadViewerLibraries();`.
- Added a regression assertion that extracts the inline module script from `renderReviewPage()` and verifies it can be parsed with `new Function(...)`.

## validation

- `bun run --cwd packages/diff-cockpit test` passes: 13 pass, 0 fail, 65 expectations.
- `bun run --cwd packages/diff-cockpit typecheck` passes.
- Manual syntax extraction with `node --check` passed before the test was added.

## follow-up

Deploy after promotion and verify `https://diffs.consuelohq.com/consuelohq/opensaas/pull/722` populates files instead of staying on `Loading...`.

- 2026-06-03 06:56:37 write: `.task/diff-cockpit/fix-review-client-newline-escaping/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-03 06:56:37 fs.write: `.task/diff-cockpit/fix-review-client-newline-escaping/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 06:57:11 `review.run`: passed — OK
- 2026-06-03 06:57:25 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/fix-review-client-newline-escaping/current.json`, `.task/diff-cockpit/fix-review-client-newline-escaping/evidence-log.json`, `.task/diff-cockpit/fix-review-client-newline-escaping/read-log.json`, `.task/diff-cockpit/fix-review-client-newline-escaping/session.json`, `.task/diff-cockpit/fix-review-client-newline-escaping/workpad.md`, `.task/tasks/diff-cockpit/fix-review-client-newline-escaping.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
