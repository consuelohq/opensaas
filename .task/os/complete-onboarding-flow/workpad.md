# complete onboarding flow

branch: `task/os/complete-onboarding-flow`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/751/complete-onboarding-flow
github pr: https://github.com/consuelohq/opensaas/pull/751
started: 2026-06-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/onboarding-flow.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/onboarding-flow.test.ts`

## workspace-owned: activity log

- 2026-06-03 19:50:53 fs.write: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-03 20:05:18 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 20:07:10 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 20:11:08 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 20:15:06 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 20:15:48 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 20:22:21 fs.write: `packages/os/scripts/install-tty.test.ts`
- 2026-06-03 20:24:10 fs.write: `.task/os/complete-onboarding-flow/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 20:25:24 `verify`: passed — OK

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
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`

- 2026-06-03 20:15:06 patch lines 344-344: `packages/os/scripts/bootstrap.sh`

- 2026-06-03 20:15:48 patch lines 344-344: `packages/os/scripts/bootstrap.sh`

- 2026-06-03 20:22:21 write: `packages/os/scripts/install-tty.test.ts`


## TDD contract

Behavior under test: hosted Consuelo OS install should be one coherent Clack onboarding flow, not a banner plus an external daemon prompt.

Red tests first: added `packages/os/scripts/onboarding-flow.test.ts`. Initial run failed because skills/artifacts were banner-only, agent multiselect lacked Space/Enter copy, daemon intent was not part of install.ts, normal install printed every provision action, and daemon output did not use the compact background-service wording.

Implementation summary:
- Added real skills and artifact prompts to `install.ts`.
- Added explicit agent multiselect help: Space selects agents, Enter continues.
- Added final `install local background service?` confirmation to the Clack flow.
- `install.ts` now writes onboarding intent JSON through `CONSUELO_ONBOARDING_RESULT_FILE` and includes `installDaemons` in JSON output.
- `bootstrap.sh` now consumes onboarding JSON intent and uses it to decide whether to run LaunchAgent setup, instead of asking a second raw shell prompt in normal human flow.
- Normal install output now prints one compact saved-to summary instead of every created/preserved folder.
- Daemon summary now says `background service setup complete`.

Validation completed:
- `bun test packages/os/scripts/onboarding-flow.test.ts` passed: 6 tests, 19 assertions.
- `bun test packages/os/scripts/install-tty.test.ts` passed: 8 tests, 34 assertions.
- `bash -n packages/os/scripts/bootstrap.sh` passed.
- `bash -n packages/os/scripts/install-system-daemons.sh` passed.
- `bun packages/os/scripts/install.ts --dry-run --yes --json --install-daemons` passed and returned `installDaemons: true` in JSON.
- `git diff --check` passed.

Boundary: no daemon unload/delete/reinstall was performed.

- 2026-06-03 20:24:10 append: `.task/os/complete-onboarding-flow/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/complete-onboarding-flow/current.json`, `.task/os/complete-onboarding-flow/evidence-log.json`, `.task/os/complete-onboarding-flow/read-log.json`, `.task/os/complete-onboarding-flow/session.json`, `.task/os/complete-onboarding-flow/workpad.md`, `.task/tasks/os/complete-onboarding-flow.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/install-tty.test.ts`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/onboarding-flow.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
