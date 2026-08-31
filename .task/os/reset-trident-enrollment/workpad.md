# Reset Trident enrollment

branch: `task/os/reset-trident-enrollment`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2154/reset-trident-enrollment
github pr: https://github.com/consuelohq/opensaas/pull/2154
started: 2026-08-17

## acceptance criteria

- [x] Add an authenticated operator-only reset path that can identify an enrollment by workspace host without knowing its opaque Device Authority account id.
- [x] Reset removes the account-to-workspace mapping, workspace membership, registered node/index/affinity state, stale bootstrap/grant state, and revokes the workspace route record so the next device authorization returns `workspace_required`.
- [x] Reset is fail-closed, idempotent, and refuses ambiguous/mismatched workspace ownership.
- [ ] Use the reset against `trident.consuelohq.com` and verify the stale route/device state no longer blocks first-run workspace naming.
- [x] Preserve Dixon's canonical login/user identity and historical observability records.

## plan

1. Extend the Device Authority store with narrowly-scoped enrollment reset primitives using existing node indexes and route revocation semantics.
2. Add an internal operator route authenticated with the existing internal signing secret; resolve by exact workspace host and return only a bounded reset summary.
3. Write focused tests first for happy path, idempotency, ambiguity/mismatch rejection, and first-run behavior after reset.
4. Deploy through the OS task workflow, execute the reset for Trident, and verify D1/authority state.
5. Keep Cloudflare tunnel/DNS resources reusable unless teardown is required for correctness; the blocking state is Durable Object mapping/node state plus active route registry state.

## current status

- Reset implementation is complete and locally validated. Production execution against Trident remains before the final acceptance criterion is checked.

## files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: activity log

- 2026-08-17 00:54:15 fs.write: `.task/os/reset-trident-enrollment/workpad.md`
- 2026-08-17 00:59:49 fs.write: `.task/os/reset-trident-enrollment/workpad.md`

## workspace-owned: validation evidence

- 2026-08-17 00:58:15 `checkFiles`: passed — OK
- 2026-08-17 00:59:07 `review.run`: passed — OK
- 2026-08-17 00:59:25 `checkFiles`: passed — OK
- 2026-08-17 00:59:34 `review.run`: passed — OK
- 2026-08-17 01:00:08 `verify`: passed — OK

## key decisions

- Do not delete the canonical Consuelo user; only reset OS enrollment state.
- Do not hand-edit opaque Durable Object keys in production. Add a supported store-level reset path and exercise it through an authenticated internal route.
- The route accepts the existing internal edge secret and an optional `OS_ENROLLMENT_RESET_SECRET`. The latter is intended for a short-lived operator credential so OS tooling can execute maintenance without retrieving or rotating the shared edge secret.
- Revoke the D1 route logically rather than deleting telemetry/history. Cloudflare provisioning is intentionally create-or-reuse, so stale tunnel/DNS infrastructure does not prevent a clean reinstall and can be reused if the same workspace name is chosen.

## notes for ko

- Production evidence: `trident.consuelohq.com` / `workspace_trident` is active in D1, connector `connector_trident` is disconnected, node `trident` has `lastSeenAt: 0`. This means server-side auth/provisioning completed but the machine never came online.
- No `os_install_sessions`, `os_install_events`, canonical user/workspace projection, or Sentry failure matched Trident/Dixon in the candidate windows, so the exact client-side failure cannot be proven from current telemetry.

## improvements noticed

- none yet

## issues and recovery

- Canonical `session.start` failed because the repository currently has no `session:start` script; recovered with the supported `task.start` compatibility alias.
- Cloudflare typed historical log retrieval returned `MALFORMED_OUTPUT`; D1 and route-state evidence were used instead and no absence-of-logs claim was made.
- Initial review found route-order false positives and missing local try/catch boundaries; both were fixed and strict review is now clean.

## Test-first contract

behavior under test: operator reset by exact workspace host removes the persisted Device Authority enrollment that makes reinstall skip workspace naming, while revoking the route and preserving user/telemetry history
existing local pattern: authenticated `/internal/install-control-plane/*` routes plus `DurableStore.delWorkspaceNode` cleanup and `revokeWorkspaceHostnameInD1` logical revocation
new or changed tests: focused Device Authority worker integration tests for reset success, idempotency, ambiguity rejection, and subsequent device approval returning `workspace_required`
focused red command: `bunx vitest run packages/os/tests/os-device-authority-worker.test.ts -t "reset a stale workspace enrollment"`
expected red failure: reset endpoint returned 404 before implementation; observed exactly
green evidence: full `os-device-authority-worker.test.ts` passes 33/33; changed-file syntax checks pass; `packages/os` typecheck/syntax pass; strict workspace review reports 0 blockers; Wrangler device-authority deploy dry-run succeeds
no-test waiver: not applicable

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/tests/internal-dashboard-integration.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`

- 2026-08-17 00:59:49 write: `.task/os/reset-trident-enrollment/workpad.md`
