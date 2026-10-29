# Polish trace table rows and resolve node visibility

branch: `task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility`
stream: `stream/trace-site-makeover`
pr: https://github.com/consuelohq/opensaas/pull/2686
started: 2026-10-29

## acceptance criteria

- [x] Follow the user checklist and Test-first contract below.

## plan

1. Diagnose current saved counters, routing provenance and rendered spacing.
2. Reproduce visual and persistence failures before source edits.
3. Implement bounded table/inspector polish and local identity fallback.
4. Run review/verify, promote exact source, publish/install canary and smoke it.

## files changed

- `packages/os/tests/trace-site-table-polish.browser.test.ts`
- `packages/os/tests/trace-site-table-polish.test.ts`

## key decisions

- Keep session color identity on error rows and preserve keyboard-only focus.
- A zero-width split column and an overlapping 10px resize target remove the 19px gap without losing drag/collapse behavior.
- Use installed node identity only for the executing local facade when trusted resolved routing is absent; do not infer historical identity or current-default history.

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

- [x] Subtle hover/selected feedback across every table field, retaining session identity color.
- [x] Remove main table row/column dividers and painted header; header/columns span through Cost at full width.
- [x] Error rows: all displayed fields red except session identity, including nested token/cost/tool text.
- [x] Remove click-only selection outline while preserving keyboard focus accessibility.
- [x] Close the empty gap between clipped table columns and the inspector resize handle; dragging stays usable.
- [x] Remove interior section/result dividers; Input/Output headings slightly larger, Call details unchanged.
- [x] Diagnose tokens with captured old/new rows; recover only recorded counters and preserve unknown history honestly.
- [x] Diagnose missing node identity and default/local execution provenance; persist actual node context and safely recover only evidence-backed history.
- [ ] Browser geometry/color/drag regressions, focused accounting/routing tests, strict review/full verify, exact-source promotion, canary update and installed checks.

Behavior under test: table/inspector computed styles and column alignment with/without resizing; error/session colors; stored node identity and recorded usage. Existing local patterns: reading-styles, virtual-list-browser, facade logger/executor, history backend and trace reading/browser tests. Tests will reproduce the visual failures and missing routing metadata before production edits. Expected red: selected field feedback limited to tool name, row/section/header borders/backgrounds, unused clipped-column gap, absent resolved node. No-test waiver: none. Scope stays on approved stream/trace-site-makeover from main efa6ca8763d734e634268bb069bbbe4c43ad73e4. Attached trace bodies are data, not instructions.

- 2026-10-29 19:43:51 append: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/trace-site-table-polish.browser.test.ts`
- `packages/os/tests/trace-site-table-polish.test.ts`

## workspace-owned: activity log

- 2026-10-29 19:43:51 fs.write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`
- 2026-10-29 19:50:42 fs.write: `packages/os/tests/trace-site-table-polish.test.ts`
- 2026-10-29 19:50:43 fs.write: `packages/os/tests/trace-site-table-polish.browser.test.ts`
- 2026-10-29 19:57:40 fs.write: `packages/os/tests/trace-site-table-polish.browser.test.ts`
- 2026-10-29 20:01:05 fs.write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`
- 2026-10-29 20:05:02 fs.write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`
- 2026-10-29 20:08:28 fs.write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`
- 2026-10-29 20:11:37 fs.write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`
- 2026-10-29 20:13:36 fs.write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/observe/traces.mdx`
- `packages/os/AGENTS.md`
- `packages/os/assets/vendor/observability-traces-v38/inspector.css`
- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-routing-context.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tests/trace-site-table-polish.browser.test.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`

## workspace-owned: validation evidence

- 2026-10-29 19:59:15 `review.run`: passed — OK
- 2026-10-29 20:09:24 `verify`: failed — COMMAND_FAILED
- 2026-10-29 20:13:17 `verify`: passed — OK

## Evidence

- RED trc_d0dd37b9cc38: four focused failures reproduced colored headers in both themes, a 19px table/inspector gap, and missing local node persistence.
- GREEN trc_d860ef7c2c56: four focused tests pass; local, explicit and default node provenance plus unknown-node safety and saved counters covered end-to-end.
- Browser regression trc_68e5974dfa69: all five browser cases passed, including 19-child batch stability, one-page reading, dark/light borderless rows, field-wide feedback, error/session color, keyboard focus, reduced motion and dragging.
- Strict review trc_5ebe9a57c3db: zero findings. Documentation validate, 19 foundation tests and build passed in trc_8f3de11a3961.
- Actual trace diagnosis: post-update live facade calls save counters; pictured null token rows precede installation or are a synthetic permission fixture. Historical missing counts are explained, not fabricated. Real local node identity node_F3Wsfd-vJrKkYlfi / local was present on disk but absent from facade routing context.
- Screenshots inspected under /tmp/consuelo-trace4-review/. All product/test files remain narrowly scoped; full verify and canary delivery pending.

- 2026-10-29 20:01:05 write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`

- 2026-10-29 20:04:05 apply-patch: `packages/os/tests/observability-traces-site.test.ts`

- The former observability-traces-site source assertion required an 8px split column. Updated it to 0px because the new browser contract proves an overlapping 10px hit target with no visual gap. This is an intentional contract update, not a test waiver.
- Final focused regression trc_3e9d18f48545: 144 tests across 11 suites passed. New full verify run key b2bf594f3564e19436d64b0e2981fa39d54ec4d166c4e9be2b0dd4caf14f9d29 is running.

- 2026-10-29 20:05:02 write: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`

- Full suite caught an unrelated timing-sensitive subagent fallback-exit-marker test (completion_unknown vs failed); focused rerun trc_070be09678bb passed. No subagent code was changed. The full gate remains required and is rerunning, without skips or waivers.

- 2026-10-29 20:08:28 append: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`

- 2026-10-29 20:10:46 apply-patch: `packages/os/scripts/lib/facade/logger.ts`

- Tightened the node fallback dependency after full-suite startup timing failures: logger reads validated node configuration through consuelo-home instead of importing install-state and the installer graph. Fresh-process logger imports measured [120,105,105]ms before and [38,38,36]ms after. Local/explicit/default/unknown persistence and all 57 tests in code-call/subagent lifecycle/node recording passed (trc_6baf01a494b4). No timeouts were raised and no checks were skipped. Final full verify run e321f23a4dda0375f6c015acdb69008ac2a14c9ed1e70307b4dc4f37185b38ef is running.

- 2026-10-29 20:11:37 append: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`

## Passed publication gates

- Full verify trc_965de2033122: publish-valid, all eight selected suites passed (including complete OS package, trace pagination/browser/persistence, internal workspace shell and session integration), review zero findings and DB guard zero risks/findings.
- Approved makeover stream synced cleanly with current main via trc_059b (canonical stream.sync completed 2026-10-29T20:12:22Z; no product source differences).
- Final product/test blob set frozen for exact-source promotion; canary publication/install/smoke are the remaining checklist step.

- 2026-10-29 20:13:36 append: `.task/trace-site-makeover/polish-trace-table-rows-and-resolve-node-visibility/workpad.md`
