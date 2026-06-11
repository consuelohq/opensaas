# OS hooks

Hooks are small workflow entrypoints that run around OS/operator events.

They live outside `scripts` because they are intended to be reusable automation surfaces, not direct CLI commands only. Scripts may call hooks, task tooling may call hooks, and future event pipelines can call hooks without moving the implementation.

Current hooks:

- `task/guidance.js` — compatibility scaffold that returns structured task lifecycle guidance built from the task skill's exact anchor wording, with concrete just-in-time OS calls for task workflow stages.
- `task/workflow.js` — manifest-driven task workflow registry for event-scoped task lifecycle guidance.
- `dispatcher.js` — loads the OS tool manifest, dispatches workflow events to hook registries, and renders concise agent-readable hook output.

Manifest roles:

Task workflow hooks resolve tools by `workflowRole` in `packages/os/tooling/dev-tool-manifest.json`. Generated full and core manifests preserve those roles under each tool `definition`. Keep the role in the manifest source when adding or renaming workflow tools; the dispatcher fallback is legacy compatibility for older manifests, not the normal path.
