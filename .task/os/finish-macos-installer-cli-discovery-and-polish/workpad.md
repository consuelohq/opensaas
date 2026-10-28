# finish macos installer cli discovery and polish

branch: `task/os/finish-macos-installer-cli-discovery-and-polish`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2570
started: 2026-09-23

## acceptance criteria

- [x] Successful macOS installs materialize the canonical lifecycle CLI before onboarding and make it discoverable in future zsh/bash sessions.
- [x] When the inherited shell PATH already contains a safe user-writable directory, install an idempotent Consuelo shim there so the command is discoverable immediately without mutating the parent shell.
- [x] Never overwrite or silently shadow an unrelated existing `consuelo`; surface the collision explicitly.
- [x] If no safe writable inherited PATH directory exists, preserve the profile fallback and state the limitation accurately instead of pretending the current parent shell changed.
- [x] Progress rendering resolves one in-place status instead of printing duplicate start/done lines.
- [x] Browser-open failure shows a prominent manual approval URL plus device code/instruction.
- [x] Existing browser-open happy path, recovery CLI, zsh/bash behavior, non-interactive/JSON output, and lifecycle installation remain intact.

## plan

1. Read the CLI path, progress renderer, and device-auth presentation contracts.
2. Freeze immediate-shim, collision, single-progress-line, and manual-link behavior in focused tests and confirm RED.
3. Implement the smallest shell/installer changes using existing styling/helpers.
4. Run focused + installer regression tests, strict review, and publish to `stream/os`.

## Test-first contract

behavior under test: fresh macOS bootstrap can expose the canonical CLI immediately through an existing safe writable PATH entry; collisions fail closed; progress completes on one terminal line; browser-open failure renders a clear manual URL/code.
existing local pattern: `prepare_recovery_cli` materializes `$OS_HOME/bin/consuelo`; `ensure_command_on_path` owns shell discovery; `run_with_loading_dots` owns quiet progress; device onboarding already returns `verificationUriComplete`, user code, and browser-open status.
new or changed tests: add an unsafe-PATH rejection case to `bootstrap-source.test.ts`; existing `bootstrap-source.test.ts` already covers immediate writable-PATH discovery + single-line progress, and `installer-onboarding-ui.test.ts` already covers both browser-open and manual-link paths.
focused red command: `bun --cwd packages/os test tests/bootstrap-source.test.ts -t "skips unsafe writable PATH directories"`.
expected red failure: current `find_immediate_cli_link_dir` selects the first writable directory even when it is group/world-writable, so the test observes a shim in the unsafe directory instead of the safe second candidate.
no-test waiver: not applicable.

## files changed

- `packages/os/scripts/bootstrap.sh` — harden the immediate CLI shim destination: absolute, current-user-owned, non-symlink, writable, and not group/world-writable.
- `packages/os/tests/bootstrap-source.test.ts` — prove an unsafe writable PATH directory is skipped in favor of the next safe candidate.
- `packages/os/tests/lifecycle-engine.test.ts` — repair the stream's synthetic runtime fixture so full verification includes the already-required supervised heartbeat/sidecar runtime inputs.
- `packages/os/tests/distribution/release-publication-preparer.test.ts` — keep the publication fixture aligned with the same required runtime inputs.

## key decisions

- A child process cannot mutate the parent shell environment. Immediate discovery is only possible without privilege when the inherited PATH already contains a safe writable directory; do not fake this guarantee.
- Do not introduce sudo/root solely to install a command shim in this slice. Preserve the current non-root installer boundary.
- Collision handling is fail-closed for mutation: leave an unrelated `consuelo` untouched, warn explicitly, and keep the canonical absolute Consuelo CLI usable until the user resolves the name collision.

## notes for ko

- The clean-machine UX validation remains in the separate fresh-Mac thread per the handoff.
- Most requested presentation polish was already on `stream/os` when this task started: immediate writable-PATH shimming, zsh/bash profile fallback, collision warnings, one-line progress completion, compact success copy, and prominent manual browser authorization fallback.
- Focused installer regression is green: 52/52 tests. Strict review is green with zero blocking findings.
- Full verification discovered a pre-existing synthetic lifecycle fixture omission from the earlier macOS runtime-bundle merge; this task repairs that fixture so the publish gate can run against current `stream/os` truth.

## errors i ran into

- The first focused RED call used the Bun code runner for a shell command; reran through the Bash runner.
- The initial RED test missed `chmodSync`; after fixing only the test import, it failed on the intended unsafe-directory behavior.
- After implementation, the focused harness needed to include the new safety helper when extracting shell functions; once corrected, the focused test passed.
- The full publish gate initially failed in `lifecycle-engine.test.ts` because its explicit runtime `includePaths` predated the required macOS supervised heartbeat/sidecar files; runtime behavior itself was not failing.
- The next selector pass found the same stale fixture shape in `release-publication-preparer.test.ts`; it is repaired in the same fixture-only manner.

- 2026-09-23 22:09:51 write: `.task/os/finish-macos-installer-cli-discovery-and-polish/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 22:09:51 fs.write: `.task/os/finish-macos-installer-cli-discovery-and-polish/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/installer-onboarding-ui.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/workspace/scripts/verify.js`

## workspace-owned: validation evidence

- 2026-09-23 22:15:37 `review.run`: passed — OK
- 2026-09-23 22:16:37 apply-patch: `.task/os/finish-macos-installer-cli-discovery-and-polish/workpad.md`
- 2026-09-23 22:17:20 `verify`: failed — COMMAND_FAILED
- 2026-09-23 22:19:25 apply-patch: `packages/os/tests/lifecycle-engine.test.ts`
- 2026-09-23 22:19:25 apply-patch: `.task/os/finish-macos-installer-cli-discovery-and-polish/workpad.md`
- 2026-09-23 22:20:29 `verify`: failed — COMMAND_FAILED
- 2026-09-23 22:22:15 apply-patch: `packages/os/tests/distribution/release-publication-preparer.test.ts`
- 2026-09-23 22:22:15 apply-patch: `.task/os/finish-macos-installer-cli-discovery-and-polish/workpad.md`
- 2026-09-23 22:23:20 `verify`: passed — OK
