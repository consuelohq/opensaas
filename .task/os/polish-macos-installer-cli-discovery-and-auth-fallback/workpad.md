# polish macos installer cli discovery and auth fallback

branch: `task/os/polish-macos-installer-cli-discovery-and-auth-fallback`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2562
started: 2026-09-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

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
- `packages/os/scripts/install.ts`
- `packages/os/tests/bootstrap-recovery-cli.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/installer-onboarding-ui.test.ts`

## Test-first contract

behavior under test: fresh macOS installs make the lifecycle CLI immediately discoverable without root whenever an existing user-writable PATH directory allows it; otherwise they present the absolute CLI path and persistent shell-profile action clearly. Quiet bootstrap stages occupy one stable terminal line. Device authorization always shows a fallback URL plus the user code.
existing local pattern: ensure_command_on_path appends the Consuelo bin directory to zsh/bash rc files only; run_quiet_with_loading_dots logs start and completion separately; deviceLoginPromptLines hides the URL after a successful browser-open call.
new or changed tests: bootstrap-recovery-cli.test.ts, bootstrap-source.test.ts, installer-onboarding-ui.test.ts, plus executable shell-function coverage for immediate PATH linking and collisions.
focused red command: bun --cwd packages/os test tests/bootstrap-recovery-cli.test.ts tests/bootstrap-source.test.ts tests/installer-onboarding-ui.test.ts
expected red failure: no safe current-PATH link strategy exists; quiet progress emits two lines; successful browser-open prompt hides the fallback URL.
no-test waiver: not applicable.

## scoped decisions

- Do not use sudo or overwrite protected/system command locations.
- Do not overwrite an unrelated consuelo executable.
- An existing user-writable directory already present in PATH is the only safe way for curl-pipe-bash to make the bare command visible to the parent shell immediately.
- Preserve the Clack device-auth note and put the always-visible fallback URL/code inside it.

- 2026-09-23 02:11:47 append: `.task/os/polish-macos-installer-cli-discovery-and-auth-fallback/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 02:11:47 fs.write: `.task/os/polish-macos-installer-cli-discovery-and-auth-fallback/workpad.md`
- 2026-09-23 02:12:15 apply-patch: `packages/os/tests/bootstrap-recovery-cli.test.ts`
- 2026-09-23 02:12:15 apply-patch: `packages/os/tests/bootstrap-source.test.ts`
- 2026-09-23 02:12:15 apply-patch: `packages/os/tests/installer-onboarding-ui.test.ts`
- 2026-09-23 02:13:17 apply-patch: `packages/os/scripts/install.ts`
- 2026-09-23 02:13:43 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 02:13:48 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 02:14:15 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 02:14:32 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 02:15:58 apply-patch: `packages/os/tests/bootstrap-recovery-cli.test.ts`
- 2026-09-23 02:16:32 apply-patch: `packages/os/tests/bootstrap-source.test.ts`
- 2026-09-23 02:16:43 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 02:17:50 fs.write: `.task/os/polish-macos-installer-cli-discovery-and-auth-fallback/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 02:17:22 `review.run`: passed — OK
- 2026-09-23 02:17:36 `review.run`: passed — OK

## completion evidence

- Focused UX contract: 26/26 passing.
- Broader deterministic installer/auth regression: 102/102 passing.
- Behavioral PATH tests prove safe immediate linking through an existing writable PATH directory and prove unrelated commands are not overwritten.
- Device authorization always shows the fallback URL and formatted code.
- Recovery output now gives the canonical absolute CLI command for the current shell.
- Strict review reports zero blocking issues.

## implementation notes

- A child installer cannot mutate its parent shell environment, so immediate bare-command discovery is only attempted through a safe existing writable PATH directory. Otherwise zsh/bash profile setup remains idempotent and the absolute CLI path is shown.
- No elevated write is used for command discovery.

- 2026-09-23 02:17:50 append: `.task/os/polish-macos-installer-cli-discovery-and-auth-fallback/workpad.md`
