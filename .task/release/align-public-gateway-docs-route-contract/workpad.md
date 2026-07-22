# align public gateway docs route contract

branch: `task/release/align-public-gateway-docs-route-contract`
stream: `stream/release`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1288/align-public-gateway-docs-route-contract
github pr: https://github.com/consuelohq/opensaas/pull/1288
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

- 2026-06-30 15:40:21 `review.run`: passed — OK
- 2026-06-30 15:40:45 `verify`: passed — OK

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

## workspace-owned: test selection

- changed files: `.task/release/align-public-gateway-docs-route-contract/current.json`, `.task/release/align-public-gateway-docs-route-contract/session.json`, `.task/release/align-public-gateway-docs-route-contract/workpad.md`, `.task/tasks/release/align-public-gateway-docs-route-contract.json`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
