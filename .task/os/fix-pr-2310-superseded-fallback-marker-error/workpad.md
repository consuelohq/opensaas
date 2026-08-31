# fix PR 2310 superseded fallback marker error

branch: `task/os/fix-pr-2310-superseded-fallback-marker-error`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2339/fix-pr-2310-superseded-fallback-marker-error
github pr: https://github.com/consuelohq/opensaas/pull/2339
started: 2026-08-31

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

- 2026-08-31 21:37:52 fs.write: `.task/os/fix-pr-2310-superseded-fallback-marker-error/workpad.md`
- 2026-08-31 21:40:01 fs.write: `.task/os/fix-pr-2310-superseded-fallback-marker-error/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 21:39:43 `review.run`: passed — OK

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

behavior under test: a successful runner-owned exit marker clears a deferred parent fallback error
existing local pattern: the pidless fallback-marker handoff regression in subagent-lifecycle-regressions.test.ts
new or changed tests: assert the completed reconciled run has no error
focused red command: bun test packages/os/tests/subagent-lifecycle-regressions.test.ts -t "allows a pidless parent fallback marker"
expected red failure: completed run retains "runner process exited without writing a durable exit marker"
no-test waiver: not applicable

- 2026-08-31 21:37:52 append: `.task/os/fix-pr-2310-superseded-fallback-marker-error/workpad.md`

- 2026-08-31 21:38:06 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-31 21:38:37 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

## Implementation evidence

- Codex review thread: `PRRT_kwDORPzu_c6d4YPJ`.
- Red: `trc_f4e390b77956` — completed handoff retained the fallback marker error.
- Focused green: `trc_e62fe9ebc310`.
- Combined regressions: `trc_18eb8b5ac5df` — 29 passed, 0 failed.
- Typecheck: `trc_cd3c01f65f09`.
- Strict review: `trc_7a4c9f519047` — zero blockers.

- 2026-08-31 21:40:01 append: `.task/os/fix-pr-2310-superseded-fallback-marker-error/workpad.md`
