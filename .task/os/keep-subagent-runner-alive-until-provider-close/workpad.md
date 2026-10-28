# keep subagent runner alive until provider close

branch: `task/os/keep-subagent-runner-alive-until-provider-close`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2318

## what changed

CI now prints: `TIMEOUT | completion_unknown | runner exited without a durable exit marker; no provider was respawned`.

That means the bun runner process died with a known pid and never wrote `exit.json`. On Linux, bun can drain the event loop before the provider `close` handler runs. `beforeExit` now:

1. Keeps the loop alive with `setImmediate` while the provider is still running.
2. If the provider already exited, writes the missing exit marker as completed/failed from `provider.exitCode`.

## validation

```text
bun test tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts
36 pass, 0 fail
```

- 2026-08-30 20:53:07 write: `.task/os/keep-subagent-runner-alive-until-provider-close/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 20:53:07 fs.write: `.task/os/keep-subagent-runner-alive-until-provider-close/workpad.md`
