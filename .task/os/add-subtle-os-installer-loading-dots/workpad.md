# add subtle os installer loading dots

branch: `task/os/add-subtle-os-installer-loading-dots`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/753/add-subtle-os-installer-loading-dots
github pr: https://github.com/consuelohq/opensaas/pull/753
started: 2026-06-04

## acceptance criteria

- [x] Hosted source download shows a subtle moving loading state while curl/tar run.
- [x] Background service setup shows the same subtle moving loading state while quiet LaunchAgent setup runs.
- [x] Normal hosted daemon setup does not print Bun's `$ bash ./scripts/install-system-daemons.sh --quiet` echo line.
- [x] Runtime dependency install output remains inherited and visible, including Bun package install details.
- [x] Debug mode keeps detailed daemon diagnostics visible.
- [x] Bash syntax and focused installer tests pass.

## plan

1. Add focused red coverage for bootstrap loading helpers and quiet daemon invocation.
2. Patch `bootstrap.sh` with a TTY-aware subtle dots loader around download and background service setup.
3. Call `install-system-daemons.sh --quiet` directly from bootstrap outside debug mode to avoid Bun's script echo.
4. Keep `bun install` inherited output unchanged.
5. Run focused installer tests, Bash syntax checks, review, verify, push, and PR.

## current status

- Implementation and validation complete.
- Awaiting push / PR promotion / merge.

## files changed

- `.task/os/add-subtle-os-installer-loading-dots/current.json`
- `.task/os/add-subtle-os-installer-loading-dots/evidence-log.json`
- `.task/os/add-subtle-os-installer-loading-dots/read-log.json`
- `.task/os/add-subtle-os-installer-loading-dots/session.json`
- `.task/os/add-subtle-os-installer-loading-dots/verify.json`
- `.task/os/add-subtle-os-installer-loading-dots/workpad.md`
- `.task/tasks/os/add-subtle-os-installer-loading-dots.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`

## workspace-owned: files changed

- `.task/os/add-subtle-os-installer-loading-dots/current.json`
- `.task/os/add-subtle-os-installer-loading-dots/evidence-log.json`
- `.task/os/add-subtle-os-installer-loading-dots/read-log.json`
- `.task/os/add-subtle-os-installer-loading-dots/session.json`
- `.task/os/add-subtle-os-installer-loading-dots/verify.json`
- `.task/os/add-subtle-os-installer-loading-dots/workpad.md`
- `.task/tasks/os/add-subtle-os-installer-loading-dots.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`

## workspace-owned: activity log

- 2026-06-04 04:27:08 fs.write: `.task/os/add-subtle-os-installer-loading-dots/workpad.md`
- Added string-level red coverage to `compact-daemon-output.test.ts` before changing installer code.
- Fixed the existing split `ONBOARDING_STATUS="would_run"` dry-run assignment in `bootstrap.sh`.
- Implemented `run_with_loading_dots` in `bootstrap.sh`.
- Started task branch from `main` because Ko approved a main-based follow-up after PR #751 landed.
- Switched quiet daemon setup and dry-run quiet daemon setup from Bun package scripts to direct Bash script execution to suppress Bun's `$ bash ...` echo line.
- Wrapped source archive download and background service setup in the loading helper.

## workspace-owned: validation evidence

- Red test: `bun test packages/os/scripts/compact-daemon-output.test.ts` failed before implementation because `install_daemons_quiet()` was missing.
- Green syntax: `bash -n packages/os/scripts/bootstrap.sh packages/os/scripts/install-system-daemons.sh` passed.
- Green focused tests: `bun test packages/os/scripts/compact-daemon-output.test.ts packages/os/scripts/onboarding-flow.test.ts packages/os/scripts/install-tty.test.ts` passed: 20 pass, 0 fail, 79 expects.
- Green dry-run smoke: `bash packages/os/scripts/bootstrap.sh --dry-run --json` passed and no longer prints the Bun `$ bash ./scripts/install-system-daemons.sh --dry-run --quiet` echo line.
- Green daemon quiet smoke: `bash packages/os/scripts/install-system-daemons.sh --dry-run --quiet` printed only the compact dry-run completion line.
- Review: `review.run` with `base=main` passed with 0 issues.
- Verify: `verify` with `base=main` passed and wrote publish-valid stamp.
- 2026-06-04 04:27:19 `verify`: passed — OK

