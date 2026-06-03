# complete diff cockpit workpad

branch: `task/diff-cockpit/complete-diff-cockpit-workpad`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/723/complete-diff-cockpit-workpad
github pr: https://github.com/consuelohq/opensaas/pull/723
started: 2026-06-03

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

- none yet

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## Implementation summary

This follow-up exists only to carry the completed workpad from `add-live-pr-diff-cockpit` into the remote `stream/diff-cockpit` branch after the first task PR was promoted with the workpad acknowledgement path. No product code changed.

## Validation

- Copied the completed `.task/diff-cockpit/add-live-pr-diff-cockpit/workpad.md` from the original task worktree.
- Confirmed this task changes task metadata/workpad only.

## Follow-up

After this task is promoted, stream PR #722 should contain the complete implementation summary for the original diff cockpit task.
