# trace errors operator report

branch: `task/workspace-agents/trace-errors-operator-report`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/523/trace-errors-operator-report
github pr: https://github.com/consuelohq/opensaas/pull/523
started: 2026-05-23

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

- 2026-05-23 09:48:37 fs.write: `.task/workspace-agents/trace-errors-operator-report/workpad.md`
- 2026-05-23 09:49:54 fs.write: `.task/workspace-agents/trace-errors-operator-report/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 09:49:40 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## implementation checkpoint — initial task setup

### acceptance criteria

- Land the validated `trace:errors` operator report from a fresh main-based branch.
- Add `scripts/operator/trace-errors.ts`.
- Add root package script `trace:errors`.
- Validate by running the script directly and verify.
- Promote to the stream PR cleanly.

### plan before editing

1. Copy the validated `trace-errors.ts` from `/tmp` into the fresh task branch.
2. Add the package script next to `trace:analytics`.
3. Run the operator report against the live trace DB.
4. Run focused verify and publish.

- 2026-05-23 09:48:37 append: `.task/workspace-agents/trace-errors-operator-report/workpad.md`

## final validation before publish

Files changed:

- `package.json`
- `scripts/operator/trace-errors.ts`

Implementation:

- Added `bun run trace:errors` as an operator-only script command.
- Added a triage-style error report focused on recent failures, repeated causes, affected branches, safety blocks, timeouts, task-session errors, trace IDs, and bursty failures.
- Used relative times for aggregate failure recency and ET timestamps for incident rows.
- Recovered from PR conflict by restarting from current main and reapplying the validated script.

Validation evidence:

- `bun scripts/operator/trace-errors.ts`: passed against the live trace DB.
- `verify --base origin/main --no-review --no-db`: passed.

- 2026-05-23 09:49:54 append: `.task/workspace-agents/trace-errors-operator-report/workpad.md`
