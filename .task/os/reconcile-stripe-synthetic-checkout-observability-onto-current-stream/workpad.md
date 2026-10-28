# Reconcile Stripe synthetic checkout observability onto current stream

branch: `task/os/reconcile-stripe-synthetic-checkout-observability-onto-current-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2002/reconcile-stripe-synthetic-checkout-observability-onto-current-stream
github pr: https://github.com/consuelohq/opensaas/pull/2002
started: 2026-08-15

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

- 2026-08-15 03:05:49 fs.write: `.task/os/reconcile-stripe-synthetic-checkout-observability-onto-current-stream/workpad.md`
- 2026-08-15 03:07:36 fs.write: `.task/os/reconcile-stripe-synthetic-checkout-observability-onto-current-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 03:07:04 `review.run`: passed — OK
- 2026-08-15 03:07:29 `verify`: passed — OK
- 2026-08-15 03:07:54 `verify`: passed — OK

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

## Test-first contract

behavior under test: reconcile the already verified Stripe synthetic checkout + PostHog/Sentry implementation onto the current OS stream without carrying inherited main-only commits or overwriting newer stream work.
existing local pattern: source task PR #1997 commit b631cafe391907c67b6fdea0dd33a118f3b64fdc is publish-valid; current stream differs only in test-selection registry/rules/tests among files changed by that exact commit.
new or changed tests: no new behavior beyond PR #1997; rerun its 113 focused auth/billing/security tests, workspace test-selection tests, syntax, strict review, and full verify after reconciliation.
focused red command: merge attempt of PR #1997 into current stream failed with GitHub 405 merge conflicts caused by inherited main history.
expected red failure: conflicted task cannot merge despite verified product code.
no-test waiver: not applicable; reconciliation must rerun all focused behavior/security contracts.

## Reconciliation plan

1. Port only exact product/test files from verified commit b631cafe; exclude old task metadata.
2. Merge the checkout-specific test-selection rule/test into current stream-owned selector files and regenerate registry from current stream.
3. Rerun focused billing/auth/security tests + selector, strict review, full verify.
4. Publish replacement PR #2002 to stream/os; close conflicted PR #1997 after replacement is safely merged.

- 2026-08-15 03:05:49 append: `.task/os/reconcile-stripe-synthetic-checkout-observability-onto-current-stream/workpad.md`

## Reconciliation result

- Ported only verified product/test files from PR #1997 commit `b631cafe391907c67b6fdea0dd33a118f3b64fdc`; inherited main-only commits were not carried into this task.
- Merged only the checkout-observability selector rule/test into the current stream versions of test-selection files and regenerated the registry from the current stream.
- Focused checkout/auth/security regressions: 113/113 passed.
- Current-stream workspace test-selection focused verification passed.
- Syntax and `git diff --check` passed.
- Strict review against `origin/stream/os`: 0 blockers.
- Full verify against `origin/stream/os`: `publishValid: true`, DB 0 risks/findings.

- 2026-08-15 03:07:36 append: `.task/os/reconcile-stripe-synthetic-checkout-observability-onto-current-stream/workpad.md`
