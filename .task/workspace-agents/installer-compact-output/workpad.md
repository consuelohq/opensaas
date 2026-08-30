# installer compact output

branch: `task/workspace-agents/installer-compact-output`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1066/installer-compact-output
github pr: https://github.com/consuelohq/opensaas/pull/1066
started: 2026-06-15

## acceptance criteria

- [x] Keep `✔ local OS saved` after provisioning.
- [x] Keep `◆ configuration saved` after final installer config write.
- [x] Remove the expanded `home`, `skills`, `artifacts`, `agents` resource tree from the final human output.
- [x] Do not change what the installer provisions, saves, connects, or installs.
- [x] Keep the task branch based on `stream/workspace-agents` so review only contains this task.

## test-first contract

Behavior under test:
The local installer completion path stays compact after `local OS saved` and does not print the provisioned resource tree before `configuration saved`.

Existing pattern to follow:
`packages/os/scripts/install-tty.test.ts` already uses source-level tests for installer TTY and output contracts.

Focused red command:
`bun test packages/os/scripts/install-tty.test.ts`

Expected red failure:
The new compact-output test fails because the completion block still contains `stepComplete('home')`.

Focused red evidence:
The red test was first run on the initial task branch before implementation and failed with `expect(received).not.toContain(expected)` for `stepComplete('home')`. This stream-based task applies the same test and implementation to the correct stream base.

Focused green command:
`bun test packages/os/scripts/install-tty.test.ts`

No-test waiver:
Not applicable. This is a user-visible CLI output change.

## implementation

- Removed final `stepComplete('home')`, `stepComplete('skills')`, `stepComplete('artifacts')`, and conditional `stepComplete('agents')` calls from `packages/os/scripts/install.ts`.
- Removed the now-unused `stepComplete` import.
- Added a regression test in `packages/os/scripts/install-tty.test.ts` that asserts the final completion block remains compact.

## validation evidence

- Red: `bun test packages/os/scripts/install-tty.test.ts` failed as expected on `stepComplete('home')` before implementation on the initial task branch.
- Green: `bun test packages/os/scripts/install-tty.test.ts` passed: 9 tests, 40 assertions.
- Broader focused tests: `bun test packages/os/scripts/onboarding-flow.test.ts packages/os/tests/install-workspace-bootstrap-contract.test.ts` passed: 12 passed, 3 skipped.
- Syntax: `checkFiles` passed for `packages/os/scripts/install.ts` and `packages/os/scripts/install-tty.test.ts`.
- Runtime smoke: `bun packages/os/scripts/install.ts --yes --dry-run --home /tmp/consuelo-os-output-check` output stayed compact and did not print the provisioned resource tree.

## current status

Ready for review gates, push, and PR refresh.

## notes for ko

No provisioning behavior changed. This is display-only cleanup. The earlier task branch `task/workspace-agents/installer-output-cleanup` was superseded because it was started from `main`; use this stream-based PR instead.

- 2026-06-15 06:46:03 write: `.task/workspace-agents/installer-compact-output/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-15 06:46:03 fs.write: `.task/workspace-agents/installer-compact-output/workpad.md`
- 2026-06-15 06:50:10 fs.write: `.task/workspace-agents/installer-compact-output/workpad.md`

## workspace-owned: validation evidence

- Red: `bun test packages/os/scripts/install-tty.test.ts` failed as expected on `stepComplete('home')` before implementation on the initial task branch.
- Green: `bun test packages/os/scripts/install-tty.test.ts` passed: 9 tests, 40 assertions.
- Broader focused tests: `bun test packages/os/scripts/onboarding-flow.test.ts packages/os/tests/install-workspace-bootstrap-contract.test.ts` passed: 12 passed, 3 skipped.
- Syntax: `checkFiles` passed for `packages/os/scripts/install.ts` and `packages/os/scripts/install-tty.test.ts`.
- Runtime smoke: `bun packages/os/scripts/install.ts --yes --dry-run --home /tmp/consuelo-os-output-check` output stayed compact and did not print the provisioned resource tree.
- 2026-06-15 06:48:39 `review.run`: passed — OK
- 2026-06-15 06:49:30 `review.run`: passed — OK
- 2026-06-15 06:50:02 `verify`: passed — OK
- 2026-06-15 06:50:47 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/installer-compact-output.json`, `.task/workspace-agents/installer-compact-output/current.json`, `.task/workspace-agents/installer-compact-output/evidence-log.json`, `.task/workspace-agents/installer-compact-output/read-log.json`, `.task/workspace-agents/installer-compact-output/session.json`, `.task/workspace-agents/installer-compact-output/verify.json`, `.task/workspace-agents/installer-compact-output/workpad.md`, `packages/os/scripts/install-tty.test.ts`, `packages/os/scripts/install.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final gate evidence

- Review: `review.run --no-tests` passed for 2 files, 0 issues.
- Verify: `verify` passed and wrote publish-valid stamp at `.task/workspace-agents/installer-compact-output/verify.json`.

## publish status

Ready to push and refresh PR #1066.

- 2026-06-15 06:50:10 append: `.task/workspace-agents/installer-compact-output/workpad.md`
