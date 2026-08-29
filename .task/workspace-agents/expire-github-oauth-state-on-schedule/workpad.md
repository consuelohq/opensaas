# expire GitHub OAuth state on schedule

branch: `task/workspace-agents/expire-github-oauth-state-on-schedule`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2271
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: GitHub source-control install/OAuth states are physically deleted from Durable Object storage after their `expiresAt`, including abandoned flows that contain a GitHub user access token; the next earliest unexpired state remains scheduled.
existing local pattern: `DurableStore` owns the `gss:` GitHub install-state keys and the Device Authority Durable Object owns Cloudflare alarm lifecycle.
new or changed tests: add a focused DurableStore contract in `packages/os/tests/os-device-authority-architecture.test.ts` that writes two GitHub install states, asserts the earliest alarm is scheduled, runs expiry cleanup, proves the expired token-bearing state is deleted, and proves the later state remains/schedules the next alarm.
focused red command: `bun test packages/os/tests/os-device-authority-architecture.test.ts`
expected red failure: `StorageLike`/`DurableStore` currently expose no alarm scheduling or `cleanupExpiredGitHubSourceControlInstallStates` method, so abandoned `gss:` records have no physical expiry path.
no-test waiver: not applicable.

## review context

Codex P2 on stream PR #2269: abandoned multi-install/new-install flows can leave the short-lived GitHub user access token persisted indefinitely even though route-level reads reject expired state. Fix at storage lifecycle rather than weakening GitHub installation verification.

- 2026-08-29 02:04:23 append: `.task/workspace-agents/expire-github-oauth-state-on-schedule/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 02:04:23 fs.write: `.task/workspace-agents/expire-github-oauth-state-on-schedule/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`

- 2026-08-29 02:05:41 apply-patch: `packages/os/cloudflare/os-device-authority/src/types.ts`
- 2026-08-29 02:05:41 apply-patch: `packages/os/cloudflare/os-device-authority/src/stores.ts`
- 2026-08-29 02:05:41 apply-patch: `packages/os/cloudflare/os-device-authority/src/worker.ts`

## workspace-owned: validation evidence

- 2026-08-29 02:06:50 `review.run`: passed — OK
- 2026-08-29 02:07:19 `verify`: passed — OK
