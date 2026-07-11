# repair trace tree selection and remove detail flash

branch: `task/trace-site/repair-trace-tree-selection-and-remove-detail-flash`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1416/repair-trace-tree-selection-and-remove-detail-flash
github pr: https://github.com/consuelohq/opensaas/pull/1416
started: 2026-07-11

## acceptance criteria

- [ ] Restore batch expansion in the main trace list and trace tree. A `batch` parent must expose its actual child calls in execution order, with the parent remaining visible and selectable. Do not synthesize children from unrelated branch peers and do not flatten children into independent root traces.
- [ ] Preserve child identity and payload. Selecting a child must show that child's tool, status, timing, tokens, input/output, trace id, and raw payload rather than the parent batch payload.
- [ ] Remove the inner-page layout flash. The first DOM painted after opening a trace must already match the final inner layout; the obsolete sidebar/detail composition must never appear for a frame while hydration or selection state initializes.
- [ ] Remove the redundant selected-tool summary block from the left inner sidebar. Specifically remove the top block that repeats the tool name, duplicate operation name, status/code, duration, and trace id. The first visible section in that sidebar must be `BRANCH`, with the remaining branch metrics and tree/peer content shifted upward.
- [ ] Make every visible tree/peer/child entry independently selectable. Clicking a different entry must update the selected-row styling, the sidebar context, and the right-hand detail pane to that entry. Repeated clicks must not remain pinned to the original trace.
- [ ] Keep selection stable through virtual-list recycling, history-page append, filter changes that still include the selected trace, and opening/closing the detail pane.
- [ ] Keep the existing newest-to-oldest retention behavior, private history transport, public synthetic preview boundary, and `Scroll to top` behavior unchanged.
- [ ] Add a browser regression proving: batch parent -> child A -> child B selection updates; no stale parent detail; no duplicate top summary block; `BRANCH` is the first sidebar section; and no obsolete-layout flash during initial render.

## plan

1. Reproduce all four regressions against the current `stream/trace-site` artifact and capture the exact DOM/state transitions.
2. Trace batch child normalization from backend rows through `trace-list.ts`, virtual-list row construction, and the inner trace tree. Identify where child rows stopped being associated with the batch parent.
3. Trace selection ownership across the main virtual list, branch-peer/tree list, and detail pane. Replace any stale closure, root-only key, or parent fallback that prevents child/peer selection from changing the active record.
4. Remove the obsolete pre-hydration/sidebar markup or make server/static markup structurally identical to the final client layout so hydration does not swap layouts.
5. Delete the redundant selected-tool summary block and move `BRANCH` plus all subsequent sidebar content upward without adding replacement spacing.
6. Add focused unit/source-contract tests plus Playwright coverage for expansion, child selection, peer selection, first-paint layout, and sidebar ordering.
7. Bundle, deploy locally to the private trace site, and verify the exact interactions before pushing. Do not wait for an additional Codex review unless Ko asks.

## current status

- Handoff task created for a new agent. No implementation work has started.
- The task starts from merged `stream/trace-site` commit `57c3e0a140f7919a4ffb1a0f254e2dcefa13cf9d`.
- The attached conversation screenshots are the visual source of truth; their relevant states are transcribed below so the task is self-contained.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

## key decisions

- Treat batch children as first-class selectable trace records nested under a batch parent, not as branch peers and not as a decorative expansion.
- Use one canonical selected-record key across root rows, batch children, branch peers, and the detail pane.
- Solve the flash at the markup/state-initialization boundary. Do not hide it with a timeout, opacity animation, or delayed reveal.
- The left sidebar begins with `BRANCH`; do not replace the removed tool summary with another header card.

## notes for ko

- Visual reference 1: the full trace table shows `batch` root rows with multiple indented `child` rows beneath each parent. This is the expected batch expansion behavior that regressed.
- Visual reference 2: the obsolete inner layout briefly appears. Its left sidebar starts with a `TRACE` summary containing `review.run`, a duplicate `review.run`, `OK`, `13.1s`, and a trace id, followed by `BRANCH`. Remove that entire summary so `BRANCH` moves to the top.
- Visual reference 3: the newer inner layout appears after the flash. The handoff must preserve this final composition while fixing selection so clicking another tree/peer/child entry changes the right-hand trace detail.
- Ko explicitly requested a handoff to a new agent rather than continued work in the prior task.

## improvements noticed

- none yet

## issues and recovery

- Prior trace-site pagination work is complete and merged. This task is a separate UI/state regression follow-up; do not reopen or rewrite the history retention implementation unless a failing regression directly proves it is involved.

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet

- 2026-07-11 17:18:14 apply-patch: `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/workpad.md`