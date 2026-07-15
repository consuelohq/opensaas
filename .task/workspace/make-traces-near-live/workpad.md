# make traces near live

branch: `task/workspace/make-traces-near-live`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1519/make-traces-near-live
github pr: https://github.com/consuelohq/opensaas/pull/1519
started: 2026-07-15

## acceptance criteria

- [ ] Poll the SQLite-backed trace cursor once per second while visible and immediately on focus without resetting filters, selection, or scroll anchor.
- [ ] Prefetch older cursor pages before the user reaches the bottom, deduplicate stably, and remove the 250-row terminal ceiling.
- [ ] Keep inspector/tool-list DOM stable during search and live updates so the rail does not flash, close, or jump to a newly arrived call.
- [ ] Format tool input/output as human-readable text without JSON punctuation, redundant wrappers, or raw code where a concise action can be derived.
- [ ] Keep a one-second delayed, forgiving, non-flickering tooltip and remove malformed glyphs.
- [ ] Detect workpad read/edit/patch calls, label them as workpad activity, and expose a dedicated workpad view at the far right of the inspector toolbar.
- [ ] Put branch plus total/input/output/failures/call-time analytics in one compact top row; remove the duplicated branch summary and wasted gaps.
- [ ] Make the inspector rail smoothly draggable to full width, toggle full/default width from the toolbar, and persist the chosen width locally.
- [ ] Render footer controls as filters left, trace count centered, and scroll-to-top right with equal spacing.
- [ ] Emphasize failed row input and output text in the error color while leaving the branch color unchanged.
- [ ] Deploy the verified branch-three assets locally for review without merging to main.

## plan

1. Extend the formatter and browser regression tests first and capture the focused red failure.
2. Implement semantic formatting, workpad view, delayed tooltip, stable rail rendering, compact analytics, persistent drag/fullscreen, footer layout, and error emphasis.
3. Extend the SQLite cursor/browser tests first and capture the focused red failure.
4. Implement one-second incremental refresh, focus refresh, early history prefetch, deduplication, anchoring, and unbounded cursor continuation.
5. Run focused green tests, full review/verify, then deploy locally and push only this task branch.

## current status

- Discovery complete enough to define browser and gateway contracts. Writing red tests before production edits.

## Test-first contract

- Behavior under test: semantic trace text, delayed stable tooltip, workpad view, compact/stable inspector layout, persistent full-width resize, footer placement, error emphasis, and near-live cursor refresh without UI state loss.
- Existing local pattern: `packages/workspace/tests/trace-site-inspector.test.ts` Playwright fixtures plus `packages/os/tests/trace-sites-browser-client.test.ts` and gateway endpoint tests.
- New/changed tests: formatter unit cases, inspector browser interaction cases, virtual-list incremental update cases, browser-client polling/focus cases, and SQLite cursor endpoint cases.
- Focused red commands: `bunx vitest run packages/workspace/tests/trace-site-inspector.test.ts` and `bunx vitest run --root packages/os tests/trace-sites-browser-client.test.ts tests/trace-sites-gateway-live-endpoints.test.ts`.
- Expected red failure: missing workpad-specific label/view, tooltip appears before one second, duplicated analytics/unstable rail, width not persisted/full-width drag capped, footer lacks scroll-top layout, raw punctuation remains, and incremental refresh does not preserve state or remove the terminal ceiling.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

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
- Stacking the prior trace-site branch by merge hit unrelated `office.ts` conflicts from the stale workspace stream, so the merge was aborted. The two bounded trace-inspector commits were cherry-picked; modify/delete conflicts meant the older workspace stream lacked those exact files, so the approved branch-two versions were added intact before branch-three work.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace): description" --changed
bun run task:pr
bun run task:finish
```
