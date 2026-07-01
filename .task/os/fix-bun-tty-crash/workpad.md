# fix bun tty crash

branch: `task/os/fix-bun-tty-crash`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/733/fix-bun-tty-crash
github pr: https://github.com/consuelohq/opensaas/pull/733
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

- 2026-06-03 07:18:00 fs.write: `.task/os/fix-bun-tty-crash/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 07:18:25 `review.run`: passed — OK
- 2026-06-03 07:18:41 `verify`: passed — OK

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

Behavior under test: hosted human install keeps Clack, but does not redirect Bun stdout/stderr to `/dev/tty`, because Bun 1.3.14 on macOS can crash with `EINVAL: invalid argument, kqueue` when those fds are redirected to `/dev/tty`.

Red evidence from real release: `curl -fsSL https://install.consuelohq.com/os | CONSUELO_OS_SOURCE_DIR=/tmp/consuelo-os-source-tty-test bash` downloaded source and dependencies, then crashed before Clack onboarding with `WriteStream ... EINVAL: invalid argument, kqueue`, followed by `restore-cursor` failing because `process.stderr` was undefined.

Red tests first: updated `packages/os/scripts/install-tty.test.ts` to reject Bun install/check commands that include `> /dev/tty` or `2> /dev/tty`. Test failed against the released wrapper before implementation.

Implementation summary:
- `bootstrap.sh` now binds only Bun stdin to `/dev/tty` for interactive install and debug TTY check.
- stdout/stderr remain inherited from the user terminal instead of being shell-redirected to `/dev/tty`.
- `install.ts` explicitly passes `process.stdin` and `process.stdout` to each Clack prompt after TTY preflight.

Validation completed:
- `bun test packages/os/scripts/install-tty.test.ts` passed: 8 tests, 33 assertions.
- `bash -n packages/os/scripts/bootstrap.sh` passed.
- `bun packages/os/scripts/install.ts --check-tty` passed and printed only safe terminal diagnostics.
- `bun packages/os/scripts/install.ts --dry-run --yes --json` passed.
- `bash packages/os/scripts/bootstrap.sh --dry-run` passed.
- `git diff --check` and `git diff --cached --check` passed.

Boundary: no daemon unload/delete/reinstall was performed.

- 2026-06-03 07:18:00 append: `.task/os/fix-bun-tty-crash/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-bun-tty-crash/current.json`, `.task/os/fix-bun-tty-crash/evidence-log.json`, `.task/os/fix-bun-tty-crash/read-log.json`, `.task/os/fix-bun-tty-crash/session.json`, `.task/os/fix-bun-tty-crash/workpad.md`, `.task/tasks/os/fix-bun-tty-crash.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-tty.test.ts`, `packages/os/scripts/install.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
