# accept owned subagent exit markers without pid match

stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2315

## acceptance criteria

- [x] An owned exit marker recovers `completion_unknown` even when persisted `run.pid` is missing.
- [x] Runner keeps provider log fds open until the provider exits.
- [x] Focused suite green.

CI still failed inherited-secrets/Grok with `completion_unknown` after 15s even though the provider ran. Exit markers were rejected because `marker.runnerPid === run.pid` fails when the persisted pid lags or mismatches the detached runner pid on Linux.

## validation

```text
bun test tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts tests/workspace-gateway-node-end-to-end.test.ts
37 pass, 0 fail
```

- 2026-08-30 20:12:07 write: `.task/os/accept-owned-subagent-exit-markers-without-pid-match/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 20:12:07 fs.write: `.task/os/accept-owned-subagent-exit-markers-without-pid-match/workpad.md`
