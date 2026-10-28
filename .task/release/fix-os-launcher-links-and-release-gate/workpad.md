# fix os launcher links and release gate

branch: `task/release/fix-os-launcher-links-and-release-gate`
stream: `stream/release`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1284/fix-os-launcher-links-and-release-gate
github pr: https://github.com/consuelohq/opensaas/pull/1284
started: 2026-06-30

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
bun run task:push -- --message "type(release): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/workspace-cloudflare-edge-router.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- `packages/workspace/scripts/office.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release-install.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/tests/office-theme.test.js`
