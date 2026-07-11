# repair trace tree selection and remove detail flash

branch: `task/trace-site/repair-trace-tree-selection-and-remove-detail-flash`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1416/repair-trace-tree-selection-and-remove-detail-flash
github pr: https://github.com/consuelohq/opensaas/pull/1416
started: 2026-07-11

## acceptance criteria

- [x] Restore batch expansion in the main trace list and trace tree. A `batch` parent must expose its actual child calls in execution order, with the parent remaining visible and selectable. Do not synthesize children from unrelated branch peers and do not flatten children into independent root traces.
- [x] Preserve child identity and payload. Selecting a child must show that child's tool, status, timing, tokens, input/output, trace id, and raw payload rather than the parent batch payload.
- [x] Remove the inner-page layout flash. The first DOM painted after opening a trace must already match the final inner layout; the obsolete sidebar/detail composition must never appear for a frame while hydration or selection state initializes.
- [x] Remove the redundant selected-tool summary block from the left inner sidebar. Specifically remove the top block that repeats the tool name, duplicate operation name, status/code, duration, and trace id. The first visible section in that sidebar must be `BRANCH`, with the remaining branch metrics and tree/peer content shifted upward.
- [x] Make every visible tree/peer/child entry independently selectable. Clicking a different entry must update the selected-row styling, the sidebar context, and the right-hand detail pane to that entry. Repeated clicks must not remain pinned to the original trace.
- [x] Keep selection stable through virtual-list recycling, history-page append, filter changes that still include the selected trace, and opening/closing the detail pane.
- [x] Keep the existing newest-to-oldest retention behavior, private history transport, public synthetic preview boundary, and `Scroll to top` behavior unchanged.
- [x] Add a browser regression proving: batch parent -> child A -> child B selection updates; no stale parent detail; no duplicate top summary block; `BRANCH` is the first sidebar section; and no obsolete-layout flash during initial render.

## plan

1. Reproduce all four regressions against the current `stream/trace-site` artifact and capture the exact DOM/state transitions.
2. Trace batch child normalization from backend rows through `trace-list.ts`, virtual-list row construction, and the inner trace tree. Identify where child rows stopped being associated with the batch parent.
3. Trace selection ownership across the main virtual list, branch-peer/tree list, and detail pane. Replace any stale closure, root-only key, or parent fallback that prevents child/peer selection from changing the active record.
4. Remove the obsolete pre-hydration/sidebar markup or make server/static markup structurally identical to the final client layout so hydration does not swap layouts.
5. Delete the redundant selected-tool summary block and move `BRANCH` plus all subsequent sidebar content upward without adding replacement spacing.
6. Add focused unit/source-contract tests plus Playwright coverage for expansion, child selection, peer selection, first-paint layout, and sidebar ordering.
7. Bundle, deploy locally to the private trace site, and verify the exact interactions before pushing. Do not wait for an additional Codex review unless Ko asks.

## current status

- Reproduced the current branch in Chromium with a real browser bundle and a batch parent containing two distinct child records.
- All three visible rows received the same parent key and selected styling. Clicking child A or child B left `batch-parent` selected and rendered the parent payload in the inspector.
- Confirmed the left inner sidebar begins with the redundant `Trace` summary card rather than `Branch`.
- Confirmed the deployment model appends the overlay module to an existing artifact, leaving legacy detail markup eligible to paint before the replacement inspector mounts.
- Implemented first-class batch child records with canonical child keys shared by the virtual list, branch tree, selection state, and inspector.
- Joined real batch `input_json.steps` and ordered result envelopes at both live-feed and paginated-history boundaries so child tool/input/payload metadata is complete.
- Replaced the generated inspector mount with the final Branch-first shell before the HTML response is served, eliminating the obsolete-layout first frame.
- Removed the redundant Trace summary card and added selected-record metadata to the preview header.
- Moved row/back interaction ownership to capture phase so legacy artifact handlers cannot overwrite canonical selection; canonical selection now owns `closed`/`detail-open` visibility classes.
- Locally deployed and verified the real Live Traces cockpit against a trusted 250-row older-history page containing 14 real batch envelopes.
- The task starts from merged `stream/trace-site` commit `57c3e0a140f7919a4ffb1a0f254e2dcefa13cf9d`.
- The attached conversation screenshots are the visual source of truth; their relevant states are transcribed below so the task is self-contained.

## test-first contract

- Add a focused Playwright regression that renders a batch parent plus child A and child B through the production browser bundle.
- Red assertions: parent/children have distinct canonical selection keys; parent -> child A -> child B updates selected styling and child-specific tool, status, timing, tokens, input/output, trace id, and raw detail.
- Red assertions: selecting branch peers updates the same canonical selection state and detail pane; virtual recycling, retained filters, appended history, and detail close/open do not pin the previous record.
- Red assertions: the first sidebar eyebrow is `Branch`, `.tiTraceCard` is absent, and the first-paint DOM never exposes legacy detail content before `.tiInspector` is ready.
- Preserve the existing pagination, private transport, synthetic-preview sanitization, newest retention, and Scroll-to-top tests unchanged.

