# polish diffs responsive panels and readability

branch: `task/os/polish-diffs-responsive-panels-and-readability`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2494
started: 2026-09-21

## acceptance criteria

- [ ] iPad/tablet review layout gives the diff the primary width instead of squeezing the desktop file tree beside it; desktop and existing mobile behavior remain usable.
- [ ] The mobile/tablet file control uses a deterministic rendered icon and accessible label instead of a platform glyph.
- [ ] The changed-file tree is readable: file type and Git status no longer concatenate into labels like TSA/TSM, and .github/.task start collapsed without broadly hiding product code.
- [ ] Comments and review annotations use one right-side review surface, render the GitHub review markdown we actually receive (including safe subscript badge markup), wrap readably, and path comments jump to their inline location instead of expanding in a second sidebar.
- [ ] Review drawer and commit/merge popovers close when the user clicks outside them on desktop, tablet, and mobile; Escape remains supported.
- [ ] Merge uses an in-page confirmation UI rather than window.confirm while preserving the existing merge endpoint and Cmd/Ctrl+M shortcut.
- [ ] Typography/spacing are tightened for readability without changing Diffs data/cache semantics; cache freshness/progressive loading remains owned by the separate active task/PR #2491.
- [ ] Focused tests, typecheck/review/verify, and rendered browser checks at desktop, iPad, and mobile widths pass before publish.

## plan

1. Keep this task on the canonical `packages/diff-cockpit` renderer; the OS runtime vendor file is a source shim and the runtime bundle vendors the canonical implementation at build time.
2. Update the existing renderReviewPage contract test first for the unified panel, tablet breakpoint, deterministic file button/icon, clear tree status presentation, default meta-folder collapse, safe review markdown, outside-dismiss behavior, and custom merge confirmation; run it RED.
3. Implement the smallest UI/state changes in `packages/diff-cockpit/src/index.ts`, preserving the existing live-data/cache and mutation endpoints.
4. Run focused GREEN tests and package typecheck, inspect the diff, then run workspace review/verify.
5. Render and inspect the task build at desktop, iPad, and mobile widths, including panel dismissal, comment jump behavior, and merge confirmation.
6. Push/promote into `stream/os`, ship the stream review PR to main as requested, and verify the shipped/local state.

## Test-first contract

- behavior under test: one coherent responsive Diffs review surface across desktop/tablet/mobile; comments jump inline and render safely/readably; meta folders default closed; file status/type are distinguishable; outside clicks dismiss overlays; merge confirmation is native to the page.
- existing local pattern: `packages/diff-cockpit/tests/diff-cockpit.test.ts` statically contracts the HTML/CSS/client-script emitted by `renderReviewPage`, then syntax-checks the embedded module. Runtime behavior is additionally browser-verified.
- new or changed tests: update the existing `renderReviewPage` contract assertions in `packages/diff-cockpit/tests/diff-cockpit.test.ts`; add focused assertions for safe `<sub>` markdown handling and default collapsed roots.
- focused red command: `bun --cwd packages/diff-cockpit test`.
- expected red failure: current renderer still contains a separate `ai-comments-sidebar`, `window.confirm`, no tablet review breakpoint, glyph-based mobile file icon, empty default collapsed-folder state, and visible type+status token adjacency.
- no-test waiver: none.

## files changed

- `packages/diff-cockpit/src/index.ts` — responsive tablet/mobile file drawer, unified review panel, readable tree/status presentation, safe review markdown badges, outside-dismiss interactions, and in-page merge confirmation.
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` — contract coverage for the new responsive/unified behavior and client-script syntax.

## key decisions

- Do not fold the active cache/progressive-loading work into this UI task; PR #2491 already owns that behavior.
- Prefer one review drawer with multiple entry points (Panel and Comments) over two competing right-side panels.
- Default-collapse only explicit repository-meta roots (.github and .task) rather than guessing that every non-packages folder is noise.
- Keep the existing built-in renderer as the authoritative review tree/diff UI for this change. The page currently imports Pierre viewer modules only as optional progressive enhancement; integrating a new tree runtime is a separate architectural change, not required to make the current UX coherent.
- Keep Git status semantic but visually separate it from file type: compact file-type chips plus status dots remove the accidental `TSA` / `TSM` appearance without discarding information.
- Keep normalized GitHub review-thread state as the source of truth, while folding remaining review comments into the same drawer and deduplicating by URL/content identity.
- Allow only attribute-free `sub`, `sup`, and `br` tags back through the review markdown renderer after HTML escaping; all other raw HTML remains escaped.

## notes for ko

- RED was captured first: the updated review-page contract failed against the old two-sidebar/native-confirm/tablet behavior (40 pass, 1 expected fail).
- GREEN is 41/41 focused tests with 423 expectations.
- Strict workspace review reports 0 issues from this change and 0 blockers.
- Direct package typecheck reaches the known pre-existing Bun matcher typing errors at `tests/diff-cockpit.test.ts:79-80` (`toHaveProperty` missing from `Matchers`); this task does not touch that region.

## improvements noticed

- The current page imports @pierre/trees but does not instantiate it; the visible file tree is the built-in renderer. That mismatch explains why the live tree does not resemble Pierre's documentation example and should be evaluated separately from this polish pass.
- The stylesheet contains repeated mobile media blocks from earlier work. They remain a separate index-page cleanup; this task keeps its review-page tablet/mobile rules scoped and covered by focused tests.

## errors i ran into

- Initial parallel discovery had two explore queries fail while the narrower markdown/comments query succeeded; split targeted fs reads/searches recovered the implementation path with no mutation loss.
- One tools.search call used limit 6 while the current schema caps it at 5; retried with the valid bound.
- One exploratory `fs.search` treated `.layout {` as a regex and rejected the unescaped brace; retried with the literal token `layout`.
- An initial Bun typecheck command used the wrong argument order and printed help; reran as `bun run --cwd packages/diff-cockpit typecheck`, which exposed only the pre-existing matcher typing issue above.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/package.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/documentation/src/styles/docs.css`
- `packages/os/scripts/server/routes/diffs.ts`
- `packages/os/scripts/server/vendor/diff-cockpit.ts`

## workspace-owned: validation evidence

- 2026-09-21 03:10:18 `review.run`: passed — OK
- 2026-09-21 03:11:03 apply-patch: `.task/os/polish-diffs-responsive-panels-and-readability/workpad.md`
- 2026-09-21 03:11:14 `verify`: passed — OK
