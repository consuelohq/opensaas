# make traces near live

branch: `task/workspace/make-traces-near-live`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1519/make-traces-near-live
github pr: https://github.com/consuelohq/opensaas/pull/1519
started: 2026-07-15

## acceptance criteria

- [x] Poll the SQLite-backed trace cursor once per second while visible and immediately on focus without resetting filters, selection, or scroll anchor.
- [x] Prefetch older cursor pages before the user reaches the bottom, deduplicate stably, and remove the 250-row terminal ceiling.
- [x] Keep inspector/tool-list DOM stable during search and live updates so the rail does not flash, close, or jump to a newly arrived call.
- [x] Format tool input/output as human-readable text without JSON punctuation, redundant wrappers, or raw code where a concise action can be derived.
- [x] Keep a one-second delayed, forgiving, non-flickering tooltip and remove malformed glyphs.
- [x] Detect workpad read/edit/patch calls, label them as workpad activity, and expose a dedicated workpad view at the far right of the inspector toolbar.
- [x] Put branch plus total/input/output/failures/call-time analytics in one compact top row; remove the duplicated branch summary and wasted gaps.
- [x] Make the inspector rail smoothly draggable to full width, toggle full/default width from the toolbar, and persist the chosen width locally.
- [x] Render footer controls as filters left, trace count centered, and scroll-to-top right with equal spacing.
- [x] Emphasize failed row input and output text in the error color while leaving the branch color unchanged.
- [x] Deploy the verified branch-three assets locally for review without merging to main.

## plan

1. Extend the formatter and browser regression tests first and capture the focused red failure.
2. Implement semantic formatting, workpad view, delayed tooltip, stable rail rendering, compact analytics, persistent drag/fullscreen, footer layout, and error emphasis.
3. Extend the SQLite cursor/browser tests first and capture the focused red failure.
4. Implement one-second incremental refresh, focus refresh, early history prefetch, deduplication, anchoring, and unbounded cursor continuation.
5. Run focused green tests, full review/verify, then deploy locally and push only this task branch.

## current status

- Implementation and local deployment are complete. Final verification and branch-only push remain.

## Test-first contract

- Behavior under test: semantic trace text, delayed stable tooltip, workpad view, compact/stable inspector layout, persistent full-width resize, footer placement, error emphasis, and near-live cursor refresh without UI state loss.
- Existing local pattern: `packages/workspace/tests/trace-site-inspector.test.ts` Playwright fixtures plus `packages/os/tests/trace-sites-browser-client.test.ts` and gateway endpoint tests.
- New/changed tests: formatter unit cases, inspector browser interaction cases, virtual-list incremental update cases, browser-client polling/focus cases, and SQLite cursor endpoint cases.
- Focused red commands: `bunx vitest run packages/workspace/tests/trace-site-inspector.test.ts` and `bunx vitest run --root packages/os tests/trace-sites-browser-client.test.ts tests/trace-sites-gateway-live-endpoints.test.ts`.
- Expected red failure: missing workpad-specific label/view, tooltip appears before one second, duplicated analytics/unstable rail, width not persisted/full-width drag capped, footer lacks scroll-top layout, raw punctuation remains, and incremental refresh does not preserve state or remove the terminal ceiling.

## Stabilization follow-up test-first contract

- Behavior under test: one trace-table runtime owns rows after mount; the legacy snapshot renderer is retired; exactly one authoritative startup snapshot replaces the stale archive seed; cursor polling never reloads it; foreign global-map replacement cannot collapse the retained list; raw ISO timestamps render as 24-hour clock text on the first mounted row.
- Existing local pattern: deployment source-contract tests plus the Playwright cursor/pagination fixture in `packages/workspace/tests/trace-site-inspector.test.ts`.
- New/changed tests: retire the legacy `tracefix` script during HTML patching; assert exactly one `/live-traces.json` snapshot request; replace the public global map after pagination and prove the list remains at 326 rows; assert an ISO timestamp is mounted as `HH:mm:ss`.
- Focused red command: `bunx vitest run packages/workspace/tests/trace-site-inspector.test.ts -t "patch versioned|semantic rows|append older history"`.
- Expected red failure: patched HTML still executes `tracefix-v23`; startup requests the full snapshot; the two-second sync accepts an external 250-row map and collapses the 326-row list; the first mounted time cell contains the raw ISO timestamp.

### Test-contract correction

- The initial zero-snapshot assertion was too strict. The committed archive seed is intentionally an offline fallback and may be stale; current rich batch rows come from the live snapshot.
- Correct contract: fetch one authoritative snapshot, replace the fallback seed once, then use only SQLite cursor requests. The bug came from two runtimes repeatedly replacing the map, not from one controlled startup snapshot.

