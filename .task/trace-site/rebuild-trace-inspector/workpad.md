# Rebuild trace inspector

branch: `task/trace-site/rebuild-trace-inspector`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1496/rebuild-trace-inspector
github pr: https://github.com/consuelohq/opensaas/pull/1496
started: 2026-07-14

## acceptance criteria

- [x] Keep an open selection stable when live rows replace the visible feed.
- [x] Centralize inspector selection, layout, display mode, call search, and width state.
- [x] Replace section tabs with stacked typed Input, Output, Error, and Metadata.
- [x] Add one Formatted / JSON display switch.
- [x] Add normalized branch context, metrics, and a searchable tool-call rail.
- [x] Add rail collapse, inspector fullscreen, close, drag resize, and divider-click collapse.
- [x] Prevent formatted payload and document-level horizontal overflow.
- [x] Preserve reduced-motion behavior and keep Branch 2/3 scope deferred.

## plan

1. [x] Inspect the existing overlay, virtual list, deploy patch, and tests.
2. [x] Add failing state and browser interaction contracts.
3. [x] Implement the centralized inspector store and rebuilt interior UI.
4. [x] Format, bundle, run the full focused suite, and inspect a real bundled screenshot.
5. [ ] Run workspace review and verification, then publish the task branch.

## current status

- Branch 1 implementation is complete and locally green; workspace review and verification remain before publish.

## files changed

- packages/workspace/scripts/trace-site-inspector/inspector-state.ts
- packages/workspace/scripts/trace-site-inspector/browser.ts
- packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts
- packages/workspace/scripts/trace-site-inspector/inspector.css
- packages/workspace/scripts/trace-site-inspector/deploy.ts
- packages/workspace/tests/trace-site-inspector.test.ts

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-14 23:10:24 `review.run`: passed — OK
- 2026-07-14 23:12:18 `verify`: passed — OK

## key decisions

- Keep one in-memory store as the sole inspector state owner; incoming rows update its feed without clearing the selected snapshot.
- Render branch metrics and the call rail beside the preview, while payload sections remain vertically stacked and independently scannable.
- Keep tool/table formatting and filter redesign out of this branch so the approved sequencing remains intact.

## notes for ko

- Bundled visual inspection shows a 680px inspector, a 451px payload column with equal scroll/client width, and zero document horizontal overflow.
- Branch 2 remains the formatter/filter/font/error/batch-child pass; Branch 3 remains near-live cursor/prefetch work.

## improvements noticed

- none yet

## issues and recovery

- The first browser search assertion omitted an older paginated fs.read match; the contract now asserts both matching rows while proving selection stability.
- Unsupported Playwright DOM matchers in Vitest were replaced with browser-native wait conditions.

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site): description" --changed
bun run task:pr
bun run task:finish
```

## Approved branch-one contract

- Rebuild only the interior trace inspector on the trace-site stream.
- Preserve an open selection while live rows arrive; refreshes must never dismiss the inspector.
- Replace per-section tabs with stacked typed Input, Output, Error, and Metadata sections plus one Formatted / JSON mode.
- Keep branch metrics and a normalized stream/task breadcrumb.
- Add a searchable call rail with status, tool, and time.
- Support drag resize, divider-click collapse, collapse/full-screen/close controls, accessible motion, and no horizontal scrolling in formatted content.
- Defer main-table formatters, filters, font/theme changes, batch-child formatting, and live pagination/cursor work.

## Test-first contract

1. A selected trace remains selected when incoming live rows replace the visible list.
2. The inspector exposes one owner for selection and layout state.
3. Formatted view renders stacked typed sections; JSON is a single alternate mode.
4. Resize/collapse/full-screen transitions preserve the selected trace.
5. The call rail can be searched without altering the selected trace.

## Discovery

- Active source stream: stream/trace-site.
- First implementation action is intentionally blocked until the focused selection-refresh contract fails.

### Focused red proof

- Command: `bun run --cwd packages/workspace test -- tests/trace-site-inspector.test.ts`
- Expected failure observed: Vitest cannot resolve the new `inspector-state` module required by the branch-one behavior contract.
- Trace: `trc_200c75fbdb94`
- Production implementation is now unblocked.

## Local validation

- Red proof: missing inspector-state module, trace trc_200c75fbdb94.
- Green focused suite: 25/25 tests, trace trc_281754c2daf6.
- Prettier and browser bundle: clean, trace trc_5245dc9e4cb0.
- Bundled Playwright visual/no-overflow inspection: trace trc_8c06e6d9efea.

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/rebuild-trace-inspector.json`, `.task/trace-site/rebuild-trace-inspector/current.json`, `.task/trace-site/rebuild-trace-inspector/session.json`, `.task/trace-site/rebuild-trace-inspector/workpad.md`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/inspector-state.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: `trace-site-pagination`
- selected suites: `trace gateway history endpoints`, `trace gateway DB resolution`, `trace site inspector pagination`
- run results: `trace gateway history endpoints` passed, `trace gateway DB resolution` passed, `trace site inspector pagination` passed
- failed suites: none
