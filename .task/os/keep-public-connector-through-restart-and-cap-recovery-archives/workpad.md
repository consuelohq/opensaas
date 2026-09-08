# keep public connector through restart and cap recovery archives

branch: `task/os/keep-public-connector-through-restart-and-cap-recovery-archives`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2309
started: 2026-08-30

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/tests/task-recovery-archive-retention.test.ts`

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
1. `consuelo restart` must not fail closed when `com.consuelo.watchdog` launchctl bootstrap/kickstart returns macOS error 5 (Input/output) or 37. Watchdog is a sidecar, not the public MCP ingress. Caddy + system + cloudflared remain the availability boundary.
2. Task recovery bundles must not archive the whole repo when the task branch has no `origin/<branch>` ref. Use `origin/main` (or another existing origin ref) as the bundle anchor, and prune recovery archives older than 7 days from `node/tasks/archives`.
3. Watchdog public-route reconciliation must not treat HTTP 429 as a local restart reason.

existing local pattern:
- `packages/os/scripts/lib/lifecycle/service.ts` already skips the invoking XPC service label because watchdog restart races launchd (errors 5/37). That filter is not enough: a manual `consuelo restart` still fail-closes the whole restart on watchdog bootstrap I/O.
- `packages/os/scripts/lib/task-worktree-eviction.js` creates `recovery.bundle` with `git bundle create <ref>` and only adds `^remoteSha` when the task branch exists on origin. Missing remoteSha produced ~837MB full-repo bundles that never expired.
- `packages/os/scripts/workspace-watchdog.sh` restarts the node after 3 public-route failures, including heartbeat 429 storms.

new or changed tests:
- `packages/os/tests/lifecycle-restart-contract.test.ts`: watchdog sidecar bootstrap I/O is best-effort; restart still succeeds.
- `packages/os/tests/durable-task-worktrees.test.ts` or a focused eviction/archive test: missing origin task-ref uses origin/main as bundle exclude; old archives prune.
- `packages/os/tests/system-daemon-reliability.test.ts`: watchdog 429 does not increment public-route restart.

focused red command:
`bun test packages/os/tests/lifecycle-restart-contract.test.ts packages/os/tests/durable-task-worktrees.test.ts packages/os/tests/system-daemon-reliability.test.ts`

expected red failure:
new assertions for best-effort watchdog bootstrap and archive prune/anchor are not implemented yet.

no-test waiver: not applicable

- 2026-08-30 17:41:31 append: `.task/os/keep-public-connector-through-restart-and-cap-recovery-archives/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/task-recovery-archive-retention.test.ts`

## workspace-owned: activity log

- 2026-08-30 17:41:31 fs.write: `.task/os/keep-public-connector-through-restart-and-cap-recovery-archives/workpad.md`
- 2026-08-30 17:44:53 write: `packages/os/tests/task-recovery-archive-retention.test.ts`
- 2026-08-30 17:44:53 fs.write: `packages/os/tests/task-recovery-archive-retention.test.ts`
