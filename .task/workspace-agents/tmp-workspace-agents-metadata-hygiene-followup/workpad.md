# tmp(workspace-agents): metadata hygiene followup

Purpose: remove the remaining tracked root `.task/current.json` from `stream/workspace-agents` so new task worktrees do not inherit stale root task pointers.

Validation: rerun two task-start smoke tests from stream after promotion.
