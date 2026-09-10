# fix diff cockpit canonical internal URL parsing

branch: `task/os/fix-diff-cockpit-canonical-internal-url-parsing`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2359
started: 2026-09-01

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

## Test-first contract

behavior under test: `diff_cockpit` must accept the canonical URL it emits, `https://internal.consuelohq.com/diffs/<owner>/<repo>/pull/<number>`, preserving owner, repository, and PR number.
existing local pattern: workspace `pr-ref.js` now recognizes canonical internal Diffs URLs, but the separate parser in `packages/diff-cockpit/src/index.ts` only recognizes GitHub URLs and the legacy unprefixed route shape.
new or changed tests: add canonical internal URL coverage to the diff-cockpit parser/CLI tests while preserving GitHub and legacy inputs.
focused red command: run the smallest diff-cockpit test suite that covers `parsePullRequestLocator` / CLI URL input.
expected red failure: a canonical internal Diffs URL is rejected by the launcher parser.
no-test waiver: not applicable.

## Review source

- Codex P2 on stream PR #2349: the Diffs launcher emits canonical internal URLs but cannot parse that same URL when passed back as input.

- 2026-09-01 01:44:25 append: `.task/os/fix-diff-cockpit-canonical-internal-url-parsing/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 01:44:25 fs.write: `.task/os/fix-diff-cockpit-canonical-internal-url-parsing/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/package.json`

## workspace-owned: validation evidence

- 2026-09-01 01:47:14 `review.run`: passed — OK
- 2026-09-01 01:48:15 `verify`: passed — OK
