# sync distribution stream with promoted main

branch: `task/os-distribution/sync-distribution-stream-with-promoted-main`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1670/sync-distribution-stream-with-promoted-main
github pr: https://github.com/consuelohq/opensaas/pull/1670
started: 2026-07-27

## acceptance criteria

- [ ] Merge the newly promoted `main` ancestry into `stream/os-distribution` through PR #1670.
- [ ] Preserve the stream's complete distribution rehearsal and broad runtime-closure triggers.
- [ ] Preserve promoted macOS packaging, native lifecycle runtime inputs, and pinned-update fail-closed coverage.
- [ ] Run focused cross-platform/lifecycle tests, workspace review, full verify, and required CI.
- [ ] Request CodeRabbit and disposition every actionable finding.
- [ ] Merge only into `stream/os-distribution`; do not promote the stream to `main`.

## plan

1. Compare `main` and the assigned stream at each conflicted file and define the semantic union.
2. Add a failing source-contract assertion for the combined workflow behavior.
3. Apply the narrow union to the workflow and lifecycle runtime fixtures.
4. Reconcile stream ancestry into the task branch, validate, review, publish, and merge the task PR.

## current status

- Task started from promoted `main` at PR #1670 with session `tsk_17211911953c`.
- `stream.sync` identified three additive conflicts: the distribution workflow and two lifecycle fixture lists.
- The intended union is broad stream triggers + complete rehearsal split + promoted macOS packaging + both lifecycle entrypoints + pinned-update fail-closed coverage.

## test-first contract

- Behavior: the native matrix must preserve Windows cleanup ordering, run portable distribution contracts off macOS, run the complete rehearsal on macOS, and retain macOS packaging.
- Existing pattern: source-contract assertions in `packages/os/tests/windows-platform.test.ts` and platform-specific suites.
- Changed test: strengthen the Windows workflow source contract to assert the combined matrix behavior and broad runtime-closure triggers.
- RED command: `bun x vitest run tests/windows-platform.test.ts` from `packages/os`.
- Expected RED: promoted `main` still names `Run distribution harness contracts` and lacks the stream's portable/full rehearsal split and broad trigger paths.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 05:26:41 `review.run`: passed — OK
- 2026-07-27 05:26:50 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial unscoped document reads failed with `AMBIGUOUS_TASK_SELECTION`; retrying against `main` exposed the task-session requirement.
- Historical task recovery produced stale PR metadata, so a fresh isolated task/PR #1670 was created.
- `stream.sync` failed closed on three content conflicts; no native-git fallback was used.
- A discovery `batch` did not propagate the top-level task session to child `fs.read`/`git.diff`; direct task-scoped calls recovered the route.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/tests/windows-platform.test.ts`
