# Workspace-agent stream instructions

- Use `session.start({ kind: "task" })` for repository mutation. `task.start` remains a compatibility alias only.
- Use `session.start({ kind: "work", path })` for ordinary node-local filesystem work. Work sessions create metadata and node affinity only; they do not create branches, worktrees, or PRs.
- Treat `taskSession` and `workSession` as mutually exclusive mutation authorities. Never use a work session to edit the managed default repository or a registered task worktree.
- Route task/work sessions to their owning node. Affinity is fail-closed: do not silently move session-owned work to another node when its owner is offline.
- Work-session affinity is a renewable seven-day lease refreshed by use. There is no work-session finish command in this tranche; task lifecycle commands remain task-specific.
- Keep Code Call and filesystem mutation boundaries aligned. Changes to session routing, containment, or affinity require focused regression coverage before promotion.
- Prefer the canonical `packages/os` implementation. `packages/workspace` is deprecated and must not gain new runtime behavior.
