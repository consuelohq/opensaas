# Workspace hooks

Hooks are small workflow entrypoints that run around workspace/operator events.

They live outside `scripts` because they are intended to be reusable automation surfaces, not direct CLI commands only. Scripts may call hooks, task tooling may call hooks, and future event pipelines can call hooks without moving the implementation.

Current hooks:

- `diff-cockpit/cache-refresh.ts` — refreshes and prewarms `diffs.consuelohq.com` homepage/PR API cache entries after task or stream events.
