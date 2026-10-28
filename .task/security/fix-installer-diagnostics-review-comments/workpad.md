# fix installer diagnostics review comments

branch: `task/security/fix-installer-diagnostics-review-comments`
stream: `stream/security`
pr: https://github.com/consuelohq/opensaas/pull/1372
started: 2026-07-04

## acceptance criteria

- Verify each CodeRabbit finding against current code.
- Fix still-valid diagnostics/security comments with minimal scope.
- Preserve normal installer behavior and avoid machine-specific assumptions.
- Fix the functional polling failure shown by Ko's logs: after `poll_wait`, the child exits with `beforeExit` and no `poll_result`.
- Keep dev diagnostics local, redacted, and gated behind `CONSUELO_OS_DEV_DIAGNOSTICS=1`.
- Validate with focused OS tests, shell syntax, typecheck, review, and verify.

## current evidence

Ko's latest events show:

- Device code request succeeds.
- Prompt displays and browser opens.
- Installer records `poll_wait` with `intervalSeconds: 5`.
- Five seconds later, the process emits `beforeExit` and `exit` with no `poll_result`.
- This means the child reaches the OAuth polling wait, then goes idle before producing a poll response. The next implementation must keep the runtime alive across the poll request and record `poll_request` before awaiting the HTTP call.

The pasted review comments are still valid:

- `bootstrap.sh` sed fallback redaction is weaker than the Perl path.
- `prompt_displayed` stores the verification URL; redaction helps, but diagnostics should avoid raw URL storage.
- `child_process` is a misleading step name for the installer's own process lifecycle.
- Workspace-name validation duplicates the shared error formatter.
- The lifecycle test is source-string based and does not exercise runtime order.
- `runBootstrapFunction` hides spawn errors/signals.
- The sed fallback path is untested.

Additional valid issue from Ko's log:

- `exitCode` is redacted because diagnostics redact any key containing `code`. Lifecycle `exitCode` and server `errorCode` should remain visible; `deviceCode`, `userCode`, tokens, state, and auth values should remain redacted.

## test-first contract

Behavior under test:

- Device login polling records `poll_request` before awaiting the HTTP poll and wraps the poll in a runtime hold so Bun cannot exit while the poll request is pending.
- `prompt_displayed` records `displayed: true` and no raw verification URL.
- Process lifecycle diagnostics use `process_lifecycle`, preserve numeric `exitCode`, and remain gated to dev diagnostics.
- Workspace-name validation uses `formatUnknownError`.
- Shell redaction covers both Perl and sed fallback paths.
- Diagnostic value redaction preserves `exitCode`/`errorCode` and redacts real secret code keys.

Existing local patterns to follow:

- `packages/os/scripts/onboarding-flow.test.ts` for installer behavior/source contracts.
- `packages/os/tests/bootstrap-source.test.ts` for shell function tests.
- `packages/os/tests/install-diagnostics.test.ts` for redaction behavior.

New or changed tests:

- Add runtime tests around exported installer diagnostics helpers and mocked device-login dependencies.
- Extend bootstrap-source test to force sed fallback and improve spawn failure errors.
- Extend install-diagnostics redaction tests for `exitCode`/`errorCode`.

Focused red command:

- `bun x vitest run scripts/onboarding-flow.test.ts tests/bootstrap-source.test.ts tests/install-diagnostics.test.ts` from `packages/os`.

Expected red failure:

- Current code records `child_process`, stores `verificationUrl`, lacks `poll_request`, has no runtime hold around poll, redacts `exitCode`, and only tests the Perl redaction path.

## validation evidence

- pending

## workspace-owned: validation evidence

- pending
- 2026-07-05 03:37:19 `review.run`: passed — OK
- 2026-07-05 03:38:14 `review.run`: passed — OK
- 2026-07-05 03:38:28 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-installer-diagnostics-review-comments/current.json`, `.task/security/fix-installer-diagnostics-review-comments/session.json`, `.task/security/fix-installer-diagnostics-review-comments/workpad.md`, `.task/tasks/security/fix-installer-diagnostics-review-comments.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-diagnostics.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/install-diagnostics.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
