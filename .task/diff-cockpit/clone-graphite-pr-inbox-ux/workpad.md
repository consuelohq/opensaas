# clone graphite pr inbox ux

branch: `task/diff-cockpit/clone-graphite-pr-inbox-ux`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/891/clone-graphite-pr-inbox-ux
github pr: https://github.com/consuelohq/opensaas/pull/891
started: 2026-06-09

## acceptance criteria

- [x] Redesign the PR inbox list to feel like Graphite: compact grouped rows, cleaner spacing, table-like metadata columns, richer status/changes/updated affordances, and load-more pagination that extends each group in place.
- [x] Keep Consuelo colors and font, keep the stream dotted/action control, hide the author identity from row primary metadata, and show stream-aware subtitles such as `stream/os • consuelohq/opensaas #879`.
- [x] Default the Open and Closed sections to expanded, while retaining collapsible sections and stream toggling.
- [x] Replace the existing inline search with a universal command palette opened by Cmd/Ctrl+K on desktop; it searches PRs fuzzily, including dotted terms like `code.call`, and includes navigation commands copied from the existing page framework.
- [x] On mobile, expose the same command search through a floating action button and bottom drawer with toggle/close behavior.
- [x] Reuse existing data/ranking patterns where possible and add TDD coverage for Ko's asserted behaviors.

## test-first contract

Behavior under test:
- The index shell renders a command-palette entrypoint with Cmd/Ctrl+K affordances, page navigation command metadata, no inline search row, and Open/Closed sections expanded by default.
- Client-side PR search uses a fuzzy/page-rank style scorer that matches dotted queries across title, branch, stream, repo, and PR number.
- Rendered PR rows use the Graphite-like compact metadata shape, hide the author name in row subtitles, keep stream/task context and stream action controls, and show changed/updated metadata.
- Section pagination uses load-more buttons that append more rows instead of replacing the whole page.
- Mobile exposes the command palette as a floating action button and bottom drawer with close/toggle semantics.

Existing local pattern:
- `packages/diff-cockpit/src/index.ts` renders a static HTML shell plus embedded client scripts.
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` already validates route/render/client behavior with string assertions and deterministic loader data.
- Current page-rank/fuzzy logic is in site/wiki search; reuse the scoring model rather than introducing a separate remote search dependency.

Intended tests:
- Add focused render assertions for command palette markup, nav commands, expanded Open/Closed details, absence of inline search row, PR row subtitle, stream toggle control, load-more button text, and mobile FAB/drawer markup.
- Add exported fuzzy scoring tests for dotted queries such as `code.call` matching `hotfix code call codemode facade`.
- Add section pagination/client script assertions for append-oriented load-more behavior.

Focused red command:
- `cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts`

Expected red failure:
- New assertions fail because the current index still uses an inline search row, closed default sections, old pagination controls, and has no command palette/fuzzy search exports.

## plan

1. Read current diff-cockpit renderer, tests, command-palette-like code, and ranking/search helpers.
2. Add red tests for the requested UX contract.
3. Implement the command palette, fuzzy scoring, mobile drawer/FAB, Graphite-like row layout, and load-more append pagination in the existing index shell/client.
4. Run focused tests and package typecheck.
5. Inspect diff, run review/verify, push, and promote the task PR.

## current status

- Task started from `stream/diff-cockpit` in task session `tsk_1c611ea7113f`.
- Stream sync with main currently conflicts in `packages/diff-cockpit/src/index.ts`; this task starts from the stream and records the conflict as an integration risk.
- Exploration found the current PR index renderer and client in `packages/diff-cockpit/src/index.ts`, with tests in `packages/diff-cockpit/tests/diff-cockpit.test.ts`.
- Implemented command palette/search, mobile drawer/FAB, Graphite-like row density, load-more section pagination, default-expanded Open/Closed sections, and exported fuzzy PR scoring.
- Focused tests, typecheck, review, and verify are green.

## files changed

- `.task/diff-cockpit/clone-graphite-pr-inbox-ux/workpad.md`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `.task/diff-cockpit/clone-graphite-pr-inbox-ux/workpad.md`
- `packages/diff-cockpit/src/index.ts`

## workspace-owned: activity log

- 2026-06-09 22:06:31 fs.write: `.task/diff-cockpit/clone-graphite-pr-inbox-ux/workpad.md`
- 2026-06-09 22:27:43 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 22:32:10 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09: `stream.sync` for `stream/diff-cockpit` failed with a content conflict in `packages/diff-cockpit/src/index.ts`; continued on the stream task branch.

## workspace-owned: validation evidence

- 2026-06-09 22:11:11 `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`: failed as expected — missing `scorePullRequestSearch` export.
- 2026-06-09 22:33:32 `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`: passed — 30 tests, 279 expectations.
- 2026-06-09 22:33:39 `./node_modules/.bin/tsc --noEmit -p packages/diff-cockpit/tsconfig.json`: passed.
- 2026-06-09 22:35:33 `review`: passed — no issues in this change.
- 2026-06-09 22:36:01 `verify`: passed — publish valid.
- 2026-06-09 22:37:12 `verify`: passed — OK

## key decisions

- Keep Consuelo visual tokens while using Graphite's density, grouping, row metadata, and append-pagination interaction model.
- Use the existing static HTML + embedded script architecture for the page; no new frontend framework.

## notes for ko

- none yet

## improvements noticed

- `code.run` failed in this task branch because the stream lacks `packages/workspace/scripts/lib/codemode/tools/index`; direct workspace tools are being used instead.

## issues and recovery

- `stream.sync` conflict: `packages/diff-cockpit/src/index.ts` conflicts with main. Integration into main will need a later conflict resolution after this stream task lands.

---

## publish checklist

```bash
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-09 22:06:31 write: `.task/diff-cockpit/clone-graphite-pr-inbox-ux/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/clone-graphite-pr-inbox-ux/current.json`, `.task/diff-cockpit/clone-graphite-pr-inbox-ux/evidence-log.json`, `.task/diff-cockpit/clone-graphite-pr-inbox-ux/read-log.json`, `.task/diff-cockpit/clone-graphite-pr-inbox-ux/session.json`, `.task/diff-cockpit/clone-graphite-pr-inbox-ux/verify.json`, `.task/diff-cockpit/clone-graphite-pr-inbox-ux/workpad.md`, `.task/tasks/diff-cockpit/clone-graphite-pr-inbox-ux.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
