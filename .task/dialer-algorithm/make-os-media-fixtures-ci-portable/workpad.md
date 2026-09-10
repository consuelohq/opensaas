# make OS media fixtures CI portable

branch: `task/dialer-algorithm/make-os-media-fixtures-ci-portable`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2068/make-os-media-fixtures-ci-portable
github pr: https://github.com/consuelohq/opensaas/pull/2068
started: 2026-08-15

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

- 2026-08-15 10:41:54 fs.write: `.task/dialer-algorithm/make-os-media-fixtures-ci-portable/workpad.md`
- 2026-08-15 10:43:50 fs.write: `.task/dialer-algorithm/make-os-media-fixtures-ci-portable/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 10:43:44 `review.run`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `packages/os` media SVG-convert tests must create deterministic PNG fixtures in GitHub CI without assuming a host `ffmpeg` binary exists, while preserving the media conversion behavior under test.
existing local pattern: prefer repository-owned/static deterministic test fixtures over invoking optional host binaries from unit tests; do not change production media conversion code to satisfy CI environment gaps.
new or changed tests: update only `packages/os/tests/media/31-svg-convert.test.ts` fixture setup, unless inspection shows an existing reusable fixture/helper.
focused red command: reproduce the specific `tests/media/31-svg-convert.test.ts` failures with `ffmpeg` unavailable from PATH.
expected red failure: `spawnSync('ffmpeg', ...)` returns `status: null`, causing `ffmpeg should generate fixture PNG` assertions to fail before the actual SVG conversion assertions run.
no-test waiver: not applicable; the existing failing media tests are the executable contract.

## CI blocker evidence

- Stream PR #2014 workspace-contracts failure selected `@consuelo/os` package test.
- Failure is in `tests/media/31-svg-convert.test.ts`: fixture helper shells out to `ffmpeg`; GitHub runner reports `status: null`, so fixture generation fails.
- Dialer production/runtime code is not implicated. Fix test portability; do not weaken workspace verify or skip the OS package suite.

- 2026-08-15 10:41:54 append: `.task/dialer-algorithm/make-os-media-fixtures-ci-portable/workpad.md`

## workspace-owned: files read

- `packages/os/tests/media/31-svg-convert.test.ts`
- `packages/os/tests/media/helpers.ts`

- 2026-08-15 10:42:45 apply-patch: `packages/os/tests/media/31-svg-convert.test.ts`

## Validation before publish

- Production source changes: none.
- Test change: replace `ffmpeg`-generated 8x8 white/black PNG fixture with an equivalent deterministic embedded PNG in `tests/media/31-svg-convert.test.ts`.
- RED proof with `ffmpeg` absent: `writes an exact SVG image wrapper` failed at fixture generation exactly as GitHub CI did.
- GitHub failure enumeration: only three failing test sections, all in `tests/media/31-svg-convert.test.ts`, all caused by `ffmpeg should generate fixture PNG`.
- GREEN with normal toolchain: full `31-svg-convert.test.ts` = 11/11 passed.
- GREEN with `ffmpeg` absent: the exact three GitHub-failing cases = 3/3 passed.
- Strict review against `origin/stream/dialer-algorithm`: one changed test file, zero issues/blockers.
- Broad `@consuelo/os` package test remains delegated to GitHub CI because the package includes unrelated destructive-literal guardrail tests that are not safe to execute casually from the local agent environment.

- 2026-08-15 10:43:50 append: `.task/dialer-algorithm/make-os-media-fixtures-ci-portable/workpad.md`
