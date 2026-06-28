# Fix OS installer route registration UX

branch: `task/security/fix-os-installer-route-registration-ux`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1183/fix-os-installer-route-registration-ux
github pr: https://github.com/consuelohq/opensaas/pull/1183
started: 2026-06-23

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

- 2026-06-23 04:19:19 `review.run`: passed — OK

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
# Fix OS installer route registration UX

## Findings

- Dependency preflight still listed home; replaced with workspace.
- Interactive onboarding banner had no completed/active state; added active/complete step support and marks dependencies + workspace with filled dots.
- Workspace text input already normalized internally, but the prompt did not say spaces become hyphens and did not show the normalized slug.
- D1 route registration used multiline INSERT statements through D1 exec; live Worker returned incomplete input on line 1. SQL generation now emits compact one-line statements.

## Validation

- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts: pass, 5 tests.
- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts: pass, 7 tests.
- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-workspace-bootstrap-contract.test.ts: pass, 7 tests.
- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/os-device-authority-worker.test.ts: pass, 7 tests.
- bash -n packages/os/scripts/bootstrap.sh: pass.
- wrangler deploy --dry-run --config cloudflare/os-device-authority/wrangler.toml: pass.
- bun run os:release-install -- --dry-run: pass, new bootstrap SHA 1ad032899b1714c6bcdabf411f0e879cad6589aa4e121e5e868b30989b3431c2.
