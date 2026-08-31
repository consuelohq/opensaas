# Finish updater rolling handoff and watchdog convergence

branch: `task/os/finish-updater-rolling-handoff-and-watchdog-convergence`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2138/finish-updater-rolling-handoff-and-watchdog-convergence
github pr: https://github.com/consuelohq/opensaas/pull/2138
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 06:32:09 fs.write: `.task/os/finish-updater-rolling-handoff-and-watchdog-convergence/workpad.md`
- 2026-08-16 06:38:22 fs.write: `.task/os/finish-updater-rolling-handoff-and-watchdog-convergence/workpad.md`
- 2026-08-16 06:41:29 fs.write: `.task/os/finish-updater-rolling-handoff-and-watchdog-convergence/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:38:58 `review.run`: passed — OK
- 2026-08-16 06:41:43 `review.run`: passed — OK
- 2026-08-16 06:42:08 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: (1) a rolling reload must not drain the next worker until Caddy has had a full admission window to mark the newly replaced worker healthy; (2) same-version service reconciliation must tolerate the known transient macOS launchctl kickstart failure for managed support services such as `com.consuelo.watchdog` using the same bounded retry contract used for gateway services.
existing local pattern: worker replacement waits only for direct `/ready`; Caddy active health checks run every 2s. macOS service reconciliation already has bounded retry/bootstrap logic for selected gateway LaunchAgents.
new or changed tests: add worker-pool ordering coverage proving an inter-slot admission delay after replacement readiness, and add macOS lifecycle/service coverage for transient watchdog kickstart failure followed by success.
focused red commands: targeted worker-pool rolling replacement test and targeted macOS service reload/kickstart test before production edits.
expected red failures: current supervisor drains worker-1 immediately after worker-0 direct readiness; current watchdog reconciliation propagates launchctl exit 37 instead of retrying/recovering.
no-test waiver: none.

## Live evidence

During 0.1.61 same-version update, Caddy marked 46321 unhealthy at 06:29:46/48/50, the supervisor replaced worker-0 and began draining worker-1 before Caddy re-admitted 46321 at 06:29:52, and `/mcp` returned 502 EOF at 06:29:51.568 (`trc_38e29591ff18`). The same lifecycle operation then failed on `com.consuelo.watchdog` kickstart exit 37 (`trc_c3c4f9dd0070`). Caddy/Cloudflared themselves stayed running.

- 2026-08-16 06:32:09 append: `.task/os/finish-updater-rolling-handoff-and-watchdog-convergence/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`

- 2026-08-16 06:34:34 apply-patch: `packages/os/scripts/lib/worker-pool.ts`
- 2026-08-16 06:34:42 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`
- 2026-08-16 06:36:32 apply-patch: `packages/os/SCRIPTS.md`
## Validation update

- RED: worker rolling test proved no 3s Caddy-admission barrier existed between worker-0 replacement readiness and worker-1 drain; watchdog test proved launchctl exit 37 failed immediately (`trc_b5e71f2c8642`).
- GREEN focused regressions: both pass (`trc_0c45569fef92`).
- Affected lifecycle/worker suite: 38/38 passed (`trc_eaeace01078e`).
- Full critical lifecycle gate: 19 files / 205 tests passed (`trc_fe66b37e0edd`).
- Main selection integrity: 43/43 passed (`trc_6156957753f3`).
- Syntax: passed (`trc_2158965c6a51`).
- Live watchdog was manually restored from its managed LaunchAgent plist before code work (`trc_c9bdc291c354`).
- Product diff is five files: lifecycle service retry, worker-pool Caddy admission barrier, their two focused test files, and SCRIPTS.md. No Device Authority or blocked stream-conflict files are touched.

- 2026-08-16 06:38:22 append: `.task/os/finish-updater-rolling-handoff-and-watchdog-convergence/workpad.md`

- 2026-08-16 06:40:37 apply-patch: `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- 2026-08-16 06:40:37 apply-patch: `packages/documentation/src/content/docs/reference/configuration.mdx`
## Documentation evidence

- Current documentation source of truth confirmed as Astro/Starlight under `packages/documentation` (`trc_90d819b060e3`).
- Updated Install Consuelo OS and Configuration with the Caddy re-admission barrier and diagnostic propagation timing.
- Docs validate passed and foundation tests 19/19 passed (`trc_d26c3340faef`).
- Astro build cannot be treated as product evidence in this task worktree because `packages/documentation/node_modules` is an absolute symlink to the main worktree (`trc_e7c670a7dd95`), and Astro's compile metadata mixes the two absolute roots. The failure is the known worktree dependency-path artifact, not an MDX/content validation failure.

- 2026-08-16 06:41:29 append: `.task/os/finish-updater-rolling-handoff-and-watchdog-convergence/workpad.md`
