# isolate grok discovery durable run ids

branch: `task/os/isolate-grok-discovery-durable-run-ids`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2321

## acceptance criteria

- [x] Each Grok discovery test uses a unique durable run id and isolated CONSUELO_HOME.
- [x] Wire `grokCompletionFailure` after durable wait so Cancelled/empty Grok runs are `failed`.
- [x] Original product assertions unchanged.

## green evidence

`bun test` of discovery + lifecycle + orchestration + gateway + trace-cache: **47 pass / 0 fail**.

## files changed

- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`

## workspace-owned: activity log

- 2026-08-30 21:50:50 fs.write: `.task/os/isolate-grok-discovery-durable-run-ids/workpad.md`
