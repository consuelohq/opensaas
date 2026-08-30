# infer completed fallback when drained runner dies

branch: `task/os/infer-completed-fallback-when-drained-runner-dies`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2320
started: 2026-08-30

## acceptance criteria

- [x] Parent fallback `exit.json` is `completed` when the runner dies without a marker and was not signaled, including Linux event-loop drain with non-zero/null exit if stdout exists.
- [x] SIGKILL of the runner still settles `failed`.
- [x] Grok durable runner and wait-unknown tests settle `completed` instead of `failed`.
- [x] Do not weaken Consuelo / verify assertions. Canary after 2310 green. No stable.

## Test-first contract

- **behavior under test:** drained/unsignaled runner death with provider stdout is `completed`; signaled death is `failed`.
- **CI red evidence:** PR 2310 job 99322871287 failed Grok + wait-unknown with `Received: failed` / `runner process exited without writing a durable exit marker`.
- **green evidence:** `bun test` of the four OS files: 39 pass / 0 fail / 6.80s

## implementation

`inferFallbackOutcome`: signal → failed; code 0/null → completed; non-zero with stdout bytes → completed; else failed.

## files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`

## workspace-owned: activity log

- 2026-08-30 21:31:09 fs.write: `.task/os/infer-completed-fallback-when-drained-runner-dies/workpad.md`
