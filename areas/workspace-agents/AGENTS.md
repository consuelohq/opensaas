# workspace-agents stream agent instructions

This stream owns the workspace agent operating layer: typed workspace facade commands, task lifecycle scripts, stream/task workflows, decision-engine helpers, review tooling, and agent-facing docs.

## read order

1. Root AGENTS.md
2. Root CODING-STANDARDS.md
3. packages/workspace/STEERING.md
4. packages/workspace/SCRIPTS.md
5. This file

## operating rules

- Work only on stream/workspace-agents unless ko explicitly selects another stream.
- Start code/doc changes through the task workflow: stream.context -> task.start -> workpad -> validate -> task.push -> task.pr.
- Treat workspace facade envelopes as the API contract. Keep JSON output stable and parseable.
- Prefer central facade-layer changes over per-script duplication when changing tool result behavior.
- Keep agent helper primitives small, typed, and observable before adding blocking behavior.
- Record workflow decisions in .task/workpad.md; save durable learnings to the closest relevant AGENTS.md.

## validation

For workspace script or facade changes, run the narrow script/test first, then workspace review.run for the task branch. Regenerate generated workspace docs/types when manifest or schema surfaces change.
