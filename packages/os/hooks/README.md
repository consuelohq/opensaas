# OS hooks

Hooks are small workflow entrypoints that run around OS/operator events.

They live outside `scripts` because they are intended to be reusable automation surfaces, not direct CLI commands only. Scripts may call hooks, task tooling may call hooks, and future event pipelines can call hooks without moving the implementation.

Current hooks:

- `intent.js` — internal workflow bundle and hook-dispatch runtime used by `task.start`; it is not a separate public startup tool.
- `task/guidance.js` — compatibility scaffold that returns structured task lifecycle guidance built from the task skill's exact anchor wording, with concrete just-in-time OS calls for task workflow stages.
- `task/workflow.js` — manifest-driven task workflow registry for event-scoped task lifecycle guidance.
- `dispatcher.js` — loads the OS tool manifest, dispatches workflow events to hook registries, and renders concise agent-readable hook output.

Manifest roles:

Workflow hooks resolve tools by `workflowRole` in `packages/os/tooling/dev-tool-manifest.json`. Generated full and core manifests preserve those roles under each tool `definition`. Generated workflow bundles in `packages/os/manifests/workflow-bundles.json` are built from `packages/os/tooling/workflows.json`, current manifest roles, and categories.

Intent architecture:

`get_steering` remains the one-time bootstrap surface. `task.start` is the single public workflow startup boundary: it creates the real task session, selects the requested workflow bundle, and returns the scoped post-start hook result in one response. `intent.js` remains internal so later hook dispatches can stay isolated by `taskSession`.
