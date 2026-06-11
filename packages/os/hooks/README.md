# OS hooks

Hooks are small workflow entrypoints that run around OS/operator events.

They live outside `scripts` because they are intended to be reusable automation surfaces, not direct CLI commands only. Scripts may call hooks, task tooling may call hooks, and future event pipelines can call hooks without moving the implementation.

Current hooks:

- `task/guidance.js` — returns structured task lifecycle guidance built from the task skill's exact anchor wording, with concrete just-in-time OS calls for task workflow stages.
