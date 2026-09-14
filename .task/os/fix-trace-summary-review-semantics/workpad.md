# fix trace summary review semantics

branch: `task/os/fix-trace-summary-review-semantics`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2457/fix-trace-summary-review-semantics
github pr: https://github.com/consuelohq/opensaas/pull/2457
started: 2026-09-11

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-11 04:53:57 fs.write: `.task/os/fix-trace-summary-review-semantics/workpad.md`
- 2026-09-11 04:55:06 fs.write: `.task/os/fix-trace-summary-review-semantics/workpad.md`
- 2026-09-11 04:56:16 fs.write: `.task/os/fix-trace-summary-review-semantics/workpad.md`

## workspace-owned: validation evidence

- 2026-09-11 04:55:38 `review.run`: passed — OK
- 2026-09-11 04:55:57 `review.run`: passed — OK
- 2026-09-11 04:56:12 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## 2026-09-11 — review follow-up

### Test-first contract
- Behavior under test: semantic trace summaries must preserve actual write operations even when a `code.call` is declared `mode: read`, must classify `rg`/`grep` shell calls as searches rather than reads, and the new regression tests should follow repository test naming guidance.
- Existing local pattern: `packages/os/tests/trace-site-inspector-os-owned.test.ts` directly exercises `formatTraceTableRow` and already covers indirect Bun/Python/Bash target extraction.
- New tests first: add a non-edit `Bun.write(...)` case expecting `write <file>` and `rg TODO <file>` / `grep TODO <file>` cases expecting search semantics; rename only the three newly added test names to `should ... when ...`.
- Focused red command: `cd packages/os && bunx vitest run tests/trace-site-inspector-os-owned.test.ts`.
- Expected red: current formatter labels read-mode `Bun.write` as `read settings.json` and `rg`/`grep` with file targets as file reads.
- No-test waiver: none.

### Review findings being addressed
- CodeRabbit current stream review: preserve write semantics for write APIs detected inside code calls.
- CodeRabbit current stream review: classify `rg` and `grep` before reader-program file handling.
- CodeRabbit current stream review: rename the three new tests to the required `should [behavior] when [condition]` form.

- 2026-09-11 04:53:57 append: `.task/os/fix-trace-summary-review-semantics/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`

- 2026-09-11 04:54:22 apply-patch: `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- 2026-09-11 04:54:46 apply-patch: `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
### Validation update
- RED: focused formatter suite -> 18 passed / 1 failed; `Bun.write('/tmp/settings.json', ...)` in read mode was incorrectly summarized as `read settings.json`.
- GREEN: focused formatter suite -> 19/19 passed after preserving detected write semantics and classifying raw `rg`/`grep` shell calls as searches before file-read handling.
- GREEN: tracing/runtime regression set -> 8 files, 72/72 tests passed.
- GREEN: rebuilt `assets/vendor/observability-traces-v38/inspector.js` successfully (112.73 KB).
- Test names for the three new semantic-summary regressions now follow `should [behavior] when [condition]`.

### Current status
- Review findings fixed locally; ready for diff inspection, workspace review, verify, push, and promotion to `stream/os`.

- 2026-09-11 04:55:06 append: `.task/os/fix-trace-summary-review-semantics/workpad.md`

- 2026-09-11 04:55:44 apply-patch: `packages/os/tests/trace-site-inspector-os-owned.test.ts`

### Publish gate
- `review.run --base origin/stream/os`: 0 issues, 0 blocking.
- `verify --base origin/stream/os`: passed, publishValid=true, no DB risks.
- Ready to push and merge PR #2457 into `stream/os`.

- 2026-09-11 04:56:16 append: `.task/os/fix-trace-summary-review-semantics/workpad.md`
