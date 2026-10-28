# fix installer child exit diagnostics and transcript redaction

branch: `task/security/fix-installer-child-exit-diagnostics-and-transcript-redaction`
stream: `stream/security`
pr: https://github.com/consuelohq/opensaas/pull/1370
started: 2026-07-04

## acceptance criteria

- Verify the transcript redaction finding against current `stream/security` code.
- Keep dev diagnostics temporary and gated behind `CONSUELO_OS_DEV_DIAGNOSTICS=1`.
- Prevent saved child installer transcripts from exposing OAuth/device codes, query secrets, tokens, terminal hyperlinks, or local user paths.
- Add child installer breadcrumbs that explain early exits during OAuth polling: prompt shown, browser open result, poll result details, beforeExit/exit, and signal/error monitor evidence.
- Keep normal install behavior generic for all users; no Ko-machine URL or private workspace hardcoding.
- Validate with focused OS tests and source contracts.

## current evidence

Ko's latest diagnostic bundle shows:

- `device.code` returned 200.
- One `device.poll` returned 400.
- No `device_login complete`, no `workspace_selection`, no `health`, and no result JSON.
- Bootstrap saw a clean child process return, then failed because the onboarding result file was empty.
- The saved child transcript still included the visible device user code, so the review redaction finding is valid.

Working hypothesis:

- The failure is currently in child process lifecycle during the OAuth poll wait, before approval/workspace selection.
- The existing diagnostics identify the last app-level step but do not identify whether the child saw EOF/cancel, signal, beforeExit, or an unhandled error.

## test-first contract

Behavior under test:

- Bootstrap dev transcript redaction should remove terminal control sequences, OSC hyperlinks, standalone device user codes, query-param secrets, bearer/token-shaped values, Cloudflare tunnel tokens, and macOS/Linux user paths.
- Child installer diagnostics should record lifecycle and OAuth polling breadcrumbs around the browser prompt and polling loop so an empty onboarding result failure names the exit stage.

Existing local pattern to follow:

- `packages/os/tests/bootstrap-source.test.ts` for bootstrap source/function contracts.
- `packages/os/scripts/onboarding-flow.test.ts` for install/bootstrap source contracts.
- `packages/os/tests/install-diagnostics.test.ts` for diagnostic redaction behavior.

New or changed tests:

- Add a bootstrap-source test that runs `redact_dev_log_line` with representative PTY output and asserts secrets/control sequences are gone.
- Add onboarding-flow assertions for child process lifecycle breadcrumbs and poll detail diagnostics.

Focused red command:

- `bun x vitest run tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts` from `packages/os`.

Expected red failure:

- Current shell redactor leaves `C7UD-BR7N` visible and preserves ANSI/OSC output.
- Current installer lacks lifecycle breadcrumbs such as `child_process`, `beforeExit`, and poll-result detail records.

## validation evidence

Red-first evidence:

- `bun x vitest run tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts` failed as expected:
  - `redact_dev_log_line` left ANSI/OSC control output and `C7UD-BR7N` visible.
  - `install.ts` lacked child lifecycle breadcrumbs around device login.

Green evidence:

- `bun x vitest run tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts` from `packages/os` passed: 29 tests.
- `bun x vitest run tests/install-diagnostics.test.ts` from `packages/os` passed: 3 tests.
- `bash -n packages/os/scripts/bootstrap.sh` passed.
- `bun run typecheck` from `packages/os` passed: workspace script syntax checks passed.
- `review.run --base origin/stream/security --no-tests` passed: 0 blocking issues.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`

## workspace-owned: validation evidence

- pending
- 2026-07-05 02:15:54 `review.run`: passed — OK
- 2026-07-05 02:16:33 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-installer-child-exit-diagnostics-and-transcript-redaction/current.json`, `.task/security/fix-installer-child-exit-diagnostics-and-transcript-redaction/session.json`, `.task/security/fix-installer-child-exit-diagnostics-and-transcript-redaction/workpad.md`, `.task/tasks/security/fix-installer-child-exit-diagnostics-and-transcript-redaction.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/bootstrap-source.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
