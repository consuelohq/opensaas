
## Discovery — 2026-08-13

- Regression reproduced live: workspace private endpoints return 401 workspace_session_required without browser session; /mcp alone remains Cloudflare-blocked at 403.
- Local traces.db is present and non-empty; failure is on reader/session/routing boundary, not data loss.
- Steering reports current local node node_F3Wsfd-vJrKkYlfi online, configured default/home node internal offline.
- Overlap checked: PR #1910 edits default-node and route reconciliation; PR #1912 is adjacent dashboard work. Reuse or avoid conflicts before implementation.
- Test-first contract: add a focused failing contract for the confirmed shared route/session failure before production edits.

## HA restart incident — 2026-08-13

- Live watchdog evidence: three direct health timeouts against worker port 46321 caused a full com.consuelo.system restart even though Caddy owned a two-worker upstream pool.
- Live supervisor evidence: the old supervisor was SIGKILLed; replacement workers repeatedly hit EADDRINUSE on 46321/46322 while orphan children were still draining. This was the availability gap and likely source of the brief process/fan spike.
- Fix: watchdog probes Caddy 46320, Caddy exposes a host-independent pooled /health, and the runtime migration updates the installed Caddyfile plus watchdog plist.
- Fix: a replacement supervisor reads the prior snapshot and reclaims only PIDs whose live /ready identity exactly matches the recorded workerId and workerInstanceId before starting the new pool.
- Browser regression fix: generated Trace Burn, /traces, Tools, Environments, and Secrets clients redirect exact workspace_session_required 401 responses into the existing Google web-session flow while preserving the requested return path.
- Validation: 81 affected tests passed, including a real SIGKILL/restart process test with no EADDRINUSE; package syntax/typecheck passed; strict review passed with zero blockers.
- Full verify reached the package-wide gate and failed only on pre-existing `operator-login.test.ts` unhandled rejection behavior outside this diff. The review and database guard passed, and the user explicitly authorized the canary hotfix with checks skipped when necessary.

- 2026-08-13 19:38:18 apply-patch: `packages/os/tests/trace-site-renderer.test.ts`
- 2026-08-13 19:38:18 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-08-13 19:40:23 apply-patch: `packages/os/scripts/lib/private-workspace-session-recovery.ts`
- 2026-08-13 19:40:24 apply-patch: `packages/os/scripts/lib/trace-site.ts`
- 2026-08-13 19:40:24 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-08-13 19:40:24 apply-patch: `packages/os/tests/trace-site-renderer.test.ts`
- 2026-08-13 19:40:24 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-08-13 19:41:05 apply-patch: `packages/os/tests/trace-site-renderer.test.ts`
- 2026-08-13 19:41:05 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-08-13 19:56:44 apply-patch: `packages/os/tests/worker-pool-process.test.ts`
- 2026-08-13 19:56:44 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-13 19:57:50 apply-patch: `packages/os/tests/worker-pool-process.test.ts`
- 2026-08-13 19:57:50 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-13 19:57:50 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-08-13 20:03:19 apply-patch: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-08-13 20:03:19 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-13 20:04:07 apply-patch: `packages/os/scripts/server/supervisor.ts`
- 2026-08-13 20:04:26 apply-patch: `packages/os/scripts/workspace-watchdog.sh`
- 2026-08-13 20:04:26 apply-patch: `packages/os/scripts/generate-system-daemons.sh`
- 2026-08-13 20:06:05 apply-patch: `packages/os/tests/trace-site-renderer.test.ts`
- 2026-08-13 20:06:05 apply-patch: `packages/os/tests/local-os-port-cutover.test.ts`
- 2026-08-13 20:08:47 apply-patch: `packages/os/scripts/server/supervisor.ts`
- 2026-08-13 20:08:47 apply-patch: `packages/os/scripts/migrations/reconcile-caddy-ha-watchdog.ts`
- 2026-08-13 20:08:47 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-08-13 20:08:47 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-13 20:08:47 apply-patch: `packages/os/tests/caddy-ha-watchdog-migration.test.ts`
- 2026-08-13 20:10:08 apply-patch: `packages/os/scripts/server/supervisor.ts`

- 2026-08-13 20:11:00 apply-patch: `.task/os/restore-observability-and-configuration-browser-sessions-after-ingress-hardening/workpad.md`
- 2026-08-13 20:12:22 apply-patch: `packages/os/scripts/server/supervisor.ts`
- 2026-08-13 20:19:41 apply-patch: `packages/os/scripts/workspace-watchdog.sh`
- 2026-08-13 20:19:42 apply-patch: `packages/os/scripts/generate-system-daemons.sh`
- 2026-08-13 20:19:42 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-13 20:20:27 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-13 20:20:55 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-13 20:21:16 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-13 20:22:59 apply-patch: `packages/os/scripts/server/supervisor.ts`
- 2026-08-13 20:22:59 apply-patch: `packages/os/scripts/migrations/reconcile-caddy-ha-watchdog.ts`

## workspace-owned: validation evidence

- 2026-08-13 20:26:50 `verify`: failed — COMMAND_FAILED
