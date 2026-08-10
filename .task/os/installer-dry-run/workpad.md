# installer dry run

branch: `task/os/installer-dry-run`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1393/installer-dry-run
github pr: https://github.com/consuelohq/opensaas/pull/1393
started: 2026-07-11

## acceptance criteria

- [x] Hosted clean-machine `--dry-run` succeeds when no repository checkout or source directory exists.
- [x] Dry-run reports planned source download, dependency installation, and onboarding without invoking Bun in a nonexistent directory.
- [x] Repo-local dry-run continues to execute the real `install.ts --dry-run` simulation.
- [x] No non-dry-run install behavior, source download behavior, daemon behavior, or credential handling changes.
- [x] Regression test, installer runtime suite, shell syntax, review, and full verify pass.
- [ ] Change is promoted through the task workflow and merged to `main` after green checks.

## plan

1. Add a clean-machine dry-run regression test that executes bootstrap from an isolated directory with an isolated home and absent source.
2. Confirm the current failure is the observed `ENOENT` from invoking Bun in the planned source directory.
3. Change only dry-run onboarding so it executes Bun when `install.ts` exists and otherwise reports the planned command.
4. Run focused and related installer tests, shell syntax, isolated hosted dry-run, review, and verify.
5. Push, promote, merge, and rerun the hosted clean-machine dry-run against production.

## test-first contract

- Behavior under test: a hosted clean-machine dry-run with Bun available but no checkout/source must remain non-mutating and exit successfully.
- Existing local pattern: `packages/os/tests/installer-runtime-dependencies.test.ts` invokes `bootstrap.sh` with isolated homes and environment overrides using `spawnSync`.
- New test: run from an isolated working directory with `CONSUELO_OS_SOURCE_DIR` pointing to an absent path; assert exit 0, `sourceStatus=would_download`, `dependencyStatus=would_install`, `onboardingStatus=would_run`, and no source directory creation.
- Focused red command: `bun run --cwd packages/os vitest run tests/installer-runtime-dependencies.test.ts`.
- Expected red failure: bootstrap invokes the Bun executable even though planned source is absent; the deterministic fake Bun exits 42.

## current status

- Production OS release, runtime auth, and website-only release are healthy.
- Added a source-existence guard only in dry-run onboarding.
- Hosted isolated dry-run now reports `would_download`, `would_install`, and `would_run` without creating source or invoking Bun.
- Repo-local dry-run still executes the real installer simulation and reports `dry_run`.
- Focused and adjacent tests, shell syntax, typecheck, review, and full verify pass with a publish-valid stamp.
- Explicit evidence: 13/13 runtime dependency tests and 12/12 bootstrap source tests pass; isolated hosted and repo-local dry-run modes pass.

## files changed

- `.task/os/installer-dry-run/workpad.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

## workspace-owned: files changed

- `.task/os/installer-dry-run/workpad.md`

## workspace-owned: activity log

- 2026-07-11 00:29:13 fs.write: `.task/os/installer-dry-run/workpad.md`

## workspace-owned: validation evidence

- 2026-07-11 00:34:02 `review.run`: passed — OK
- 2026-07-11 00:34:50 `verify`: passed — OK
- 2026-07-11 00:35:13 `verify`: passed — OK

## key decisions

- Preserve real repo-local dry-run execution; skip only impossible child execution when source is merely planned.
- Do not download source during dry-run because that would violate the non-mutating contract.
- Keep website credential validation separate from this installer code task.
- Treat the opt-in workspace-bootstrap source-order failure as separate brittle test debt; runtime code still invokes device login before workspace identity resolution.

## notes for ko

- No token values are read or recorded.
- The existing installer release checklist is present at `packages/os/docs/installer-runtime-release-checklist.md` on current `main`.

## improvements noticed

- none yet

## issues and recovery

- Earlier local checkout evidence was stale relative to current `main`; the task branch confirms the checklist file exists.
- The first regression attempt accidentally used the Vitest Node executable path and did not force Bun presence; replacing it with a fake Bun produced valid red evidence.
- Opt-in `install-workspace-bootstrap-contract.test.ts` has one pre-existing source-order assertion failure; this task does not touch `install.ts` or that behavior.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): keep hosted installer dry run non-mutating" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-11 00:29:13 write: `.task/os/installer-dry-run/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-07-11 00:34:35 apply-patch: `.task/os/installer-dry-run/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/installer-dry-run/current.json`, `.task/os/installer-dry-run/evidence-log.json`, `.task/os/installer-dry-run/read-log.json`, `.task/os/installer-dry-run/session.json`, `.task/os/installer-dry-run/verify.json`, `.task/os/installer-dry-run/workpad.md`, `.task/tasks/os/installer-dry-run.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
