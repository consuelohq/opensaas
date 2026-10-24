# Fix cloud card generator review finding

branch: `task/website/fix-cloud-card-generator-review-finding`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2612
started: 2026-09-29

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: The social card generator should retain browser and filesystem error context without introducing a nested async callback flagged by the workspace reviewer.
existing local pattern: The generator already wraps render failures with a cause; the CI review identified two ERROR_HANDLING findings at the image decode callback and multi-card writer.
new or changed tests: Reuse the existing social card fixture test and run the workspace review after the focused source edit.
focused red command: The prior stream PR review on run 36612936579 reported ERROR_HANDLING at generator lines 143 and 162; this is the red result for this exact change.
expected red failure: Two ERROR_HANDLING findings in generate-social-card.ts.
no-test waiver: No new test is needed for this error handling change because it does not change rendered card output; the existing PNG integrity test and workspace review cover the relevant behavior.

- 2026-09-29 18:40:07 append: `.task/website/fix-cloud-card-generator-review-finding/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 18:40:07 fs.write: `.task/website/fix-cloud-card-generator-review-finding/workpad.md`

## workspace-owned: validation evidence

- 2026-09-29 18:41:01 `review.run`: passed — OK
- 2026-09-29 18:41:03 `review.run`: passed — OK
