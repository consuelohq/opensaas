# Address daemon lifecycle review comments

branch: `task/os/address-daemon-lifecycle-review-comments`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1832/address-daemon-lifecycle-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1832
started: 2026-08-11

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

- none yet

## workspace-owned: validation evidence

- 2026-08-11 18:51:01 `review.run`: passed — OK
- 2026-08-11 18:51:13 `verify`: passed — OK

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

## Discovery and test-first contract

- Source: CodeRabbit review on main promotion PR #1831.
- Actionable: use lifecycleError for the daemon mutation guard so JSON failures retain a structured code.
- Nitpicks: anchor server order assertion to the exact marker assignment; rename both new tests to the required should-when pattern.
- Test-first contract: extend the existing daemon-guard assertion with the expected structured lifecycle code and run it red before changing production. The two test-only review fixes do not require separate behavioral tests.

## Review fixes and verification

- Red: daemon update JSON envelope returned LIFECYCLE_FAILED instead of DAEMON_MUTATION_NOT_ALLOWED.
- Fixed actionable comment: added the daemon mutation lifecycle code and throw lifecycleError from the synchronous daemon guard.
- Fixed nitpicks: exact marker assignment order anchor; should-when names for both new lifecycle tests.
- Green: focused lifecycle/server tests 56 passed; OS typecheck passed; git diff --check passed.