## key decisions

- Use subtle dots instead of percentages. The work duration is not reliably knowable for curl/tar/LaunchAgent setup, and fake percentages would create worse UX.
- Use direct Bash execution for the daemon quiet path so Bun does not echo the package script.
- Keep dependency install output visible because it gives real, useful progress during package installation.
- No workspace docs update required; this changes OS installer UX and tests, not workspace tooling, generated docs, typed facade contracts, or agent doctrine.

## notes for ko

- The loading helper is intentionally TTY-aware. In JSON, debug, or non-TTY contexts it prints a single static status line and preserves command behavior.

## improvements noticed

- Existing `bootstrap.sh` had a broken dry-run assignment split across two lines: `ONBOARDING_STATUS=` followed by `"would_run"`. This branch fixes it.
- `stream.sync` failed because an existing stream/os sync worktree holds the branch. This task was started from current `main` as requested, so no stream mutation was required before editing.

## issues and recovery

- `stream.sync` failed: `fatal: cannot force update the branch 'stream/os' used by worktree .../stream-os-sync-4Mc3vV`. Recovery: started task from `main` with `startFrom: main`.
- A line-range patch briefly corrupted the helper placement in `bootstrap.sh`; recovery was to reread the affected ranges, replace the full sections through content files, and verify with `bash -n` plus focused tests.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): add subtle installer loading dots" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/workspace/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`
- `packages/os/scripts/install-tty.test.ts`

## Test-first contract

Behavior under test:
- Hosted bootstrap contains a reusable subtle loading helper that is TTY-aware and quiet-safe.
- Source download uses the helper instead of leaving a static `Downloading Consuelo OS source...` line while work runs.
- Background service setup uses the helper and calls `./scripts/install-system-daemons.sh --quiet` directly outside debug mode.
- Dependency installation continues to run Bun install inherited so install details stay visible.
- Debug mode continues to use detailed daemon output.

Existing pattern to follow:
- `bootstrap.sh` already owns the hosted installer shell flow and wraps user-facing long steps.
- `compact-daemon-output.test.ts` is the focused string-level regression test for hosted daemon output compactness.

Intended tests:
- Extend `packages/os/scripts/compact-daemon-output.test.ts` with bootstrap string assertions for the loading helper, download wrapping, direct daemon quiet execution, visible dependency install, and debug behavior.
- Run `bun test packages/os/scripts/compact-daemon-output.test.ts` red before editing.
- Run focused installer test set and `bash -n` after editing.

Focused red command:

```bash
bun test packages/os/scripts/compact-daemon-output.test.ts
```

Expected red failure:
- Missing `run_with_loading_dots` helper.
- Source download still calls `log "Downloading Consuelo OS source..."` plus raw `curl`/`tar`.
- Background service setup still calls `bun run --cwd "$os_dir" install:system-daemons:quiet`, which prints the unwanted `$ bash ... --quiet` line.

- 2026-06-04 04:27:08 write: `.task/os/add-subtle-os-installer-loading-dots/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/add-subtle-os-installer-loading-dots/current.json`, `.task/os/add-subtle-os-installer-loading-dots/evidence-log.json`, `.task/os/add-subtle-os-installer-loading-dots/read-log.json`, `.task/os/add-subtle-os-installer-loading-dots/session.json`, `.task/os/add-subtle-os-installer-loading-dots/verify.json`, `.task/os/add-subtle-os-installer-loading-dots/workpad.md`, `.task/tasks/os/add-subtle-os-installer-loading-dots.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/compact-daemon-output.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
