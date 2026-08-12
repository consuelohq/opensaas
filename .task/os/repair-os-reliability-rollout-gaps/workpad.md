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

- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
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


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-12 03:53:04 fs.write: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`

## workspace-owned: validation evidence

- none yet

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

- none yet

## Test-first contract

Reliability reds reproduced lifecycle false-green, missing D1 `/mcp` reconstruction, local-green/public-route-red watchdog behavior, one-worker HA, release downgrade, and stale LaunchAgent MCP credential reintroduction before production edits. Current focused regression set: 194 passed, 9 skipped. Strict review and full verify pass. Local installed OS remains signed 0.1.26 and has not been replaced by this task; final signed dev candidate plus real ChatGPT OAuth canary remain before any local update.

- 2026-08-12 03:53:04 append: `.task/os/repair-os-reliability-rollout-gaps/workpad.md`
