# rename approved flag

branch: `task/workspace-agents/rename-approved-flag`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/573/rename-approved-flag
github pr: https://github.com/consuelohq/opensaas/pull/573
taskSession: `tsk_1c11d1616a1e`
started: 2026-05-24

## objective

Rename the task push flag to `--approved` / `approved`, keep `--reason`, and preserve the verify stamp gate.

## plan

1. Carry over code and docs.
2. Validate script, schema, manifest, docs, and verify.
3. Push, promote, ship, restart, and smoke the live facade.
4. Close stale temporary PRs where safe.

- 2026-05-24 06:52:47 write: `.task/workspace-agents/rename-approved-flag/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-24 06:52:47 fs.write: `.task/workspace-agents/rename-approved-flag/workpad.md`
- 2026-05-24 06:54:24 fs.write: `.task/workspace-agents/rename-approved-flag/workpad.md`

## workspace-owned: validation evidence

- 2026-05-24 06:54:07 `verify`: passed — OK

## validation

Checks passed: script syntax, manifest parse, facade validation subset, audit, diff inspection, and formal verify against `origin/main`.

Ready to push and promote.

- 2026-05-24 06:54:24 append: `.task/workspace-agents/rename-approved-flag/workpad.md`
