# compact background service install output

branch: `task/os/compact-background-service-install-output`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/752/compact-background-service-install-output
github pr: https://github.com/consuelohq/opensaas/pull/752
started: 2026-06-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`

## workspace-owned: activity log

- 2026-06-03 20:56:41 fs.write: `packages/os/scripts/compact-daemon-output.test.ts`
- 2026-06-03 20:58:05 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-03 20:58:30 fs.patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-03 20:59:44 fs.patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-03 21:00:06 fs.patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-03 21:00:29 fs.patch: `packages/os/package.json`
- 2026-06-03 21:01:13 fs.write: `packages/os/package.json`
- 2026-06-03 21:02:11 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 21:02:43 fs.patch: `packages/os/scripts/bootstrap.sh`
- 2026-06-03 21:06:00 fs.write: `.task/os/compact-background-service-install-output/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 21:06:37 `review.run`: passed — OK
- 2026-06-03 21:07:00 `verify`: passed — OK

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
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/cli-ui.ts`
- `packages/os/scripts/onboarding-flow.test.ts`

- 2026-06-03 21:02:43 patch lines 393-445: `packages/os/scripts/bootstrap.sh`

## Compact background service output

### Test-first contract

Behavior under test:
- Hosted bootstrap owns the final Consuelo OS setup summary.
- `install-system-daemons.sh --quiet` suppresses generated plist paths, plist lint lines, duplicate service/log/doctor/token summary, and smoke-test chatter on the success path.
- Debug mode preserves detailed daemon output.
- Hosted onboarding-result mode keeps the Clack answer transcript and saved-home line, then lets bootstrap print the final doctor/service summary.

Focused red command:

```bash
bun test packages/os/scripts/compact-daemon-output.test.ts
```

Expected red failure:
- Missing `install:system-daemons:quiet` script usage in bootstrap.
- Missing `--quiet` parsing and quiet success suppression in `install-system-daemons.sh`.
- Missing `suppressFinalSummary` in `install.ts`.

### Red evidence

`bun test packages/os/scripts/compact-daemon-output.test.ts` failed before implementation because bootstrap did not contain `install:system-daemons:quiet`.

### Green evidence

- `bun test packages/os/scripts/compact-daemon-output.test.ts`: 4 pass, 0 fail, 14 assertions.
- `bun test packages/os/scripts/compact-daemon-output.test.ts packages/os/scripts/onboarding-flow.test.ts packages/os/scripts/install-tty.test.ts`: 18 pass, 0 fail, 67 assertions.
- `bash -n packages/os/scripts/bootstrap.sh packages/os/scripts/install-system-daemons.sh`: pass.
- `bash packages/os/scripts/install-system-daemons.sh --dry-run --quiet`: pass, no generated plist paths printed.
- `bash packages/os/scripts/install-system-daemons.sh --dry-run --debug`: pass, generated plist details remain visible.
- `bun run --cwd packages/os install:system-daemons:quiet -- --dry-run`: pass.
- `CONSUELO_ONBOARDING_RESULT_FILE=/tmp/consuelo-onboarding-result-compact-test.json bun --cwd packages/os ./scripts/install.ts --yes --dry-run --home /tmp/consuelo-os-compact-home`: pass, prints saved-home only and suppresses early doctor/OS-ready outro.

### Documentation decision

No workspace docs update required. This changes OS installer output behavior and one OS package script alias, not workspace facade tooling, generated tool surfaces, or agent doctrine.

- 2026-06-03 21:06:00 append: `.task/os/compact-background-service-install-output/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/compact-background-service-install-output/current.json`, `.task/os/compact-background-service-install-output/evidence-log.json`, `.task/os/compact-background-service-install-output/read-log.json`, `.task/os/compact-background-service-install-output/session.json`, `.task/os/compact-background-service-install-output/workpad.md`, `.task/tasks/os/compact-background-service-install-output.json`, `packages/os/package.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/compact-daemon-output.test.ts`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/install.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