## files changed

- `packages/workspace/scripts/office.ts`
- `packages/workspace/scripts/trace-site-inspector/archive-history.ts`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/model.ts`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`
- `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/workpad.md`

## workspace-owned: files changed

- Source and test files listed above are task-owned. The generated Open Design `.od` archive was updated only as an ignored local deployment surface.

## workspace-owned: activity log

- Loaded the stale supplied pagination handoff, then treated this task workpad and active branch as authoritative.
- Ran a no-write Chromium reproduction against the current browser bundle. Evidence: parent, child A, and child B all used `data-trace-key="batch-parent"`; every row was selected; child clicks kept inspector key `batch-parent` and parent content.
- The configured private Tailnet URL was unavailable in the existing browser daemon, so reproduction used the same production bundle in an isolated Playwright document.
- Added a focused Playwright regression with a stale seed, delayed module, real live refresh, parent/child/peer selection, legacy-handler interference, virtualization, filtering, history append, and detail close/reopen.
- Added a SQLite-backed regression proving paginated batch children join ordered step inputs to ordered child results.
- Validated live endpoint enrichment and paginated history enrichment against the real local trace database.
- Deployed the task build into the real trace artifact and restarted the internal archive server.
- Real-site validation found and fixed two integration-only issues: legacy row handlers overwrote selection, and blocking those handlers left the artifact's `.closed` class in place. Capture-phase ownership plus canonical visibility transitions resolved both.

## workspace-owned: validation evidence

- Baseline browser reproduction: `code.call` trace `trc_f4e2e4d3f4aa` exited 0 and captured the regressions before source edits.
- Focused browser regression: `trc_b5cfbb1b1ddd` passed.
- Full trace-site regression suite: `trc_52482c2d9f3e` passed 21/21 tests.
- Production bundle compile gate: `trc_fdfe45aff1b2` compiled archive history, browser overlay, and office server.
- Real trusted-history append: `trc_2c7c57daf1af` loaded 250 older rows with 14 batch envelopes and rendered ordered child calls.
- Final real internal-site interaction validation: `trc_764f86586f13` passed parent -> child A -> child B, peer selection, Branch-first sidebar, no Trace card, visible 819x828 detail geometry, distinct child payloads, close/reopen selection retention, and zero page errors.
- Full workspace safety gate: `trc_a9bbbff2f567` passed static rules, ESLint, typecheck, spec compliance, DB guard, 9 trace gateway endpoint tests, 1 DB resolution test, and all 21 trace inspector tests; publish-valid stamp written to `verify.json`.
- Local deployed URL: `https://picassos-mac-mini.tail38ed59.ts.net/trace-burn-intelligence` (direct target `http://100.112.173.49:53935/trace-burn-intelligence`).
- 2026-07-11 18:22:04 `verify`: passed — OK
- 2026-07-11 18:22:38 `verify`: passed — OK
- 2026-07-11 18:25:35 `verify`: passed — OK

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

- The office refresh command emits repeated Tailscale route listings; a compact JSON-only mode would make deployment evidence easier to inspect.

## issues and recovery

- Prior trace-site pagination work is complete and merged. This task is a separate UI/state regression follow-up; do not reopen or rewrite the history retention implementation unless a failing regression directly proves it is involved.
- The user-supplied `/tmp` handoff described the already-completed infinite-history task, not this task. Continued from the active workpad and task PR instead.
- `task.intent resume` and `task.intent dispatch` were not applicable to the existing session (`resume` is unsupported; `dispatch` requires an event JSON). The task session itself resolves correctly for all filesystem and lifecycle operations.
- The built-in browser daemon became unresponsive after repeated live-page navigation; deterministic Playwright validation against the same deployed internal URL was used after restarting the archive server.
- The current newest 100-row live window contained no batch envelopes. Validation loaded a real older page through the site's trusted history transport rather than fabricating a record.

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/office.ts`
- `packages/workspace/scripts/trace-site-inspector/archive-history.ts`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/model.ts`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/trace-site-inspector.test.ts`

- 2026-07-11 18:10:42 apply-patch: `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/repair-trace-tree-selection-and-remove-detail-flash.json`, `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/current.json`, `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/evidence-log.json`, `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/read-log.json`, `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/session.json`, `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/verify.json`, `.task/trace-site/repair-trace-tree-selection-and-remove-detail-flash/workpad.md`, `packages/workspace/scripts/office.ts`, `packages/workspace/scripts/trace-site-inspector/archive-history.ts`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/model.ts`, `packages/workspace/scripts/trace-site-inspector/preview.ts`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: `trace-site-pagination`
- selected suites: `trace gateway history endpoints`, `trace gateway DB resolution`, `trace site inspector pagination`
- run results: `trace gateway history endpoints` passed, `trace gateway DB resolution` passed, `trace site inspector pagination` passed
- failed suites: none
