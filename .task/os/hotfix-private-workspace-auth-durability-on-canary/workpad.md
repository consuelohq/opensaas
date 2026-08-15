# hotfix private workspace auth durability on canary

branch: `task/os/hotfix-private-workspace-auth-durability-on-canary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2021/hotfix-private-workspace-auth-durability-on-canary
github pr: https://github.com/consuelohq/opensaas/pull/2021
started: 2026-08-15

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

- 2026-08-15 04:39:03 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 04:45:35 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 04:47:11 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:46:06 `review.run`: passed — OK
- 2026-08-15 04:46:46 `review.run`: passed — OK
- 2026-08-15 04:47:06 `verify`: passed — OK

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

## Test-first contract

behavior under test:
1. The currently distributed canary runtime must preserve the complete Workspace Edge signed-node header set through Caddy, so authenticated private browser subroutes cannot become `MISSING_EDGE_SIGNATURE` after restart/update.
2. The runtime release must force a fresh, idempotent Caddy reconciliation on each new runtime version even when an older migration ID is already journaled.
3. This hotfix must be the smallest main-based runtime subset needed to make the repaired live node durable; it must not pull unrelated `stream/os` work or weaken fail-closed edge verification.

existing local pattern: `renderCaddyGatewayConfig`, `reconcile-caddy-worker-pool.ts`, runtime-bundle migrations, release workflow migration arguments, Caddy reconciliation tests.
new or changed tests: prove main currently strips one or more required `WORKSPACE_EDGE_NODE_HEADERS`, then add/port the all-header Caddy assertion and release-scoped reconciliation migration contract.
focused red command: run `caddy-worker-pool-reconciliation.test.ts` plus `release-channel-workflows.test.ts` after adding the assertions.
expected red failure: main Caddy renderer contains header removal directives for signed Workspace Edge identity/authentication headers and the release workflow lacks a version-scoped reconciliation migration.
no-test waiver: not applicable.

## Deployment acceptance

- Build/release only the verified main-based hotfix subset needed for private workspace auth durability.
- Confirm the published canary version differs from 0.1.42 and contains the corrected renderer/migration.
- Update this home node through the normal lifecycle path and prove its installed runtime source plus live Caddy both preserve signed Workspace Edge headers.
- Prove a signed request through the live Caddy private Configuration endpoint returns 200 after the update.

- 2026-08-15 04:39:03 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/secure/hosted-mcp-ingress.mdx`
- `packages/documentation/src/content/docs/secure/security-model.mdx`
- `packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/workspace/test-selection.rules.json`

## RED / GREEN and release-durability evidence

- Main/canary RED `trc_140bd2cc6cc2`: the released renderer still removed signed Workspace Edge identity headers and the runtime workflow had no version-scoped Caddy reconciliation migration. This is the exact mechanism that can turn a valid browser workspace session into downstream `MISSING_EDGE_SIGNATURE` after an update/restart.
- Implementation `trc_94d493402bd8`: preserve the signed Workspace Edge signature/surface/connector headers through Caddy while continuing to drop only edge cache/route metadata, and add a version-scoped `reconcile-caddy-worker-pool.ts` migration to every changed runtime build. The migration stays idempotent and rewrites only stale gateway config.
- Updated the stale main security contract that previously asserted the broken header stripping behavior (`trc_cb6d2e12acc2`). The focused package runner proves the corrected Caddy security contract (`trc_d9bf75a82fc7`).
- The first selected-suite run exposed unrelated broad `@consuelo/os` package debt and also mutated a facade snapshot as a test side effect (`trc_aa22048f96b7`). The snapshot side effect was restored immediately (`trc_c47921749174`). No product change was made to mask those unrelated failures.
- Added a test-first focused test-selection contract. RED `trc_9056e6accaac` proved gateway/Caddy changes previously fell through to the broad OS package suite. Added exclusive critical owner `os-gateway-security-caddy-handoff` (`trc_9ad41a3b83c1`), regenerated the registry (`trc_0dadbb0b8ec5`), and GREEN `trc_69518075934e` proves security/Caddy files now select full `security-gateway.test.ts`, Caddy reconciliation, and syntax checks without unrelated package-wide tests.
- Full focused selected-suite execution passed with no failures: `trc_3403fdc2cb64`. Coverage includes 35 test-selection contracts, 19 release freshness contracts, Workspace production release contracts, Workspace Edge dry run, all 31 gateway security/Caddy tests, syntax, and existing CI policy contracts. A single earlier release-contract timeout was transient; the exact suite passed immediately on retry (`trc_112cd8d67e68`) and again in the final selected-suite run.

## Live state relationship

- The home node is currently repaired: live Caddy preserves the signed Workspace Edge identity headers and a signed request through the real Caddy ingress to `/gateway/configuration/snapshot` returns 200 (earlier live proof `trc_1aecb53d5474`).
- Installed canary runtime remains 0.1.42 and still contains the old renderer, so this main-based runtime hotfix is required before the live repair is durable across future lifecycle operations.

## Acceptance status

- [x] Main/canary defect reproduced with focused RED.
- [x] Correct renderer and fresh-per-release reconciliation migration implemented.
- [x] Loud focused gateway/Caddy test ownership added so this class cannot silently fall into unrelated broad OS tests.
- [x] Full selected-suite execution green.
- [ ] Strict review and formal verify.
- [ ] Push hotfix branch and publish a new dev runtime from this exact verified ref.
- [ ] Promote that immutable runtime to canary, update this node, and re-prove installed renderer + live Caddy + signed Configuration roundtrip.

- 2026-08-15 04:45:35 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## Final verification before runtime publication

- Public security docs now state the exact browser-session → signed Workspace Edge → local Caddy → Bun proof-preservation boundary and distinguish `MISSING_EDGE_SIGNATURE` from a missing browser login. Documentation validation passed: `trc_8c4d1fd8643f`.
- Strict review after docs/test-selection updates passed with 0 blocking issues and 0 documentation opportunities: `trc_53fbaae80a7e`.
- Formal full verify passed and is publish-valid against `origin/main`: `trc_bcfb8140a96a`.

## Acceptance status

- [x] Strict review and formal verify.
- [ ] Push hotfix branch and publish a new dev runtime from this exact verified ref.
- [ ] Promote immutable runtime to canary, update this node, and re-prove installed renderer + live Caddy + signed Configuration roundtrip.

- 2026-08-15 04:47:11 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
