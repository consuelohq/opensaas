# keep subagent provider attached to runner until exit

pr: https://github.com/consuelohq/opensaas/pull/2316
stream: stream/os

## acceptance criteria

- [x] Subagent runner does not detach the provider, so close/exit markers always publish.
- [x] Runner process.exit after writing the exit marker.
- [x] Focused grok + lifecycle tests green.

Linux CI still left inherited-secrets/Grok in completion_unknown after the provider ran: the detached provider outlived a runner that never wrote exit.json. Attach the provider to the runner and exit the runner only after the marker is on disk.

## validation

bun test tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts
36 pass, 0 fail

- 2026-08-30 20:25:17 write: `.task/os/keep-subagent-provider-attached-to-runner-until-exit/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 20:25:17 fs.write: `.task/os/keep-subagent-provider-attached-to-runner-until-exit/workpad.md`
