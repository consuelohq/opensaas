# Fix fresh reinstall node deregistration and workspace routing

branch: `task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2541
started: 2026-09-22

## acceptance criteria

- [x] `consuelo uninstall --remove-node` revokes the enrolled authority node before deleting local node identity.
- [x] Node self-removal uses the existing Ed25519 device key rather than requiring an operator/browser token.
- [x] Forged/replayed/invalid self-removal requests fail closed.
- [x] Authority failures preserve the local signing identity instead of silently orphaning a live node.
- [x] Normal uninstall and dry-run behavior are unchanged.
- [x] Once the stale default is revoked, the next healthy signed heartbeat reconciles the workspace default and D1 route to the remaining ready node.
- [x] Focused routing/login/lifecycle regression suites and syntax checks pass.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/lib/workspace-node-registration-client.ts`
- `packages/os/tests/lifecycle-node-revocation.test.ts`
- `packages/os/tests/workspace-node-registration-client.test.ts`
- `packages/os/tests/workspace-node-self-revoke.test.ts`

## key decisions

- Do not weaken the explicit-node routing contract by silently failing over an active-but-offline default node. The bug was lifecycle ownership: destructive local uninstall deleted the node key without revoking the authority record.
- Add a least-privilege signed node self-revocation endpoint (`/workspace/nodes/self/revoke`) using the same device key and nonce/replay protections as heartbeat.
- Fail closed before local node deletion when authority revocation cannot be confirmed, preserving the signing key so the user can retry safely.
- Keep operator-driven node revocation unchanged and share the underlying revoke implementation.

## notes for ko

- Root cause confirmed on the fresh test workspace: the old default node remained authority-active after `--remove-node`, while the newly installed node was online as a member. Untargeted gateway calls therefore kept routing to the offline old default, which explains configuration/tools/secrets/tracing failures even though the new launcher and browser session were valid.
- The separate installer presentation/background-item cleanup remains handed off in `/private/tmp/opensaas-handoffs/macos-background-items-productization-handoff.md`.

## improvements noticed

- none yet

## errors i ran into

- The first self-revoke regression correctly failed with HTTP 401 because the route did not exist yet.
- The first lifecycle revocation regression correctly proved `--remove-node` never contacted authority before deleting local state.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- A destructive `consuelo uninstall --remove-node` must remove/revoke the enrolled node from the workspace authority before deleting the local node identity, so a subsequent clean reinstall does not leave an active-but-offline default node that breaks untargeted workspace gateway routes.
- A normal second-machine install must continue to preserve an existing ready home/default node; runtime routing must keep the explicit no-automatic-fallback contract.
- If remote node removal cannot be authenticated/completed, uninstall must not silently claim the node was removed; local cleanup behavior and error semantics must be explicit and safe.

existing local pattern:
- Device Authority already supports authenticated node revocation through the workspace node management API and signed node heartbeats.
- Node identity replacement is already supported when an existing node ID is retained.
- Lifecycle uninstall currently removes local node state only; this clean retest demonstrated that the authority record remains active.
- Workspace routing intentionally sends untargeted requests to the explicit default and returns WORKSPACE_NODE_OFFLINE rather than falling back.

new or changed tests:
- Add focused lifecycle/uninstall tests proving `--remove-node` invokes a node-authority deregistration path before local identity deletion and handles failure safely.
- Add Device Authority tests for the least-privilege self-removal/revocation path if a signed-node endpoint is required.
- Add reinstall/routing regression: after self-removal of the old default, a fresh approved node can become the valid default through existing reconciliation without changing second-machine semantics.

focused red command:
- Run the focused uninstall + workspace-node registry test files after adding the regression tests.

expected red failure:
- Current uninstall has no remote node deregistration/revocation step, so the new test should fail because the old authority node remains active/default after `--remove-node`.

no-test waiver: not applicable.

- 2026-09-22 22:31:20 append: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-node-registration-client.ts`
- `packages/os/tests/lifecycle-node-revocation.test.ts`
- `packages/os/tests/workspace-node-registration-client.test.ts`
- `packages/os/tests/workspace-node-self-revoke.test.ts`

## workspace-owned: activity log

- 2026-09-22 22:31:20 fs.write: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`
- 2026-09-22 22:33:57 fs.write: `packages/os/tests/workspace-node-self-revoke.test.ts`
- 2026-09-22 22:34:13 fs.write: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`
- 2026-09-22 22:35:07 fs.write: `packages/os/tests/lifecycle-node-revocation.test.ts`
- 2026-09-22 22:35:35 fs.write: `packages/os/tests/workspace-node-registration-client.test.ts`
- 2026-09-22 22:35:50 fs.write: `packages/os/scripts/lib/workspace-node-registration-client.ts`
- 2026-09-22 22:58:16 fs.write: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`
- 2026-09-22 23:01:23 fs.write: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/lib/workspace-node-registration-client.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## Focused red evidence

Command:
`bunx vitest run packages/os/tests/workspace-node-self-revoke.test.ts`

Trace: `trc_a0889f3f5611`

Observed red:
- valid signed self-revocation expected HTTP 200 but received 401.
- forged request remains rejected.
- Current route falls through the operator-OAuth `/workspace/nodes/:nodeId/revoke` path, proving there is no node-signed self-revocation contract yet.

- 2026-09-22 22:34:13 append: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`

- 2026-09-22 22:34:33 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- 2026-09-22 22:34:45 apply-patch: `packages/os/tests/workspace-node-self-revoke.test.ts`

- 2026-09-22 22:35:07 write: `packages/os/tests/lifecycle-node-revocation.test.ts`

- 2026-09-22 22:35:19 apply-patch: `packages/os/scripts/lib/lifecycle/engine.ts`
- 2026-09-22 22:35:35 write: `packages/os/tests/workspace-node-registration-client.test.ts`

- 2026-09-22 22:35:50 write: `packages/os/scripts/lib/workspace-node-registration-client.ts`

- 2026-09-22 22:36:03 apply-patch: `packages/os/scripts/lifecycle.ts`

- 2026-09-22 22:52:21 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-22 22:52:43 apply-patch: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 22:54:14 `verify`: failed — COMMAND_FAILED
- 2026-09-22 22:55:36 `verify`: failed — COMMAND_FAILED
- 2026-09-22 22:56:24 `verify`: failed — COMMAND_FAILED
- 2026-09-22 22:57:55 `verify`: failed — COMMAND_FAILED

## bounded wait

- reason: full `packages/os` test suite exceeds the foreground tool timeout.
- duration: poll every ~15 seconds, up to 2 minutes before falling back to the focused 113-test + syntax evidence.
- resume signal: `full-test.status` exists.
- fallback: inspect the log tail, record the timeout/failure explicitly, and do not represent the full suite as green unless status is 0.

- 2026-09-22 22:58:16 append: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`

- 2026-09-22 22:59:33 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
## verification update

- Full `packages/os` suite initially found one legitimate parity-fixture omission for the new lifecycle client; added `scripts/lib/workspace-node-registration-client.ts` to the OS-only intentional classification and the audit regression is now green.
- Focused post-fix verification: 7 files / 114 tests passed, including node routing, lifecycle uninstall, universal login, self-revoke, and script parity.
- Full suite rerun reached 3,394 passing tests with one unrelated `trace-persistence.test.ts` 5s timeout; that exact file passed immediately in isolation (12/12, ~3s), so the remaining full-suite failure is a concurrency/timing flake rather than this change.
- Syntax/typecheck gate passed.

- 2026-09-22 23:01:23 append: `.task/os/fix-fresh-reinstall-node-deregistration-and-workspace-routing/workpad.md`
