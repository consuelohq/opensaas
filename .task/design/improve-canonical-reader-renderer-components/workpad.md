# Improve canonical reader renderer components

branch: `task/design/improve-canonical-reader-renderer-components`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/666/improve-canonical-reader-renderer-components
github pr: https://github.com/consuelohq/opensaas/pull/666
started: 2026-05-31

## acceptance criteria

- [x] Fix renderer shell polish regressions visible in the benchmark entry screenshots: font import, hover states, header polish, resume/back-to-top polish, and dark-mode cascade order.
- [x] Add typed optional section components so agents can produce roadmap-style variety without custom HTML.
- [x] Add mobile-safe table rendering so validation/requirements tables do not clip off-screen on iPhone.
- [x] Update spec template documentation with optional section component schema.
- [x] Add TDD coverage for the new components and shell polish.
- [x] Render a benchmark-style fixture and validate desktop, iPhone, and iPad snapshots.
- [x] Run package check and repo verify.

## plan

1. Write failing test for missing fonts/components/hover states/mobile table behavior/dark-mode order.
2. Implement renderer changes.
3. Update spec template docs.
4. Render benchmark-style fixture through root `wiki:render`.
5. Validate CLI output and browser snapshots on desktop/mobile/tablet.
6. Run `test:reader`, package check, and verify.
7. Push and create stream PR.

## current status

- Implementation complete. Verify passed. Ready to push.

## files changed

- `.task/design/improve-canonical-reader-renderer-components/current.json`
- `.task/design/improve-canonical-reader-renderer-components/evidence-log.json`
- `.task/design/improve-canonical-reader-renderer-components/read-log.json`
- `.task/design/improve-canonical-reader-renderer-components/session.json`
- `.task/design/improve-canonical-reader-renderer-components/verify.json`
- `.task/design/improve-canonical-reader-renderer-components/workpad.md`
- `.task/tasks/design/improve-canonical-reader-renderer-components.json`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

## workspace-owned: files changed

- `.task/design/improve-canonical-reader-renderer-components/current.json`
- `.task/design/improve-canonical-reader-renderer-components/evidence-log.json`
- `.task/design/improve-canonical-reader-renderer-components/read-log.json`
- `.task/design/improve-canonical-reader-renderer-components/session.json`
- `.task/design/improve-canonical-reader-renderer-components/verify.json`
- `.task/design/improve-canonical-reader-renderer-components/workpad.md`
- `.task/tasks/design/improve-canonical-reader-renderer-components.json`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

## workspace-owned: activity log

- 2026-05-31 12:19:42 fs.write: `.task/design/improve-canonical-reader-renderer-components/workpad.md`
- 2026-05-31: Added hover states and stronger header/resume/back-to-top styling.
- 2026-05-31: Added spec template docs for optional typed section components.
- 2026-05-31: Browser tested fixture on desktop, iPhone 16 Pro, and iPad Pro 11 presets.
- 2026-05-31: First red test caught missing font import before implementation.
- 2026-05-31: Implemented optional typed section components: callout, metrics, flow diagrams, mobile-safe tables, timelines, accordions/details, ranges/bars, comparisons.
- 2026-05-31: Moved dark-mode CSS to the end of the stylesheet so dark header/resume/card styles override base styles.
- 2026-05-31: Rendered benchmark-style fixture through root `wiki:render` and validated with `wiki:validate`.
- 2026-05-31: Started task from `stream/design`.
- 2026-05-31: Wrote failing test for renderer polish and optional component coverage.

## workspace-owned: validation evidence

- RED: `bun run test:reader` failed on new test because rendered HTML did not include `fonts.googleapis.com`.
- GREEN: `bun run test:reader` passed: 4 tests, 38 assertions.
- Root render passed: `bun run wiki:render -- --template spec --input <content.json> --out <index.html>`.
- Root validate passed: `bun run wiki:validate -- --input <index.html>` with `missing: []`.
- Browser desktop fixture loaded with nav, rail, map links, callout, flow, table, timeline, comparisons, details, and checklist.
- Browser iPhone fixture loaded; table cells appeared as labeled mobile cells like `AREA Workspace`, `REQUIREMENT ...`, `VALIDATION ...`.
- Browser iPad fixture loaded with mobile/tablet layout and labeled table cells.
- `cd packages/consuelo-design && bun run check` passed.
- `bun run verify` passed and wrote publish-valid stamp.

## key decisions

- Keep one `spec` content contract; do not add a roadmap template.
- Add variety as typed optional section components rather than letting agents hand-write custom HTML.
- Use CSS ordering to fix dark mode deterministically: base rules first, hover/responsive rules, then dark-mode override last.
- Tables collapse into labeled cells on mobile rather than relying on horizontal scrolling.

## notes for ko

- The benchmark page will still depend on the agent using typed components, but now the renderer supports the section types needed for roadmap-style variety.
- This improves future generated pages, not necessarily already-published pages unless they are re-rendered with the updated renderer.

## improvements noticed

- A future follow-up could make the generator/work order examples prefer typed components explicitly for benchmark entries.
- Another follow-up could add a visual comparison test against the roadmap artifact, but the current test checks structural/polish markers rather than screenshot diffing.

## issues and recovery

- Browser tool can validate responsive presets but not all real-device browser chrome behaviors. The iPhone/iPad screenshots still need occasional manual review.
- The initial dark-mode issue came from cascade order: the original dark media block appeared before base rules, so base light header styles could win.

---

## publish checklist

```bash
bun run task:push -- --message "feat(design): add rich reader section components" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

- 2026-05-31 12:19:42 write: `.task/design/improve-canonical-reader-renderer-components/workpad.md`
