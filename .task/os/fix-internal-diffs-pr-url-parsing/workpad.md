# fix internal diffs PR URL parsing

branch: `task/os/fix-internal-diffs-pr-url-parsing`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2355
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

behavior under test: PR references emitted by the canonical `internal.consuelohq.com/diffs/<owner>/<repo>/pull/<number>` UI must preserve the embedded owner/repository/PR number when parsed by workspace task tooling, including when a non-default repo is configured.
existing local pattern: `packages/workspace/scripts/lib/pr-ref.js` recognizes legacy `diffs.consuelohq.com` URLs and then falls back to a free-text `pull/<number>` matcher that assigns the default repository.
new or changed tests: add canonical internal Diffs URL cases to the existing PR-reference parser tests and keep legacy Diffs URLs supported.
focused red command: run the PR-reference parser test file that owns `pr-ref.js`.
expected red failure: the canonical internal Diffs URL is currently parsed as the default repository rather than its embedded `<owner>/<repo>`.
no-test waiver: not applicable.

## Review source

- Codex P2 on stream PR #2349: canonical internal Diffs URLs emitted by the retired standalone cockpit are not recognized by `pr-ref.js`, causing non-default repo references to silently fall back to `consuelohq/opensaas`.

- 2026-09-01 01:09:31 append: `.task/os/fix-internal-diffs-pr-url-parsing/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 01:09:31 fs.write: `.task/os/fix-internal-diffs-pr-url-parsing/workpad.md`
- 2026-09-01 01:11:30 fs.write: `.task/os/fix-internal-diffs-pr-url-parsing/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/lib/pr-ref.js`

## workspace-owned: validation evidence

- 2026-09-01 01:11:15 `review.run`: passed — OK
- 2026-09-01 01:11:25 `verify`: passed — OK

## Validation evidence

- RED: canonical `internal.consuelohq.com/diffs/<owner>/<repo>/pull/<number>` cases failed because the URL fell through to free-text parsing and lost the embedded repository (trace `trc_2b6e54fe253a`).
- GREEN: `packages/workspace/tests/pr-ref.test.js` passes 4/4 after recognizing the canonical internal host and `/diffs` prefix while preserving repository validation (trace `trc_327ae5210bcf`).
- Strict review vs `origin/stream/os`: 0 issues / 0 blockers (trace `trc_3ccbebb2e27a`).
- Formal verify vs `origin/stream/os`: passed, publishValid=true (trace `trc_e64010fee0c4`).

- 2026-09-01 01:11:30 append: `.task/os/fix-internal-diffs-pr-url-parsing/workpad.md`
