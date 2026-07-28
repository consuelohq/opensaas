# repair local agent lifecycle caddy ingress and restart recovery

branch: `task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery`
stream: `stream/os`
github pr: https://github.com/consuelohq/opensaas/pull/1710
recovered: 2026-07-28 after the host crash cleared the temporary worktree

## acceptance criteria

- [x] Codex, Grok, OpenCode, and other detected local agents configure the main MCP as `consuelo`, with Consuelo Dialer remaining separate.
- [x] Local agent MCP processes are thin stdio-to-host bridges and never run the mutable OS runtime inside an app sandbox.
- [x] Noninteractive installs configure detected local agents and install/start managed daemons unless explicitly skipped.
- [x] Managed topology is Cloudflare edge/tunnel -> loopback Caddy ingress -> private loopback Bun runtime.
- [x] Caddy is pinned, verified, installed, supervised, health-checked, rolled back on failure, and removed by uninstall.
- [x] Only recognized conflicting Portless launch agents are retired; unrelated processes/configuration are preserved.
- [x] Agent credentials are per-agent, mode 0600, loopback-only, and never exposed in diagnostics or forwarded off-host.
- [x] GUI daemon launch strips inherited workspace, API, and Cloudflare secrets.
- [x] Restart windows return a transport-valid retryable JSON-RPC response.
- [x] Focused lifecycle, installer, gateway, security, and daemon tests pass.
- [x] Workspace review and verify gates pass before push.
- [ ] Live uninstall/reinstall is deferred until Ko explicitly starts that transition.

## diagnosis

- Codex's Connected badge reflected a persisted plugin link while the spawned MCP transport was terminating.
- `mcp-stdio.ts` ran the full mutable runtime inside Codex's sandbox and hit a read-only database.
- `--yes` installation skipped agent selection and daemons by default.
- Caddy configuration existed without a managed Caddy binary/process; cloudflared bypassed it.
- Two recognized Portless agents could conflict and hot-loop.
- GUI launchd could inherit sensitive environment variables.
- The host crash cleared the original uncommitted temporary worktree; the task branch and PR survived at the bootstrap commit.

## intended topology

`remote MCP -> Cloudflare auth/edge -> cloudflared -> 127.0.0.1:46320 Caddy -> 127.0.0.1:46321 Bun`

## validation evidence

- Previous pre-crash reconstruction reached 146/149 focused Vitest contracts; the three remaining failures were stale bootstrap-test assertions.
- Re-run every focused test after reconstructing the patch because the uncommitted worktree was lost.
- 2026-07-28: 121 focused assertions across lifecycle, agent bridge, installer, Caddy/gateway, security, Cloudflare connector, install state, and workspace bootstrap contracts passed in isolated suites.
- 2026-07-28: package syntax/typecheck, shell syntax, and git diff whitespace checks passed.
- 2026-07-28: workspace review passed with zero findings; workspace verify produced a publish-valid stamp.
- 2026-07-28: local port cutover runtime behaviors passed 9/9; its cross-package documentation assertion cannot run in this task worktree because packages/documentation is outside the task checkout.

- 2026-07-28 06:38:28 write: `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/workpad.md`

## files changed

- `packages/os/tests/finish-line-lifecycle-contract.test.ts`

## workspace-owned: files changed

- `packages/os/tests/finish-line-lifecycle-contract.test.ts`

## workspace-owned: activity log

- 2026-07-28 06:38:28 fs.write: `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/workpad.md`
- 2026-07-28 06:39:42 write: `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- 2026-07-28 06:39:42 fs.write: `packages/os/tests/finish-line-lifecycle-contract.test.ts`

- 2026-07-28 06:42:45 apply-patch: `packages/os/scripts/lib/local-agent-mcp-bridge.ts`
- 2026-07-28 06:42:45 apply-patch: `packages/os/scripts/mcp-stdio.ts`
- 2026-07-28 06:43:24 apply-patch: `packages/os/scripts/lib/local-agent-connectivity.ts`
- 2026-07-28 06:43:24 apply-patch: `packages/os/scripts/mcp-stdio.ts`
- 2026-07-28 06:43:24 apply-patch: `packages/os/scripts/lib/local-agent-mcp-bridge.ts`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/local-agent-mcp-bridge.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`

## workspace-owned: validation evidence

- Previous pre-crash reconstruction reached 146/149 focused Vitest contracts; the three remaining failures were stale bootstrap-test assertions.
- Re-run every focused test after reconstructing the patch because the uncommitted worktree was lost.
- 2026-07-28: 121 focused assertions across lifecycle, agent bridge, installer, Caddy/gateway, security, Cloudflare connector, install state, and workspace bootstrap contracts passed in isolated suites.
- 2026-07-28: package syntax/typecheck, shell syntax, and git diff whitespace checks passed.
- 2026-07-28: local port cutover runtime behaviors passed 9/9; its cross-package documentation assertion cannot run in this task worktree because packages/documentation is outside the task checkout.
- 2026-07-28 06:38:28 write: `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/workpad.md`
- 2026-07-28 07:23:00 `review.run`: passed — OK
- 2026-07-28 07:23:51 `review.run`: passed — OK
- 2026-07-28 07:24:03 `verify`: passed — OK
- 2026-07-28 07:24:37 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/current.json`, `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/evidence-log.json`, `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/read-log.json`, `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/session.json`, `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/verify.json`, `.task/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery/workpad.md`, `.task/tasks/os/repair-local-agent-lifecycle-caddy-ingress-and-restart-recovery.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/local-agent-mcp-bridge.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/mcp-stdio.ts`, `packages/os/scripts/start-caddy-daemon.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/scripts/start-portless-daemon.sh`, `packages/os/scripts/uninstall-system-daemons.sh`, `packages/os/scripts/verify-local-agents.ts`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/finish-line-lifecycle-contract.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/installer-local-agent-connectivity.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/local-agent-mcp-bridge.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/workspace-gateway-contract.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
