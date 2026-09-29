# finish wide ipad diffs and review markdown polish

branch: `task/os/finish-wide-ipad-diffs-and-review-markdown-polish`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2522
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

## acceptance criteria

- [x] Large iPad landscape / 1366px review pages keep the diff as the primary surface and move the file tree into the drawer/FAB flow.
- [x] 1024px iPad and mobile behavior stays unchanged by the breakpoint change.
- [x] Review markdown renders single-star and single-underscore emphasis instead of exposing raw delimiters in CodeRabbit/Codex prose.
- [x] Existing safe HTML restoration, links, code spans, strong text, comment jumps, and panel behavior remain intact.
- [ ] Focused diff-cockpit suite, strict review, full verify, and rendered 1366/1024/mobile browser checks pass before release.

## plan

1. Extend the existing renderReviewPage contract with the wide-iPad breakpoint and emphasis renderer behavior.
2. Run focused RED.
3. Make the smallest CSS/markdown parser changes.
4. Run focused GREEN, strict review, and verify.
5. Promote into stream/os, release the new stream review to canary, update local runtime, and browser-verify wide iPad, standard iPad, and mobile.

## Test-first contract

behavior under test: Diffs uses its tablet drawer layout through 1366px and review markdown renders ordinary italic emphasis while preserving current escaped/safe markdown behavior.
existing local pattern: packages/diff-cockpit/tests/diff-cockpit.test.ts contracts emitted CSS/client script and syntax-checks the module.
new or changed tests: assert the responsive breakpoint covers 1366px and the client includes an inline-emphasis transform for _text_ and *text*.
focused red command: bun --cwd packages/diff-cockpit test
expected red failure: current CSS switches only at 1180px and renderInlineMarkdown handles code/strong/links/safe tags but leaves single-emphasis delimiters visible.
no-test waiver: not applicable.

## evidence from shipped browser verification

- 1024x768: single-column diff, file pane fixed/off-canvas, SVG file FAB visible.
- 390x844: single-column diff, bottom-sheet file tray, full-width review drawer, comment wrapping anywhere.
- 1366x1024: still desktop split (460px tree + 871px diff), which is too cramped for large-iPad landscape.
- Live CodeRabbit review prose still exposes single-underscore emphasis markers in accessibility text.

## progress

- RED: focused suite failed against the 1180px tablet cutoff; an intermediate regex implementation also failed the embedded client-script syntax contract, which caught template-literal escaping before publish.
- GREEN: breakpoint now covers 761–1366px; emphasis uses a delimiter scanner that avoids regex/template escaping and skips code/strong spans.
- Focused diff-cockpit suite: 42/42 passing, 434 expectations.
- Strict review: 0 task issues, 0 blockers.
- Full verify: passed and publish-valid.

- 2026-09-21 17:01:36 append: `.task/os/finish-wide-ipad-diffs-and-review-markdown-polish/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 17:01:36 fs.write: `.task/os/finish-wide-ipad-diffs-and-review-markdown-polish/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

- 2026-09-21 17:04:07 apply-patch: `packages/diff-cockpit/src/index.ts`

## workspace-owned: validation evidence

- 2026-09-21 17:04:26 `review.run`: passed — OK
- 2026-09-21 17:04:41 `verify`: passed — OK

- 2026-09-21 17:04:53 apply-patch: `.task/os/finish-wide-ipad-diffs-and-review-markdown-polish/workpad.md`