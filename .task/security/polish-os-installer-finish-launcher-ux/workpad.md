# polish os installer finish launcher ux

branch: `task/security/polish-os-installer-finish-launcher-ux`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1175/polish-os-installer-finish-launcher-ux
github pr: https://github.com/consuelohq/opensaas/pull/1175
started: 2026-06-23

## acceptance criteria

- [x] Default hosted installer success output prints only `Consuelo OS setup complete` and `Home: <path>`.
- [x] Successful interactive local install opens the workspace launcher URL as the final installer action.
- [x] JSON, dry-run, and non-interactive automation paths do not open a browser.
- [x] Hosted installer release dry-run verifies the generated Worker payload before publish.

## plan

1. Add a focused bootstrap source contract for the minimal finish summary and launcher-open ordering.
2. Update the bootstrap summary and URL-opening helpers.
3. Validate bootstrap source tests, shell syntax, installer runtime contracts, and release dry-run.

## test-first contract

Behavior under test:
- The bootstrap success summary is minimal for humans.
- The bootstrap opens the approved workspace launcher only after summary printing and only for interactive successful installs.

Existing local pattern to follow:
- Source-level bootstrap contracts in `packages/os/tests/bootstrap-source.test.ts` pin installer UX order and release constants.

Focused red command:
`bun --cwd packages/os test tests/bootstrap-source.test.ts`

Expected red failure before implementation:
- `print_success_summary` still contains verbose fields such as `Package:`, `Config:`, `Database:`, `Logs:`, `Services:`, and `Doctor:`.
- `main` does not call a launcher-opening step after summary printing.

## current status

- Implemented bootstrap summary and launcher-open changes; focused bootstrap source test is green.
- Review and verify passed against `origin/main`; ready to push, merge, and release.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/tests/bootstrap-source.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red test: `bun --cwd packages/os test tests/bootstrap-source.test.ts` failed before implementation because `print_success_summary` still emitted verbose fields and `main` did not open the launcher after the summary.
- Green focused tests: `bun --cwd packages/os test tests/bootstrap-source.test.ts` passed, 7 tests.
- Installer runtime contracts: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/installer-runtime-dependencies.test.ts` passed, 12 tests.
- Shell syntax: `bash -n packages/os/scripts/bootstrap.sh` passed.
- Dry-run JSON path: `bash packages/os/scripts/bootstrap.sh --dry-run --yes --json` passed without opening a browser.
- Release dry-run: `bun run os:release-install -- --dry-run` passed; generated installer SHA `70a1831452d2bf5abb57c73a957f157a773b9c253c6cf0ad00d5b2df9818dff6`.
- 2026-06-23 01:38:19 `review.run`: passed — OK
- 2026-06-23 01:38:29 `verify`: passed — OK

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
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-23 01:29:48 apply-patch: `packages/os/tests/bootstrap-source.test.ts`
- 2026-06-23 01:30:14 apply-patch: `packages/os/tests/bootstrap-source.test.ts`
- 2026-06-23 01:31:10 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-23 01:31:29 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-23 01:31:45 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-23 01:33:05 apply-patch: `packages/os/tests/bootstrap-source.test.ts`

- 2026-06-23 01:36:42 apply-patch: `.task/security/polish-os-installer-finish-launcher-ux/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/polish-os-installer-finish-launcher-ux/current.json`, `.task/security/polish-os-installer-finish-launcher-ux/session.json`, `.task/security/polish-os-installer-finish-launcher-ux/workpad.md`, `.task/tasks/security/polish-os-installer-finish-launcher-ux.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/bootstrap-source.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-06-23 01:39:17 apply-patch: `.task/security/polish-os-installer-finish-launcher-ux/workpad.md`