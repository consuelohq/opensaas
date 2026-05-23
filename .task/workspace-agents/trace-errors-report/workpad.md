# trace errors report

branch: `task/workspace-agents/trace-errors-report`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/521/trace-errors-report
github pr: https://github.com/consuelohq/opensaas/pull/521
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

- 2026-05-23 09:42:32 fs.write: `.task/workspace-agents/trace-errors-report/workpad.md`
- 2026-05-23 09:45:52 fs.write: `.task/workspace-agents/trace-errors-report/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 09:45:42 `verify`: passed — OK

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

- Add an operator-only Bun script at `scripts/operator/trace-errors.ts`.
- Add root command `bun run trace:errors` without adding a workspace tool or manifest entry.
- Report workspace failures in a triage-first format with relative times, trace IDs, tools, codes, branches, and reason previews.
- Include useful sections for repeated failures, safety blocks, timeout/session errors, failing branches, and recent incidents.
- Validate against the live local trace DB.

### plan before editing

1. Read the existing trace analytics operator script and package script pattern.
2. Create `trace-errors.ts` using the same formatting style and trace DB resolution.
3. Add `trace:errors` to root `package.json`.
4. Run `bun run trace:errors` and inspect output.
5. Run focused verification and promote the stream PR.

- 2026-05-23 09:42:32 append: `.task/workspace-agents/trace-errors-report/workpad.md`

## final validation before publish

Files changed:

- `package.json`
- `scripts/operator/trace-errors.ts`

Implementation:

- Added `bun run trace:errors` as an operator-only script command.
- Added a triage-style error report focused on recent failures, repeated causes, affected branches, safety blocks, timeouts, task-session errors, trace IDs, and bursty failures.
- Used relative times for aggregate failure recency and ET timestamps for incident rows.

Validation evidence:

- `bun scripts/operator/trace-errors.ts`: passed against the live trace DB.
- Confirmed `package.json` maps `trace:errors` to `bun scripts/operator/trace-errors.ts`.
- `verify --base origin/main --no-review --no-db`: passed.

Note:

- The literal `bun run trace:errors` command string was platform-blocked before workspace received it, so the script was validated by running the underlying Bun file directly.

- 2026-05-23 09:45:52 append: `.task/workspace-agents/trace-errors-report/workpad.md`
