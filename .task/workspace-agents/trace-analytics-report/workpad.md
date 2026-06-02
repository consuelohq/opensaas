# trace analytics report

branch: `task/workspace-agents/trace-analytics-report`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/516/trace-analytics-report
github pr: https://github.com/consuelohq/opensaas/pull/516
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `scripts/operator/trace-analytics.ts`

## workspace-owned: files changed

- `scripts/operator/trace-analytics.ts`

## workspace-owned: activity log

- 2026-05-23 09:08:11 fs.write: `.task/workspace-agents/trace-analytics-report/workpad.md`
- 2026-05-23 09:09:08 fs.write: `scripts/operator/trace-analytics.ts`
- 2026-05-23 09:09:49 fs.write: `.task/workspace-agents/trace-analytics-report/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 09:09:38 `verify`: passed — OK

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

- Restore the depth of the original `/tmp/workspace-trace-analytics.sh` report in the durable Bun operator script.
- Keep corrected day/week/month token behavior.
- Keep this as `bun run trace:analytics`, not a workspace tool.
- Validate against the live trace DB.

### plan before editing

1. Read the durable operator script and the temp bash reference.
2. Patch the Bun script so it includes the same report sections as the temp script plus mixed-token sections.
3. Run `bun run trace:analytics` and inspect output for missing/blank tables.
4. Run focused verification and publish.

- 2026-05-23 09:08:11 append: `.task/workspace-agents/trace-analytics-report/workpad.md`

- 2026-05-23 09:09:08 write: `scripts/operator/trace-analytics.ts`

## final validation before publish

Files changed:

- `scripts/operator/trace-analytics.ts`

Fix:

- Replaced the incomplete Bun conversion with a full operator report based on `/tmp/workspace-trace-analytics.sh`.
- Preserved the original report depth:
  - token coverage
  - tracked token coverage
  - top tools by tracked tokens
  - top branches by tracked tokens
  - top errors
  - recent errors
  - slowest calls
  - high-output calls
  - active traced task branches
- Added corrected mixed-token sections while keeping tracked-token sections.

Validation evidence:

- `bun run trace:analytics`: passed against the live trace DB and all expected sections render with populated values.
- `verify --base origin/main --no-review --no-db`: passed.

- 2026-05-23 09:09:49 append: `.task/workspace-agents/trace-analytics-report/workpad.md`
