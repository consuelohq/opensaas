# fix clack input

branch: `task/os/fix-clack-input`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/736/fix-clack-input
github pr: https://github.com/consuelohq/opensaas/pull/736
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

- 2026-06-03 08:05:59 fs.write: `.task/os/fix-clack-input/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 08:06:28 `review.run`: passed — OK
- 2026-06-03 08:06:48 `verify`: passed — OK

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

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/install.ts`


## TDD contract

Behavior under test: hosted human install keeps Clack, and the Clack onboarding process should receive keyboard events when the bootstrap script is executed through `curl | bash`.

Red evidence from real release: the installer now reaches the Clack screen and renders the OS mode prompt, but arrow keys/Enter do not move or submit the selection in the user's terminal.

Hypothesis: binding only fd 0 to `/dev/tty` is not enough for Bun/Clack raw key handling under `curl | bash`. Clack needs the child process to run inside a real pseudo-terminal.

Red test first: updated `packages/os/scripts/install-tty.test.ts` to require the hosted human onboarding path to use a `run_install_with_script_pty` wrapper and `script -q /dev/null`, while continuing to guard against the previous Bun stdout/stderr `/dev/tty` redirect crash.

Implementation summary:
- `bootstrap.sh` now adds `run_install_with_script_pty()`.
- The wrapper uses macOS `script -q /dev/null "$BUN_BIN" --cwd "$os_dir" ./scripts/install.ts --home "$os_home" < /dev/tty`.
- `run_install_with_tty()` still performs the existing `/dev/tty` preflight, then delegates to the PTY wrapper.
- Non-interactive `--yes` and JSON paths are unchanged.

Validation completed:
- Confirmed `script -q /dev/null echo script-pty-ok` works in the task environment.
- `bun test packages/os/scripts/install-tty.test.ts` passed: 8 tests, 34 assertions.
- `bash -n packages/os/scripts/bootstrap.sh` passed.
- `bun packages/os/scripts/install.ts --check-tty` passed and printed only safe terminal diagnostics.
- `bash packages/os/scripts/bootstrap.sh --dry-run` passed.
- `git diff --check` passed.

Boundary: no daemon unload/delete/reinstall was performed.

- 2026-06-03 08:05:59 append: `.task/os/fix-clack-input/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-clack-input/current.json`, `.task/os/fix-clack-input/evidence-log.json`, `.task/os/fix-clack-input/read-log.json`, `.task/os/fix-clack-input/session.json`, `.task/os/fix-clack-input/workpad.md`, `.task/tasks/os/fix-clack-input.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-tty.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
