# fix hosted bootstrap dry run outside repository

branch: `task/os/fix-hosted-bootstrap-dry-run-outside-repository`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1737/fix-hosted-bootstrap-dry-run-outside-repository
github pr: https://github.com/consuelohq/opensaas/pull/1737
started: 2026-07-29

## acceptance criteria

- [x] A hosted `--dry-run --yes --install-daemons --mode local` exits successfully when run outside any repository and the staged source directory does not exist.
- [x] The hosted dry-run reports source, dependency, onboarding, and daemon work as planned without downloading source, invoking Bun, installing services, or creating the staged source directory.
- [x] Repo-local dry-runs continue executing the real daemon dry-run so generated LaunchAgents are linted when source is available.
- [x] Non-dry-run source download, runtime promotion, onboarding, Caddy, Cloudflared, Portless, and daemon installation behavior is unchanged.
- [x] Focused red-green tests, broader installer tests, strict review, and workspace verification pass before promotion.
- [ ] The fix reaches `main`, the live hosted bootstrap matches `main`, and the clean external-cwd dry-run passes live.

## plan

1. Reproduce the live external-cwd failure and map the hosted dry-run source/daemon branches.
2. Extend the existing clean hosted dry-run regression to request daemon installation and assert honest `would_run` status.
3. Make the daemon dry-run skip source-dependent execution only when the hosted source is intentionally absent.
4. Run focused and broader installer gates, strict review, verify, promote, and repeat the live external-cwd dry-run.

## current status

- Implementation and owned validation are green. The missing-source daemon dry-run now reports the exact planned command and `would_run` state; when source exists, the real daemon dry-run is still executed.

## files changed

- Live reproduction: hosted bootstrap from `/tmp` exited 1 at `cd: .../consuelo-os-source/packages/os: No such file or directory`.
- Existing regression covered the same absent-source path only with `--skip-daemons`, leaving the public `--install-daemons` dry-run untested.
- The correct boundary is `run_daemon_dry_run`: preserve real local-source validation, but report `would_run` when the staged daemon installer does not exist during hosted dry-run.

## workspace-owned: files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`

## workspace-owned: activity log

- Hosted dry-run checks for the staged daemon installer before changing directories.
- Missing hosted source records `DAEMON_STATUS=would_run` and the exact future daemon command without invoking it.
- Existing source continues through `install-system-daemons.sh --dry-run --quiet` and records `DAEMON_STATUS=dry_run`.

## workspace-owned: validation evidence

- RED: live `https://install.consuelohq.com/os` from `/tmp` exited 1 at the absent `consuelo-os-source/packages/os` directory after planning the source download.
- GREEN: focused clean hosted dry-run regression — 1 pass, 18 filtered, 0 fail.
- GREEN: full `installer-runtime-dependencies.test.ts` — 19 pass, 0 fail.
- GREEN: bootstrap source, compact daemon output, and TTY contracts — 29 pass, 1 existing skip, 0 fail.
- GREEN: `bun run --cwd packages/os typecheck` — workspace script syntax checks passed.
- GREEN: strict review against `origin/stream/os` — 0 owned issues, 0 blocking issues.
- GREEN: workspace verification — publish-valid stamp written; review, selected OS package gate, and database guard passed.
- 2026-07-29 10:34:28 `verify`: passed — OK
- 2026-07-29 10:34:34 `review.run`: passed — OK
- 2026-07-29 10:34:55 `verify`: passed — OK

## key decisions

- Broader exploratory onboarding batch had 68 passes and 2 failures in untouched baseline assertions: stale skill prompt copy and daemon log fixture behavior. They are outside this bounded hosted dry-run change; strict review will classify the task diff independently.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-29 10:30:32 apply-patch: `.task/os/fix-hosted-bootstrap-dry-run-outside-repository/workpad.md`
- 2026-07-29 10:30:44 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-07-29 10:31:06 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-07-29 10:31:40 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-07-29 10:31:59 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-07-29 10:33:11 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-07-29 10:33:59 apply-patch: `.task/os/fix-hosted-bootstrap-dry-run-outside-repository/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-hosted-bootstrap-dry-run-outside-repository/current.json`, `.task/os/fix-hosted-bootstrap-dry-run-outside-repository/session.json`, `.task/os/fix-hosted-bootstrap-dry-run-outside-repository/verify.json`, `.task/os/fix-hosted-bootstrap-dry-run-outside-repository/workpad.md`, `.task/tasks/os/fix-hosted-bootstrap-dry-run-outside-repository.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
