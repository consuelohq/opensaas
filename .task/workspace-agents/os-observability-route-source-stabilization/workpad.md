# os observability route source stabilization

branch: `task/workspace-agents/os-observability-route-source-stabilization`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1325/os-observability-route-source-stabilization
github pr: https://github.com/consuelohq/opensaas/pull/1325
started: 2026-07-01

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

- 2026-07-01 18:17:42 `verify`: failed — COMMAND_FAILED
- 2026-07-01 18:21:12 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/os-observability-route-source-stabilization.json`, `.task/workspace-agents/os-observability-route-source-stabilization/current.json`, `.task/workspace-agents/os-observability-route-source-stabilization/session.json`, `.task/workspace-agents/os-observability-route-source-stabilization/workpad.md`, `packages/consuelo-website/src/pages/os/launcher.astro`, `packages/os/scripts/lib/consuelo-sites-trace-adapter.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`, `packages/os/tests/workspace-hostname-edge-router.test.ts`, `packages/workspace/scripts/office.ts`, `packages/workspace/tests/office-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
