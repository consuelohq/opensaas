
## Discovery and test-first contract

- Source of truth: origin/main commits from 2026-07-17 through 2026-07-23.
- Target file: packages/consuelo-website/src/data/json-files/changelogData.json.
- Renderer change: not expected; data schema already supports month/week/section ordering.
- Test strategy: no-test waiver for data-only copy update. Validate JSON parsing, reverse chronological month/week order, legacy entry preservation, website build, diff review, and production smoke.
- Focused red test: waived because the task changes structured changelog content without runtime behavior.

## workspace-owned: validation evidence

- 2026-07-23 22:18:05 `review.run`: passed — OK
- 2026-07-23 22:18:14 `verify`: passed — OK
