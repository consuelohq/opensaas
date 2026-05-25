# show batch child tool names in trace watch

branch: `task/workspace-agents/show-batch-child-tool-names-in-trace-watch`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/570/show-batch-child-tool-names-in-trace-watch
github pr: https://github.com/consuelohq/opensaas/pull/570
taskSession: `tsk_6878c0e8720c`
started: 2026-05-24

## objective

Fix `trace:watch` nested batch child rows so they show each child tool name instead of `unknown`.

## acceptance criteria

- [x] Existing `code.run` nested rows keep working.
- [x] Existing `batch` nested rows show child tool names from persisted trace input.
- [x] Keep the parent trace row format unchanged.
- [x] Keep the change minimal and renderer-only.

## root cause

Persisted batch `resolved_input_json` is an array of resolved step objects, while the first renderer assumed an object with a `steps` property. The original `input_json` can be `{ steps: [...] }`, but the resolved input shape used by recent traces is `[{ tool, input, parallel }, ...]`.

## files changed

- `scripts/operator/trace-watch.ts`

## validation evidence

- Inspected raw batch trace payload with `trace:watch --raw-json`; confirmed `resolved_input_json` is an array and `input_json` is `{ steps: [...] }`.
- `bun run trace:watch -- --once --limit 3 --tool batch --no-color --nested-limit 5`: passed; child rows now show `task.exec` and `audit` instead of `unknown`.
- `bun build scripts/operator/trace-watch.ts --target=bun --outfile=/tmp/trace-watch-batch-build.js`: passed.
- `git diff -- scripts/operator/trace-watch.ts`: inspected; one-line renderer extraction fix.

## notes

Task branch was merged with `origin/stream/workspace-agents` first so this follow-up is based on the previously promoted trace-watch nested operation change.
