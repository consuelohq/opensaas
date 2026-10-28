# Fix OS launchd Bun runtime path

branch: `task/security/fix-os-launchd-bun-runtime-path`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1508/fix-os-launchd-bun-runtime-path
github pr: https://github.com/consuelohq/opensaas/pull/1508
started: 2026-07-15

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

- none yet

## workspace-owned: validation evidence

- 2026-07-15 03:49:26 `review.run`: passed — OK
- 2026-07-15 03:52:08 `verify`: passed — OK

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
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria
- Fresh installs preserve the absolute Bun binary selected or installed by bootstrap.
- The launchd OS process PATH includes the directory containing BUN_BIN.
- Nested facade tool execution can resolve the literal bun command without user shell configuration.
- Existing installs are repaired by restarting through the updated startup wrapper.

## Test-first contract
- Behavior: start-consuelo-daemon.sh prepends dirname(BUN_BIN) to a launchd-style PATH when absent and does not duplicate it when present.
- Existing pattern: Vitest contract tests execute real OS shell wrappers with isolated temporary fixtures.
- New test: packages/os/tests/daemon-bun-path.test.ts.
- Focused red command: bun test packages/os/tests/daemon-bun-path.test.ts.
- Expected red failure: emitted child PATH omits the configured Bun directory.
- Production target after red: packages/os/scripts/start-consuelo-daemon.sh.

## Red evidence
- bun test packages/os/tests/daemon-bun-path.test.ts
- Result: 1 failed, 1 passed. Missing-path case emitted /usr/bin:/bin; expected configured Bun directory first.

## Implementation
- start-consuelo-daemon.sh now prepends dirname(BUN_BIN) to PATH only when absent before execing the OS server.

## Green evidence
- bash -n packages/os/scripts/start-consuelo-daemon.sh: passed.
- bun test packages/os/tests/daemon-bun-path.test.ts: 2 passed, 0 failed.
- Package-scoped related run: 46 passed, 1 unrelated failure.
- Installer runtime dependencies: 17 passed.
- Bun product server contract: 4 passed.
- Local OS Hono architecture: 14 passed.
- Local port cutover: 9 passed; one existing contract fails because packages/documentation/src/content/docs/os/getting-started/install.mdx is absent on current main. No related code was changed.

## Files changed
- packages/os/scripts/start-consuelo-daemon.sh
- packages/os/tests/daemon-bun-path.test.ts

## Key decision
- Repair PATH at the process boundary using dirname(BUN_BIN), rather than hardcoding ~/.bun/bin or changing Bun installation. This supports official Bun installs, Homebrew, custom paths, and existing LaunchAgents after restart.

## workspace-owned: test selection

- changed files: `.task/security/fix-os-launchd-bun-runtime-path/current.json`, `.task/security/fix-os-launchd-bun-runtime-path/session.json`, `.task/security/fix-os-launchd-bun-runtime-path/workpad.md`, `.task/tasks/security/fix-os-launchd-bun-runtime-path.json`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/tests/daemon-bun-path.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