### Stabilization red proof

- Command: `bunx vitest run packages/workspace/tests/trace-site-inspector.test.ts -t "patch versioned|semantic rows|append older history"`.
- Trace: `trc_909dc3e907fe`.
- Expected failures observed: patched HTML retained `tracefix-v23.js`; the first mounted row showed the raw ISO timestamp; startup made one full `/live-traces.json` snapshot request.
- Result: 3 focused failures, 37 tests skipped. Production edits are now unblocked.

### Stabilization green and live verification

- Focused green: `trc_e8f771ec180f` — 3 targeted regression tests passed.
- Full inspector suite: `trc_0ed5b117041d` — 40/40 passed.
- Gateway cursor suite: `trc_786e4c519e2d` — 10/10 passed.
- Typechecks: `consuelo-os` passed in `trc_d9d856aa9b09`; `openworkspace` passed in `trc_39370bd7e2d3`.
- Local deployment: `trc_1cf97d64ecfd` wrote `trace-inspector-v38.js` and `.css` into the Tailscale-served archive and removed the legacy tracefix script from the page HTML.
- Startup browser smoke: `trc_74c82c2752ee` showed one snapshot request, no legacy runtime, v38 loaded, an empty hash, closed detail state, and stable row count/height/scroll position for six seconds.
- History prefetch smoke: `trc_3ff1312cac75` requested exactly one older page at 700px remaining, grew from 258 to 358 traces before the user reached the bottom, preserved `scrollTop`, and did not collapse or force the viewport to the bottom.
- Time-format smoke: `trc_0af77261f302` confirmed all 43 non-empty visible times use `HH:mm:ss`; the page remained closed with no selected trace or hash.
- Screenshot: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/trace-stabilized-v38-2026-07-16T06-08-48.png`.
- Tooling gap: the catalog exposes `office.uiStatus`, but it currently fails because the `office` script is missing. Local trace-inspector deployment therefore used the existing task-scoped deployment script with the explicit local archive path.

## files changed

- `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: `bunx vitest run packages/workspace/tests/trace-site-inspector.test.ts` ran 38 tests with 6 expected contract failures and 32 existing tests green. The failures prove the missing workpad label/view, newer cursor URL/parser/route, delayed non-native tooltip, compact header/sidebar, and browser layout contracts.
- Green: `bunx vitest run packages/workspace/tests/trace-site-inspector.test.ts` passed 38/38 tests, including the delayed tooltip, stable inspector search/live update, full-width persisted drag, compact header, workpad view, footer, cursor retry/poll/focus, and history anchoring contracts.
- Green: `bun test packages/os/tests/trace-sites-gateway-live-endpoints.test.ts` passed 10/10 tests with 41 assertions, including the SQLite newer-cursor no-replay/no-skip contract.
- Green: `yarn nx run consuelo-os:typecheck` and `yarn nx run openworkspace:typecheck` passed.
- Live smoke: the Tailscale Office URL returns 200, starts with the inspector closed, renders live rows with no browser errors, keeps the inspector node stable through search, shows six compact metrics and the three-part footer, opens the tooltip only after one second, and expands the rail to the full 1800px viewport.
- Live cursor smoke: the private newer-cursor route returns 200 with rich SQLite rows and a next cursor.
- 2026-07-16 06:09:34 `review.run`: passed — OK
- 2026-07-16 06:10:09 `verify`: passed — OK

## key decisions

- Keep the existing Astro/vanilla TypeScript inspector; no framework rewrite.
- Keep tooltips, but delay opening for one second and make pointer transitions forgiving.
- Treat DOM labels as presentation aliases only; canonical trace tool names remain unchanged in data.
- Use the existing gateway/read-layer architecture and SQLite source rather than introducing DuckDB or another persistence layer.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The connected `workspace.call` transport disappeared from the active tool surface and failed two retries. Continued through the repo's own workspace scripts and task worktree as the narrow documented fallback.
- Branch three was initially rooted on an older workspace stream. After the inherited test exposed the missing trusted history route, the full approved branch-two trace stack was merged into branch three; the two unrelated Office conflicts were resolved in favor of branch two. The inherited suite then passed 34/34 before new red tests were added.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## workspace-owned: test selection

- changed files: `.task/workspace/make-traces-near-live/evidence-log.json`, `.task/workspace/make-traces-near-live/read-log.json`, `.task/workspace/make-traces-near-live/workpad.md`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: `trace-site-pagination`
- selected suites: `trace gateway history endpoints`, `trace gateway DB resolution`, `trace site inspector pagination`
- run results: `trace gateway history endpoints` passed, `trace gateway DB resolution` passed, `trace site inspector pagination` passed
- failed suites: none
