# Improve consuelo help UX

branch: `task/os/improve-consuelo-help-ux`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1853/improve-consuelo-help-ux
github pr: https://github.com/consuelohq/opensaas/pull/1853
started: 2026-08-11

## acceptance criteria

- [x] Replace the lifecycle root help wall of invocation permutations with a compact Codex-style command index.
- [x] Preserve every existing lifecycle command and parser behavior.
- [x] Include the new `add skill` and `remove skill` commands as first-class entries, with picker-by-default wording.
- [x] Include concise global Options and release Channels sections without exposing internal-only flags.
- [x] Make bare-command behavior discoverable: no command means status.
- [x] Add focused regression coverage for both `consuelo help` and `consuelo --help`.
- [x] Pass focused tests, review, and full verify; merge into `stream/os` remains.

## plan

1. Characterize the current static lifecycle help and installed CLI routing.
2. Add a focused RED test for the desired root-help contract.
3. Replace only the static lifecycle help copy; do not change parsing or command execution.
4. Reproduce the exact CLI output and run focused lifecycle tests.
5. Review, verify, push, and merge the task into `stream/os`.

## current status

- Implementation and validation are complete. Strict review and full verify are clean; publish/merge remains.

## files changed

- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/lifecycle-help.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-11 23:59:59 `review.run`: passed — OK
- 2026-08-12 00:00:20 `verify`: passed — OK

## key decisions

- The user-visible help shown is the static `HELP` string in `packages/os/scripts/lifecycle.ts`; Commander is a separate top-level CLI surface.
- Keep help uncolored for stable piping/copying. Use spacing and concise descriptions rather than terminal decoration.
- Do not claim command-specific help exists; current `<command> --help` resolves to root help.

## validation evidence

- RED: `tests/lifecycle-help.test.ts` -> 0/1 against the old per-command Usage wall.
- GREEN: focused help test -> 1/1, 21 assertions.
- GREEN: lifecycle help + skill selection + lifecycle engine -> 58/58, 192 assertions.
- GREEN: exact `bun scripts/lifecycle.ts help` output matches the intended command-index layout.
- GREEN: `git diff --check`.
- GREEN: strict review -> 0 owned issues, 0 blocking issues.
- GREEN: full verify against `origin/stream/os` -> `passed: true`, `publishValid: true`, DB guard clean.
- Git ancestry check: `origin/stream/os` is the direct ancestor of the task (`0 behind / 1 ahead`); the workspace `behind: 16` sync counter was stale metadata.

## Test-first contract

- Behavior: `help` and `--help` return identical, compact root help with a purpose line, one Usage form, Commands, Options, and Channels.
- Existing pattern: call exported `runLifecycleCli()` with injected stdout/stderr, as other lifecycle tests do.
- New test: `packages/os/tests/lifecycle-help.test.ts`.
- Focused RED: `cd packages/os && bun test tests/lifecycle-help.test.ts`.
- Expected RED: current output lacks the Commands/Options sections and still contains per-command Usage lines.

## notes for ko

- Root help is intentionally plain text: no Chalk/color so piping, snapshots, and copy/paste stay stable.
- Exact rendered help was reproduced through `bun scripts/lifecycle.ts help`.

## improvements noticed

- The semantic `explore` query for lifecycle help was noisy; exact string/code inspection identified ownership immediately.

## issues and recovery

- RED established: `bun test tests/lifecycle-help.test.ts` -> 0/1. The failure shows the current `Consuelo OS lifecycle` heading and per-command Usage wall instead of the new compact sections.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/cli/src/index.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/skill-selection-cli.test.ts`
