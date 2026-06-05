# wire clack tty

branch: `task/os/wire-clack-tty`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/729/wire-clack-tty
github pr: https://github.com/consuelohq/opensaas/pull/729
started: 2026-06-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/install-tty.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/install-tty.test.ts`

## workspace-owned: activity log

- 2026-06-03 06:37:17 fs.write: `packages/os/scripts/install-tty.test.ts`
- 2026-06-03 06:43:30 fs.write: `.task/os/wire-clack-tty/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 06:44:09 `review.run`: passed — OK
- 2026-06-03 06:44:36 `verify`: passed — OK

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
- `packages/os/scripts/install.ts`

- 2026-06-03 06:37:17 write: `packages/os/scripts/install-tty.test.ts`


## TDD contract

Behavior under test: hosted human install keeps the Clack onboarding UI, but runs the Clack process with stdin, stdout, and stderr attached to the controlling terminal so keyboard input works under the hosted curl flow.

Red tests first: added `packages/os/scripts/install-tty.test.ts` with seven assertions. Initial run failed because `run_install_with_tty()` did not exist. After implementation, all seven assertions pass.

Implementation summary:
- `bootstrap.sh` now has `run_install_with_tty()` and uses it for interactive onboarding.
- The wrapper runs `install.ts` with `< /dev/tty > /dev/tty 2> /dev/tty`.
- `install.ts` now supports `--check-tty` safe diagnostics.
- `install.ts` now preflights TTY readiness before rendering Clack prompts, while preserving `--yes` and `--json` non-interactive paths.

Validation completed:
- `bun test packages/os/scripts/install-tty.test.ts` passed: 7 tests, 25 assertions.
- `bash -n packages/os/scripts/bootstrap.sh` passed.
- `bun packages/os/scripts/install.ts --check-tty` passed and printed only terminal diagnostics.
- `bun packages/os/scripts/install.ts --dry-run --yes --json` passed.
- `bash packages/os/scripts/bootstrap.sh --dry-run` passed.
- `git diff --check` and `git diff --cached --check` passed.

Boundary: no daemon unload/delete/reinstall was performed.

- 2026-06-03 06:43:30 append: `.task/os/wire-clack-tty/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/wire-clack-tty/current.json`, `.task/os/wire-clack-tty/evidence-log.json`, `.task/os/wire-clack-tty/read-log.json`, `.task/os/wire-clack-tty/session.json`, `.task/os/wire-clack-tty/workpad.md`, `.task/tasks/os/wire-clack-tty.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-tty.test.ts`, `packages/os/scripts/install.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
