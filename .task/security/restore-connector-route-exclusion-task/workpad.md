# Restore connector route exclusion task

branch: `task/security/restore-connector-route-exclusion-task`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1467/restore-connector-route-exclusion-task
github pr: https://github.com/consuelohq/opensaas/pull/1467
started: 2026-07-13

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

- 2026-07-13 19:43:10 `review.run`: passed — OK
- 2026-07-13 19:43:22 `verify`: passed — OK

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

## recovery context

- The computer restarted after the previous task had implemented the connector-origin Worker route exclusion but before review/publish.
- Lost task session: `tsk_5c0726120b43`.
- Former branch: `task/security/provision-connector-origin-worker-route-exclusions` (PR #1465).
- Replacement task session: `tsk_f70a39af5284` (PR #1467).
- Previously proven behavior: exact `<canonical-host>/*` no-script Worker route, applied after Tunnel ingress and before DNS; idempotent create/update/unchanged behavior; duplicate and malformed-response fail-closed handling.
- Previous validation before restart: 57 focused/adjacent tests passed and OS static/type checks passed. Strict review and full verify had not yet run.

## acceptance criteria

- [x] Recover the previous uncommitted worktree if it still exists; otherwise reproduce the red contract and reapply the same scoped patch.
- [x] Provision an exact no-script Worker route `<canonical-connector-host>/*` before DNS reconciliation.
- [x] Create when absent, preserve an existing no-script route, update an exact scripted route, and reject duplicate exact routes.
- [x] Validate API responses and never mutate unrelated or wildcard Worker routes.
- [x] Cover plan, operation ordering, HTTP endpoints, device-authority provisioning, idempotence, and failure cases.
- [x] Pass focused tests, OS static/type checks, strict review, and full verify before publish.
- [ ] Release, reprovision the live connector, verify signed-edge routing, then resume OAuth/MCP/ChatGPT acceptance.

## test-first contract

- Focused command: `bun --cwd packages/os vitest run tests/cloudflare-provisioning-contract.test.ts tests/os-device-authority-connector-provisioning.test.ts`.
- Expected red state when reconstructing from clean main: missing plan field and missing route-reconciliation operation; HTTP fixtures do not see `/zones/:zone/workers/routes`.

## recovery evidence

- Former worktree path no longer exists after restart.
- Former remote branch `task/security/provision-connector-origin-worker-route-exclusions` contains only its bootstrap commit; no implementation commit was recoverable.
- Reproduced red contract from clean production baseline with 12 expected failures and 14 unrelated passes.
- Reapplied the scoped implementation in three files: provisioning source, provisioning contract tests, and device-authority provisioning test.
- Focused green result: 26/26 tests passed with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.

## current status

- Implementation reconstruction complete. Adjacent security tests, static checks, strict review, and full verify remain.

## workspace-owned: test selection

- changed files: `.task/security/restore-connector-route-exclusion-task/current.json`, `.task/security/restore-connector-route-exclusion-task/session.json`, `.task/security/restore-connector-route-exclusion-task/workpad.md`, `.task/tasks/security/restore-connector-route-exclusion-task.json`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/os-device-authority-connector-provisioning.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## validation

- Focused reconstruction suite: 26/26 passed.
- Adjacent connector/WAF suite: 57/57 passed.
- OS script syntax/type checks: passed.
- Strict repository review: 0 findings.
- Full verify: passed; publish-valid stamp written.

## current status

- Reconstructed implementation is ready to publish. Release and live connector reprovision remain.
