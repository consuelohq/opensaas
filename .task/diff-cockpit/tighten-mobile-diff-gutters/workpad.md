# tighten mobile diff gutters

branch: `task/diff-cockpit/tighten-mobile-diff-gutters`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/749/tighten-mobile-diff-gutters
github pr: https://github.com/consuelohq/opensaas/pull/749
started: 2026-06-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-03 18:02:05 `review.run`: passed — OK
- 2026-06-03 18:02:19 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## update 2026-06-03 14:01

Tightened mobile diff gutter spacing after Ko's screenshot showed the code starting too far to the right.

Validation evidence:
- Red test first: `bun --cwd=packages/diff-cockpit run test` failed on missing mobile gutter CSS.
- Green test/typecheck: `bun --cwd=packages/diff-cockpit run test && bun --cwd=packages/diff-cockpit run typecheck` passed with 18 tests and 161 expectations.
- Cloudflare deploy: Worker version `5096893d-19d0-49fa-8c5c-7d285f9f09f9` deployed to `diffs.consuelohq.com`.
- Live smoke: PR #719 page contains the mobile 38px/38px diff gutters, reduced gutter padding, and 76px inline-comment offset.

Implementation:
- Mobile only: `.diff-line` now uses `38px 38px minmax(0, 1fr)` instead of inheriting desktop `68px 68px` gutters.
- Mobile only: `.diff-gutter` padding reduced to `6px`.
- Mobile only: `.inline-comment` left offset reduced to `76px`.

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/tighten-mobile-diff-gutters/current.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/session.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/workpad.md`, `.task/tasks/diff-cockpit/tighten-mobile-diff-gutters.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
