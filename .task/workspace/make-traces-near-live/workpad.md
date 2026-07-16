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

## files changed

- `packages/workspace/scripts/trace-site-inspector/{archive-history,browser,deploy,inspector-state,pagination-browser,table-formatters,virtual-list-browser}.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/tests/trace-site-inspector.test.ts`
- `packages/os/scripts/lib/trace-sites-{gateway-live-endpoints,gateway-read-layer,local-read-backend}.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

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
