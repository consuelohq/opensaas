# fix PR 2060 search portability

branch: `task/explore/fix-pr-2060-search-portability`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2290
started: 2026-08-29

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
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [ ] Preserve the now-green clean-checkout OS dependency preparation and helper-free `fs.list` behavior from task #2285.
- [ ] Make `fs.search` succeed on clean Linux nodes when the optional `rg` executable is absent, without weakening regex/search errors when `rg` is present.
- [ ] Preserve structured search output, result limits, path scoping, include filters, context, files-only behavior, and then-read semantics for the portable path.
- [ ] Keep Workspace/OS search parity intentional if the two implementations are still shared.
- [ ] Add deterministic missing-`rg` regression coverage, run focused red/green tests, review, verify, merge into `stream/explore`, then rerun PR #2060 CI and release to Canary only after all checks are green.

## Test-first contract

behavior under test: a valid work-session `fs.search` must return matches on a clean Linux runtime even when the external ripgrep binary is not installed. Optional helper absence must not make the typed filesystem tool fail.
existing local pattern: `packages/os/tests/fs-search.test.ts` drives the real `scripts/fs.js search` CLI against temporary files and parses structured JSON; `packages/os/tests/work-session-fs.test.ts` proves read/list/search use the trusted work-session root.
new or changed tests: add a real CLI regression that launches the absolute Bun executable with `PATH` stripped so child `rg` lookup fails, then assert the same structured match contract; expand only as needed for include/context/files-only/then-read parity.
focused red command: run the new missing-ripgrep case before implementation, plus the exact work-session read/list/search contract.
expected red failure: current `runRipgrepEffect` throws `Unable to run ripgrep` when `spawnSync('rg', ...)` returns ENOENT, causing the facade result `search.ok` to be false. This is exactly what GitHub jobs `99062647414` and `99062647415` report at `work-session-fs.test.ts:120` after `fs.list` became green.
no-test waiver: not applicable; both remote jobs provide deterministic red evidence and a local missing-helper case will reproduce it.

## remote red evidence

- PR #2060 Consuelo CI run `33238077255` completed with 49 checks green and exactly two failures: `Consuelo / workspace contracts` and `Consuelo / verify`.
- Both failures are identical: `packages/os/tests/work-session-fs.test.ts > uses the work-session path as the relative context for read, list, and search`, line 120 `expect(search.ok).toBe(true)` received `false`.
- The previous blockers are resolved in this run: OS dependencies installed including `tree-sitter`, and the preceding `fs.list` assertion passes on Ubuntu.

- 2026-08-29 06:28:44 append: `.task/explore/fix-pr-2060-search-portability/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:28:44 fs.write: `.task/explore/fix-pr-2060-search-portability/workpad.md`
- 2026-08-29 06:30:52 fs.write: `.task/explore/fix-pr-2060-search-portability/workpad.md`
- 2026-08-29 06:31:56 fs.write: `.task/explore/fix-pr-2060-search-portability/workpad.md`
- 2026-08-29 06:34:04 fs.write: `.task/explore/fix-pr-2060-search-portability/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/fs/search.ts`
- `packages/os/tests/fs-search.test.ts`
- `packages/workspace/scripts/lib/fs/search.ts`

## implementation and validation

- `packages/os/scripts/lib/fs/search.ts` and Workspace parity copy: ripgrep remains the primary backend. Only child-process `ENOENT` switches to a dependency-free portable backend; other spawn failures and ripgrep exit errors remain failures.
- Portable backend recursively traverses requested targets, skips standard excluded directories/symlinks/binary-like content, applies regex matching, include globs, context, files-only behavior, stable path ordering, result limits, and the existing then-read stage.
- `packages/os/tests/fs-search.test.ts`: the former missing-ripgrep transport-error test is now a real portable fallback regression with include filtering, context, and then-read assertions.
- `os-work-session-fs` test-selection ownership now includes both search implementations and `fs-search.test.ts`; generated registry refreshed so this change no longer wakes the broad OS package suite.
- `packages/os/SCRIPTS.md` documents ripgrep preference and portable fallback.

Red evidence: the new missing-ripgrep regression failed with process status 1 before the implementation, matching CI `search.ok=false`.
Green evidence: full `fs-search` 8/8; full `work-session-fs` 10/10; selector suite 68/68. Combined focused run 86/86. Search implementations are byte-identical. Test-selection reports `broadOs=false`.

- 2026-08-29 06:30:52 append: `.task/explore/fix-pr-2060-search-portability/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 06:31:21 `review.run`: passed — OK
- 2026-08-29 06:31:34 apply-patch: `packages/os/scripts/lib/fs/search.ts`
- 2026-08-29 06:31:34 apply-patch: `packages/workspace/scripts/lib/fs/search.ts`
- 2026-08-29 06:33:12 `review.run`: passed — OK
- 2026-08-29 06:33:55 `verify`: passed — OK

## transport wait plan

Wait reason: OS OAuth introspection returned the same transient 401 on two consecutive read-only `review.run` attempts after all focused tests passed.
Duration: 30 seconds.
Resume action: immediately retry `review.run` for this task; if it succeeds, run `verify` next.
Expected signal: OS facade accepts the call and review returns 0 blockers.
Fallback: if OAuth introspection remains unavailable, do not mutate or release; record the outage and retry with another bounded cycle only after verifying transport recovery.

- 2026-08-29 06:31:56 append: `.task/explore/fix-pr-2060-search-portability/workpad.md`

## final gate

- [x] Missing-ripgrep behavior reproduced red locally and from Ubuntu CI.
- [x] Portable search fallback implemented in byte-identical OS/Workspace search modules; only ENOENT falls back.
- [x] Full focused tests: 86/86 passed.
- [x] Test-selection maps search portability to `os-work-session-fs`; broad OS package suite is not selected.
- [x] Final review: 0 issues / 0 blockers.
- [x] Final verify: passed, `publishValid=true`, DB guard 0 risks / 0 findings.

- 2026-08-29 06:34:04 append: `.task/explore/fix-pr-2060-search-portability/workpad.md`
