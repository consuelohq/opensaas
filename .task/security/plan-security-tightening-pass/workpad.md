# plan security tightening pass

branch: `task/security/plan-security-tightening-pass`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1115/plan-security-tightening-pass
github pr: https://github.com/consuelohq/opensaas/pull/1115
started: 2026-06-17

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
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/package.json`
- `packages/os/scripts/code-call.ts`
- `packages/os/scripts/lib/code-call/runtime.ts`
- `packages/os/scripts/lib/code-call/types.ts`
- `packages/os/scripts/lib/dangerous-material-policy.ts`
- `packages/os/scripts/lib/local-guardrails.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/worker/runtime.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/dangerous-material-policy.test.ts`
- `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`
- `packages/os/tests/local-guardrails.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/safe-temp-cleanup.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/twenty-server/src/engine/api/mcp/controllers/__tests__/mcp-core.controller.spec.ts`
- `packages/twenty-server/src/engine/api/mcp/controllers/mcp-core.controller.ts`
- `packages/twenty-server/src/engine/api/mcp/mcp.module.ts`
- `packages/twenty-server/src/engine/api/mcp/services/mcp-protocol.service.ts`

- 2026-06-17 23:55:07 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:55:21 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:55:40 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:55:48 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:55:59 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:56:20 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:56:34 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:56:54 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:57:00 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:57:09 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:57:28 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:57:51 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-17 23:58:05 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-17 23:58:15 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-17 23:58:33 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-17 23:58:50 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-17 23:58:58 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-17 23:59:16 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-17 23:59:27 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-17 23:59:38 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-17 23:59:53 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-18 00:00:07 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-18 00:00:22 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-18 00:00:40 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 00:01:36 apply-patch: `packages/os/scripts/server.ts`

## Review comment resolution — 2026-06-17

State: Codex P2 findings on PR #1115 were accepted and resolved.
Delta: `security-gateway.ts` now stores Ed25519 public verifier material instead of a reusable HMAC key/hash, signs requests with the returned private key, verifies with the stored public key, and appends credential audit events before persisting issued or rotated credentials. `server.ts` now wraps `handleRequest` in a top-level `try/catch` to satisfy the review gate.
Evidence: Red focused test `bun --cwd packages/os test tests/security-gateway.test.ts` failed 4 expected assertions on stored verifier shape and audit atomicity before implementation. Green focused test passed 23/23 after implementation. Touched-test bundle `bun --cwd packages/os test tests/security-gateway.test.ts tests/cloudflare-edge-router.test.ts tests/dangerous-material-policy.test.ts tests/local-guardrails.test.ts` passed 32 tests with 10 skips. Review command `bun run review -- --base stream/security --no-tests` passed all checks.
Risk: Existing hash-only persisted credentials from the intermediate PR shape fail closed because they cannot be converted into public/private keypairs. Reissue/rotation is required for those credentials.
Tooling gap: The reattached existing PR worktree had no usable `taskSession`, so validation used `code.call` with explicit `taskWorktree`, and publish uses a temporary git index on top of the remote PR branch rather than `task.push`.
