# Align lesson template with reader components

branch: `task/consuelo-design/align-lesson-template-with-reader-components`
stream: `stream/consuelo-design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/690/align-lesson-template-with-reader-components
github pr: https://github.com/consuelohq/opensaas/pull/690
started: 2026-06-02

## acceptance criteria

- [x] Verify whether the research/teacher template already references the richer typed reader components.
- [x] Patch the research/teacher template so lessons know to use the canonical reader renderer and component palette.
- [x] Patch the plan template as the remaining digital-e-guide contract so plans use the spec renderer mode and the same component palette.
- [x] Patch the digital-e-guide README so template selection and render modes are unambiguous.
- [x] Validate reader tests and design package check.

## plan

1. Inspect research, spec, plan, and README for render/component guidance.
2. Update research/teacher component guidance without turning lessons into spec checklists.
3. Update plan guidance to render through spec mode instead of inventing a new renderer mode.
4. Update README with repo-root render commands and typed component summary.
5. Run tests and package check.

## current status

- Template alignment complete. Ready to push.

## files changed

- `packages/consuelo-design/templates/digital-eguides/README.md`
- `packages/consuelo-design/templates/digital-eguides/plan.md`
- `packages/consuelo-design/templates/digital-eguides/research.md`

## workspace-owned: files changed

- `.task/consuelo-design/align-lesson-template-with-reader-components/workpad.md`

## workspace-owned: activity log

- Confirmed spec already had richer typed component guidance.
- Confirmed research still had older lesson component guidance only.
- Added canonical typed component guidance to research: callout, cards, details, table, metrics, flow, timeline, ranges, comparisons, ledger.
- Added render protocol and component guidance to plan; plans use spec renderer mode because plans are operating specs.
- Updated README with render modes and shared component palette.

## workspace-owned: validation evidence

- `bun run test:reader` passed: 3 tests, 25 assertions.
- Template component coverage script passed: research, plan, and README all include the shared component terms.
- `bun run --cwd packages/consuelo-design check` passed.

## key decisions

- Do not add a new roadmap or plan renderer mode.
- Keep spec and research as the render modes.
- Treat plan as an instruction contract that renders through spec mode.
- Keep lesson pages teaching-specific: use ledger only for learning/practice/memory review, not forced spec task checklists.

## notes for ko

- The teacher/research template now explicitly knows to use the same component palette and canonical shell.
- The one other template was plan; it is now aligned too.

## improvements noticed

- README previously listed templates but did not state component palette or render modes clearly.
- plan did not have the repo-root render protocol.

## issues and recovery

- Initial task.start calls used the wrong taskSession shape; recovered by starting the task without a supplied session and using the returned task session.

---

## publish checklist

```bash
bun run task:push -- --message "type(consuelo-design): description" --changed
bun run task:pr
bun run task:finish
```
