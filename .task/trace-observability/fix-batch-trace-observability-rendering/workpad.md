# Fix batch trace observability rendering

branch: `task/trace-observability/fix-batch-trace-observability-rendering`
stream: `stream/trace-observability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2136/fix-batch-trace-observability-rendering
github pr: https://github.com/consuelohq/opensaas/pull/2136
started: 2026-08-16

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

- 2026-08-16 06:29:47 fs.write: `.task/trace-observability/fix-batch-trace-observability-rendering/workpad.md`
- 2026-08-16 06:30:56 fs.write: `.task/trace-observability/fix-batch-trace-observability-rendering/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:30:52 `verify`: passed — OK

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
bun run task:push -- --message "type(trace-observability): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: rehome the already-implemented batch/trace observability fix onto a clean dedicated stream without changing behavior.
existing local pattern: source task task/workspace-agents/fix-batch-trace-observability-rendering commit ccd3b77e4886b265ccb353691dfd8d46dcdc6961; focused batch + OS trace tests and full verify are already green there.
new or changed tests: carry over the existing regression tests for batch child tool identity/failure detail/large payloads, nested trace filtering, and Astro token fallback.
focused red command: source task previously captured failing regressions before implementation; no additional red is required for a byte-equivalent rehome.
expected red failure: anonymous nested trace rows, missing child tool identity, and missing token fallback as documented in source-task evidence.
no-test waiver: rehome-only transport step; no new behavior is being authored. Re-run focused tests and full verify after applying the source patch.

- 2026-08-16 06:29:47 append: `.task/trace-observability/fix-batch-trace-observability-rendering/workpad.md`

## Rehome validation

- Applied the 9-file product patch from source commit `ccd3b77e4886b265ccb353691dfd8d46dcdc6961` cleanly onto `stream/trace-observability`; no source-task metadata was carried over.
- Focused tests green in the new task: OS Trace Burn suites 32/32 and batch executor 6/6 (`trc_96e39dd6bc57`).
- Full verify against `origin/stream/trace-observability` passed with 0 review blockers and 0 DB risks (`trc_3679d74423d7`).

- 2026-08-16 06:30:56 append: `.task/trace-observability/fix-batch-trace-observability-rendering/workpad.md`
