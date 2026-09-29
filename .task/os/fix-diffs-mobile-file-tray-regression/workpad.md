# fix diffs mobile file tray regression

branch: `task/os/fix-diffs-mobile-file-tray-regression`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2496
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Follow-up browser finding

The first shipped polish passed desktop/iPad behavior, but live 390x844 verification exposed a CSS specificity regression: the new tablet selector `.review-page .file-pane` wins over the existing mobile `.file-pane` transform, so the mobile file tray is translated left instead of down. The fix must keep the new tablet off-canvas behavior while restoring the pre-existing mobile bottom sheet.

## Test-first contract

behavior under test: tablet-only off-canvas file-pane rules must apply from 761px through 1180px and must not override <=760px mobile bottom-sheet transforms.
existing local pattern: `packages/diff-cockpit/tests/diff-cockpit.test.ts` statically contracts emitted responsive CSS and syntax, followed by live browser verification at exact viewport widths.
new or changed tests: assert the tablet media query has a `min-width: 761px` bound and retain the mobile `@media (max-width: 760px)` bottom-sheet contract.
focused red command: `bun --cwd packages/diff-cockpit test`.
expected red failure: current code emits `@media (max-width: 1180px)`, allowing the higher-specificity tablet `.review-page .file-pane` transform to leak into mobile.
no-test waiver: none.

## Acceptance criteria

- [ ] 1024px tablet keeps the file pane off-canvas left and diff single-column.
- [ ] 390px mobile restores the bottom-sheet transform and keeps the SVG file toggle.
- [ ] `.github` and `.task` remain collapsed by default.
- [ ] Focused tests, review, verify, promotion, local update, and live browser probe pass.

- 2026-09-21 03:32:33 append: `.task/os/fix-diffs-mobile-file-tray-regression/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 03:32:33 fs.write: `.task/os/fix-diffs-mobile-file-tray-regression/workpad.md`
- 2026-09-21 03:32:46 apply-patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-09-21 03:32:55 apply-patch: `packages/diff-cockpit/src/index.ts`
- 2026-09-21 03:33:55 fs.write: `.task/os/fix-diffs-mobile-file-tray-regression/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 03:33:33 `review.run`: passed — OK
- 2026-09-21 03:33:48 `verify`: passed — OK

## Evidence

- RED: focused suite failed only the new bounded-tablet media assertion (40 pass, 1 expected fail).
- GREEN: `packages/diff-cockpit` 41/41, 423 expectations.
- Strict review: 0 issues from this change, 0 blockers; one unrelated pre-existing project typecheck capability finding.
- Verify: passed, publish-valid.

- 2026-09-21 03:33:55 append: `.task/os/fix-diffs-mobile-file-tray-regression/workpad.md`
