# Fix gateway traces auth contract

branch: `task/sites/fix-gateway-traces-auth-contract`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1085/fix-gateway-traces-auth-contract
github pr: https://github.com/consuelohq/opensaas/pull/1085
started: 2026-06-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: activity log

- 2026-06-16 17:26:06 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-16 17:28:14 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-16 17:28:23 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-16 17:28:29 fs.patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- 2026-06-16 17:28:42 fs.patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- 2026-06-16 17:29:50 fs.patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: validation evidence

- 2026-06-16 17:30:59 `verify`: passed — OK

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-06-16 17:26:06 patch lines 1-1: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-06-16 17:28:14 patch lines 278-278: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-06-16 17:28:23 patch lines 585-597: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-06-16 17:28:29 patch lines 1-4: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-06-16 17:28:42 patch lines 150-150: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-06-16 17:29:50 patch lines 305-350: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: test selection

- changed files: `.task/sites/fix-gateway-traces-auth-contract/current.json`, `.task/sites/fix-gateway-traces-auth-contract/evidence-log.json`, `.task/sites/fix-gateway-traces-auth-contract/read-log.json`, `.task/sites/fix-gateway-traces-auth-contract/session.json`, `.task/sites/fix-gateway-traces-auth-contract/workpad.md`, `.task/tasks/sites/fix-gateway-traces-auth-contract.json`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
