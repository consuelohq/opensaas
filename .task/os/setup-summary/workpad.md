# setup summary

branch: `task/os/setup-summary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/717/setup-summary
github pr: https://github.com/consuelohq/opensaas/pull/717
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

- 2026-06-03 00:36:00 fs.write: `.task/os/setup-summary/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 00:42:46 `review.run`: passed — OK
- 2026-06-03 00:42:47 `review.run`: passed — OK
- 2026-06-03 00:42:47 `review.run`: passed — OK
- 2026-06-03 00:42:47 `review.run`: passed — OK
- 2026-06-03 00:44:00 `verify`: failed — COMMAND_FAILED
- 2026-06-03 00:44:00 `verify`: failed — COMMAND_FAILED
- 2026-06-03 00:44:00 `verify`: failed — COMMAND_FAILED
- 2026-06-03 00:44:00 `verify`: failed — COMMAND_FAILED

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

- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/scripts/workspace-watchdog.sh`

## Test-first contract

Behavior under test: hosted Consuelo OS setup should show human onboarding during interactive curl installs, preserve `--yes` automation, finish with a safe summary, and keep raw LaunchAgent diagnostics behind debug mode.

Existing pattern to follow: `bootstrap.sh` owns hosted curl flow and summary state; `install-system-daemons.sh` owns LaunchAgent setup and health checks; `packages/os/package.json` owns user-runnable OS scripts.

Focused red evidence: the `/tmp` curl run used `install.ts --yes`, skipped interactive prompts, printed raw `launchctl` state, and showed service `EX_CONFIG` details in the normal user path.

Intended tests: shell syntax for changed shell scripts; bootstrap dry-run; daemon dry-run; cleanup dry-run; normal daemon output hides raw `launchctl` state; debug mode preserves diagnostics; package scripts exist.

Stop condition: do not change the currently loaded services on Ko's Mac during validation.

- 2026-06-03 00:36:00 append: `.task/os/setup-summary/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/setup-summary/current.json`, `.task/os/setup-summary/evidence-log.json`, `.task/os/setup-summary/read-log.json`, `.task/os/setup-summary/session.json`, `.task/os/setup-summary/workpad.md`, `.task/tasks/os/setup-summary.json`, `packages/os/package.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/uninstall-system-daemons.sh`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
