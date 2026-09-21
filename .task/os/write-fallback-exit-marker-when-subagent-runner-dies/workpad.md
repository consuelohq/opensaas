# write fallback exit marker when subagent runner dies

branch: `task/os/write-fallback-exit-marker-when-subagent-runner-dies`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2319/write-fallback-exit-marker-when-subagent-runner-dies
github pr: https://github.com/consuelohq/opensaas/pull/2319
started: 2026-08-30

## acceptance criteria

- [x] When the detached bun `runner.ts` process exits without writing `exit.json`, the parent `startDurableSubagentRun` writes an owned fallback `exit.json` (`runId` + `ownerToken` + numeric `runnerPid`).
- [x] `waitForDurableSubagentRun` then settles to `completed`/`failed` instead of hanging on `completion_unknown`.
- [x] Existing owned runner markers are not overwritten (`existsSync` before write).
- [x] Remove the runner `beforeExit` `setImmediate` keep-alive that starved provider `close` on Linux CI.
- [x] Do not weaken Consuelo / verify product assertions. Do not ship stable. Target stream PR 2310 then canary.

## Test-first contract

- **behavior under test:** parent observes runner process exit and publishes an owned `exit.json` when the runner did not.
- **existing local pattern:** pidless-marker and wait-unknown tests in `subagent-lifecycle-regressions.test.ts`.
- **new test:** `writes a parent fallback exit marker when the runner dies without publishing one`
- **focused red command:** `bun test tests/subagent-lifecycle-regressions.test.ts -t "writes a parent fallback exit marker"` from `packages/os`
- **red result:** `completion_unknown runner exited without a durable exit marker; no provider was respawned` / `timedOut: true` (15.05s)
- **green result:** same command pass in 56ms after parent `child.once('exit')` fallback.

## implementation

1. `startDurableSubagentRun` attaches `attachRunnerExitFallback(child)` **before** `unref()`.
2. On runner `exit`, if `exit.json` is missing, write an owned marker with `outcome` from the process exit code/signal.
3. Runner `beforeExit` is now a one-shot `finish()` (no `setImmediate` keep-alive).

## files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`

## green evidence

From `packages/os`:

```text
bun test tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts tests/workspace-gateway-node-end-to-end.test.ts tests/trace-gateway-home-cache.test.ts
39 pass / 0 fail / 6.66s
```

Includes inherited secrets, Grok durable runner, bounded log tail, owner publication, gateway traces, and the new SIGKILL fallback test.

## key decisions

- Parent fallback is the safety net for Linux CI where the bun runner can die without `exit.json`.
- Keep runner spawn `detached: true`. Attach the exit listener before `unref()` so the parent still observes death while remaining durable.
- Fallback marker includes numeric `runnerPid` because `readExitMarker` requires it.
- Do not overwrite an already-published owned marker.

## publish

Promote into `stream/os` (PR 2310). Release canary only after Consuelo / verify is green. No stable.

- 2026-08-30 21:15:17 write: `.task/os/write-fallback-exit-marker-when-subagent-runner-dies/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`

## workspace-owned: activity log

- 2026-08-30 21:15:17 fs.write: `.task/os/write-fallback-exit-marker-when-subagent-runner-dies/workpad.md`

## workspace-owned: validation evidence

- 2026-08-30 21:15:35 `review.run`: passed — OK
