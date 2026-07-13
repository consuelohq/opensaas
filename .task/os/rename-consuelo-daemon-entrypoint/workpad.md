# rename consuelo daemon entrypoint

branch: `task/os/rename-consuelo-daemon-entrypoint`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/711/rename-consuelo-daemon-entrypoint
github pr: https://github.com/consuelohq/opensaas/pull/711
started: 2026-06-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/install-system-daemons.sh`

## workspace-owned: files changed

- `packages/os/scripts/install-system-daemons.sh`

## workspace-owned: activity log

- 2026-06-02 21:48:54 fs.write: `.task/os/rename-consuelo-daemon-entrypoint/workpad.md`
- 2026-06-02 21:49:14 fs.patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-02 21:49:37 fs.patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-02 21:50:56 fs.write: `.task/os/rename-consuelo-daemon-entrypoint/workpad.md`

## workspace-owned: validation evidence

- 2026-06-02 21:52:07 `review.run`: passed — OK
- 2026-06-02 21:52:07 `review.run`: passed — OK
- 2026-06-02 21:54:53 `review.run`: passed — OK
- 2026-06-02 21:54:53 `review.run`: passed — OK
- 2026-06-02 21:54:53 `review.run`: passed — OK
- 2026-06-02 21:57:38 `verify`: failed — COMMAND_FAILED
- 2026-06-02 21:58:42 `verify`: failed — COMMAND_FAILED
- 2026-06-02 21:58:43 `verify`: failed — COMMAND_FAILED
- 2026-06-02 21:58:43 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/start-brain-daemon.sh`

## Test-first contract

Behavior under test: the OS LaunchAgent installer should use the Consuelo daemon entrypoint name and run the staged daemon through `bash`, matching generated LaunchAgent execution, so non-executable script file modes do not make the smoke test fail before LaunchAgents are installed.

Existing pattern to follow: generated LaunchAgent plists execute `/bin/bash` with the script path as an argument. The staging smoke should use the same execution model.

Focused red evidence: hosted curl install failed after prompt during `install-system-daemons.sh`; `/tmp/consuelo-os-stage.log` showed `Permission denied` for `start-brain-daemon.sh`; scripts are `-rw-r--r--`; launchctl did not contain the new OS labels.

Intended tests: search for legacy `start-brain-daemon` references, bash syntax checks for installer/generator/start scripts, installer `--dry-run`, generated plist lint, and a staged smoke command that starts the renamed daemon through `bash` on a temporary port without copying/loading LaunchAgents.

Stop condition: do not install, unload, or reload LaunchAgents in validation without Ko approval.

- 2026-06-02 21:48:54 append: `.task/os/rename-consuelo-daemon-entrypoint/workpad.md`

- 2026-06-02 21:49:14 patch lines 139-152: `packages/os/scripts/install-system-daemons.sh`

- 2026-06-02 21:49:37 patch lines 139-139: `packages/os/scripts/install-system-daemons.sh`


## Validation evidence

- Confirmed `start-brain-daemon` has no remaining matches under `packages/os`.
- Confirmed `start-consuelo-daemon` appears in exactly the installer syntax check, installer stage smoke invocation, and generated LaunchAgent ProgramArguments.
- Passed `bash -n` for `install-system-daemons.sh`, `generate-system-daemons.sh`, and `start-consuelo-daemon.sh`.
- Passed `bash packages/os/scripts/install-system-daemons.sh --dry-run`; it generated and linted plists without installing services.
- Passed stage-only smoke by running `WORKSPACE_DAEMON_PORT=8961 bash packages/os/scripts/start-consuelo-daemon.sh` from the task worktree and polling `/health`; no LaunchAgents were installed, unloaded, or loaded.
- Passed `git diff --check` and `git diff --cached --check`.

## Recovery note

Initial line-number patches hit the wrong shell-file lines after rename. Restored `install-system-daemons.sh` from task branch base and reapplied changes using exact string replacement via a temp Python script.

- 2026-06-02 21:50:56 append: `.task/os/rename-consuelo-daemon-entrypoint/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/rename-consuelo-daemon-entrypoint/current.json`, `.task/os/rename-consuelo-daemon-entrypoint/evidence-log.json`, `.task/os/rename-consuelo-daemon-entrypoint/read-log.json`, `.task/os/rename-consuelo-daemon-entrypoint/session.json`, `.task/os/rename-consuelo-daemon-entrypoint/workpad.md`, `.task/tasks/os/rename-consuelo-daemon-entrypoint.json`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/start-consuelo-daemon.sh`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: no testable source files changed
