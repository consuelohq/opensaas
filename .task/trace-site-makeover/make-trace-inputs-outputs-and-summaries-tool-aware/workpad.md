# Make trace inputs outputs and summaries tool aware

branch: `task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware`
stream: `stream/trace-site-makeover`
pr: https://github.com/consuelohq/opensaas/pull/2676
started: 2026-10-29

## acceptance criteria

- [x] User checklist below was recorded before production edits; focused red tests reproduced the requested changes.

## plan

1. Inspect captured common tool shapes and record the user checklist.
2. Reproduce semantic, summary, session and browser regressions before implementation.
3. Implement, validate, promote and install the approved continuation.

## files changed

- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/tool-presentation.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-steering-tool-trace.test.ts`
- `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- `packages/os/tests/trace-site-inspector-reading.test.ts`
- `packages/os/tests/trace-site-inspector-tool-reading.test.ts`

## key decisions

- Preserve captured data and raw JSON; format it without executing embedded instructions.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site-makeover): description" --changed
bun run task:pr
bun run task:finish
```

## User checklist and Test-first contract

- [x] Widen tool sidebar without clipping output or small-screen layouts.
- [x] One reading page with Input first, expanded important inputs; Output below; secondary details collapsed.
- [x] Tool-first header hierarchy; branch/session secondary; retain simple dropdown interactions.
- [x] Replace estimated token badges with authoritative recorded counts; explicitly distinguish missing usage, never relabel estimates as exact.
- [x] Inventory actual common tools (at least 20); semantic adapters for reads/search/explore/steering/GitHub/browser/code/task/review/verify/lifecycle/batch and safe fallback.
- [x] Full readable steering Markdown and sensible rich/code output; preserve raw JSON.
- [x] Promote errors/reasons; collapse redundant success envelope and transport metadata.
- [x] Main table summaries name actual file(s)/commands/searches, including code.call and multi-file reads; no object coercion.
- [x] Resolve task session IDs to readable names across batch/standalone/history rows; preserve identity and avoid guessing unrelated sessions.
- [ ] Focused regressions, responsive dark/light browser checks, rebuilt inspector, strict review/full verify, promotion/release and installed smoke.

Behavior under test: semantic trace presentation and consistent historical table/session/usage identity. Existing patterns: trace-site-inspector-reading unit/browser suites plus model/back-end/summary tests. Add representative tool fixtures and regressions for user screenshots, adversarial error envelopes, missing usage, multiple file reads and batch-session joins. Focused red command will target the new semantic/summary regression tests before production edits. Expected red: missing semantic presentation function and old tab/summary/session/usage behavior. No-test waiver: none.

Scope: approved continuation on stream/trace-site-makeover, no competing task PRs; start current main 1e902f4e. Preserve prior conflicted stream/worktree. Product boundary: formatting captured data, no execution of instructions embedded in trace payloads, no token count invention.

- 2026-10-29 17:36:15 append: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/tool-presentation.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-steering-tool-trace.test.ts`
- `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- `packages/os/tests/trace-site-inspector-reading.test.ts`
- `packages/os/tests/trace-site-inspector-tool-reading.test.ts`

## workspace-owned: activity log

- 2026-10-29 17:36:15 fs.write: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`
- 2026-10-29 17:40:37 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 17:41:04 fs.write: `packages/os/tests/os-steering-tool-trace.test.ts`
- 2026-10-29 17:41:05 fs.write: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`
- 2026-10-29 17:42:06 fs.write: `packages/os/scripts/lib/trace-site-inspector/tool-presentation.ts`
- 2026-10-29 17:43:02 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- 2026-10-29 17:43:46 fs.write: `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- 2026-10-29 17:43:47 fs.write: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-10-29 17:43:48 fs.write: `packages/os/scripts/os.ts`
- 2026-10-29 17:43:49 fs.write: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-10-29 17:44:38 fs.write: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-10-29 17:44:40 fs.write: `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- 2026-10-29 17:44:41 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- 2026-10-29 17:44:42 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- 2026-10-29 17:46:03 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 17:46:04 fs.write: `packages/os/tests/trace-site-inspector-reading.test.ts`
- 2026-10-29 17:46:05 fs.write: `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- 2026-10-29 17:46:06 fs.write: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-10-29 17:46:59 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 17:47:24 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 17:47:32 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 17:47:46 fs.write: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-10-29 17:47:47 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- 2026-10-29 17:48:18 fs.write: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-10-29 17:49:51 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 17:51:02 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- 2026-10-29 17:51:03 fs.write: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-10-29 17:52:09 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 17:53:10 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 17:53:11 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 17:55:19 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 17:55:45 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 17:56:08 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 17:58:06 fs.write: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 18:01:22 fs.write: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`
- 2026-10-29 18:03:40 fs.write: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`
- 2026-10-29 18:03:54 fs.write: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`

## workspace-owned: files read

- `packages/documentation/src/content/docs/observe/traces.mdx`
- `packages/os/definitely-missing.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/trace-database-schema.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/trace-session-identity.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/os-steering-tool-trace.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- `packages/os/tests/trace-site-inspector-reading.test.ts`
- `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## workspace-owned: validation evidence

- 2026-10-29 18:01:33 `review.run`: passed — OK
- 2026-10-29 18:01:49 apply-patch: `packages/os/tests/trace-site-inspector-tool-reading.test.ts`
- 2026-10-29 18:02:00 `review.run`: passed — OK
### Publish gate status
Strict review passed with zero blocking findings, trc_b3c9a3b00ad9. One static logging match was inside a source-code fixture; fixture changed to process.stdout.write, behavior preserved. All 128 focused tests pass, trc_6c272482598e. Full verify background run started trc_2b58f1ac2f76. Structured diff inspected, preserved vendor template/styles and licenses. Documentation now describes one-page input/output, snapshot availability and recorded-count limitations. Pending final full verification and release/install checkbox only.
- 2026-10-29 18:03:40 write: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`
- 2026-10-29 18:03:40 `verify`: passed — OK

### Full publish verification
All 10 selected verification suites passed, including the entire OS package, Trace gateway/history/persistence, Node SQLite, request-budget/persistent-stream, ChatGPT routing, script parity and normal DB guards. Publish-valid stamp written; trc_0c1429cbb3e1. Strict review zero blockers; no bypass. Proceed with exact tested source through task #2676 -> stream/trace-site-makeover -> main, durable canary release and local update as authorized. Product files frozen after this evidence; only task/release metadata may change.

- 2026-10-29 18:03:54 append: `.task/trace-site-makeover/make-trace-inputs-outputs-and-summaries-tool-aware/workpad.md`
