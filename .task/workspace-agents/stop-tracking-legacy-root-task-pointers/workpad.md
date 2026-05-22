# stop tracking legacy root task pointers

branch: `task/workspace-agents/stop-tracking-legacy-root-task-pointers`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/452/stop-tracking-legacy-root-task-pointers

## acceptance criteria

- Remove tracked root task pointer files from git so new worktrees do not inherit stale task state.
- Keep scoped task metadata intact.
- Verify the exact stale-session reproduction with two new tasks after the fix is present.

## plan

1. Remove `.task/current.json`, `.task/session.json`, `.task/workpad.md`, `.task/verify.json` from the task branch.
2. Preserve scoped task metadata under `.task/workspace-agents/stop-tracking-legacy-root-task-pointers/`.
3. Push the branch.
4. Start two smoke tasks from the fixed branch and verify root pointer files are absent and taskSession resolution works.

## notes

This task exists because root task pointer files were still tracked in git. Local cleanup alone was insufficient because `task.start` checks out tracked files into every new worktree.

## validation

Pending after branch push: two-task stale-session smoke.
