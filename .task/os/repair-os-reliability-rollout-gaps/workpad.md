# Repair OS reliability rollout gaps

branch: `task/os/repair-os-reliability-rollout-gaps`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1871/repair-os-reliability-rollout-gaps
github pr: https://github.com/consuelohq/opensaas/pull/1871
started: 2026-08-12

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tests/distribution/lifecycle-contract.test.ts`


## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/distribution/release-channel.schema.json`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.schema.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/connector-readiness.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/errors.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/prepare-release-publication.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/consuelo-reload.test.ts`
- `packages/os/tests/distribution/lifecycle-contract.test.ts`
- `packages/os/tests/distribution/release-channels.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/system-daemon-reliability.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`
- `packages/os/tests/workspace-node-heartbeat-client.test.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## workspace-owned: activity log

- 2026-08-12 03:53:04 fs.write: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`
- 2026-08-12 03:54:11 fs.write: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`
- 2026-08-12 03:55:03 fs.write: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`
- 2026-08-12 03:57:58 fs.write: `packages/os/tests/distribution/lifecycle-contract.test.ts`
- 2026-08-12 03:58:31 fs.write: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 03:58:44 `review.run`: passed — OK
- 2026-08-12 03:58:56 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/os/tests/distribution/lifecycle-contract.test.ts`

## Test-first contract

Reliability reds reproduced lifecycle false-green, missing D1 `/mcp` reconstruction, local-green/public-route-red watchdog behavior, one-worker HA, release downgrade, and stale LaunchAgent MCP credential reintroduction before production edits. Current focused regression set: 194 passed, 9 skipped. Strict review and full verify pass. Local installed OS remains signed 0.1.26 and has not been replaced by this task; final signed dev candidate plus real ChatGPT OAuth canary remain before any local update.

- 2026-08-12 03:53:04 append: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`

## CI wait

Wait reason: #1871 remote CI has 17 pending checks after verified reliability publish.
Duration: 30s.
Resume action: `github pr.checks` for #1871.
Expected signal: zero failed checks and pending count materially reduced/completed.
Fallback: inspect any failing check before task-to-stream promotion.

- 2026-08-12 03:54:11 append: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`

CI observed: `Consuelo OS / native linux` failed, but its parent Actions run is still in progress so failed-job logs are not yet available.
Wait reason: parent CI run must finish before GitHub exposes the failed Linux log.
Duration: 30s.
Resume action: re-check #1871 checks, then read native Linux `--log-failed` if the run completed.
Expected signal: run completed and failure log available.
Fallback: another bounded poll; do not promote while the failure is unexplained.

- 2026-08-12 03:55:03 append: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`

- 2026-08-12 03:57:58 write: `packages/os/tests/distribution/lifecycle-contract.test.ts`

CI repair: native Linux and macOS both failed `tests/distribution/lifecycle-contract.test.ts` because its trusted signed-release fixture omitted the newly required recovery capabilities. Updated only that valid fixture to use `REQUIRED_RUNTIME_RECOVERY_CAPABILITIES`; production fail-closed behavior is unchanged. Exact CI harness `bun x vitest run tests/distribution --testTimeout 15000` now passes: 12 files, 84 tests, 7 todos.

- 2026-08-12 03:58:31 append: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`
