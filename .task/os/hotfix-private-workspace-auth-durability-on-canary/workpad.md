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

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/secure/hosted-mcp-ingress.mdx`
- `packages/documentation/src/content/docs/secure/security-model.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/secure/hosted-mcp-ingress.mdx`
- `packages/documentation/src/content/docs/secure/security-model.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-08-15 04:39:03 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 04:45:35 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 04:47:11 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 05:12:25 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 05:15:09 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 05:16:43 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
- 2026-08-15 05:30:54 fs.write: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:46:06 `review.run`: passed — OK
- 2026-08-15 04:46:46 `review.run`: passed — OK
- 2026-08-15 04:47:06 `verify`: passed — OK
- 2026-08-15 05:15:22 `review.run`: passed — OK
- 2026-08-15 05:16:16 `review.run`: passed — OK
- 2026-08-15 05:16:34 `verify`: passed — OK

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

- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/secure/hosted-mcp-ingress.mdx`
- `packages/documentation/src/content/docs/secure/security-model.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/migrations.ts`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/migrations/reconcile-caddy-worker-pool.ts`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

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

## 0.1.43 activation-order regression — second test-first contract

New observed behavior after promoting and installing 0.1.43:
- The installed runtime source is correct and no longer strips signed Workspace Edge signature/surface/connector headers.
- The runtime manifest contains the fresh `release-0.1.43-reconcile-caddy-gateway` migration.
- The lifecycle update reported success, but the persisted live Caddyfile was stale again after activation. Evidence: lifecycle success `trc_8512975c042d`, installed renderer checks `trc_14964c1b7f75` / `trc_80f5c53d6cc3` / `trc_73352d0d9613`, stale live Caddy `trc_8fb61491b960`, installed manifest `trc_65482799552d`.

Root-cause hypothesis to prove before implementation:
1. The old runtime process stages 0.1.43 and runs the new release-scoped migration, which correctly reconciles Caddy.
2. The lifecycle engine activates the new `runtime/current` symlink.
3. The still-running old lifecycle process invokes `service.restart()`.
4. `createReloadServiceController` currently imports `reconcileCaddyWorkerPoolConfig` in-process from the old runtime. That stale renderer rewrites Caddy after the new migration, restoring the old broken header-stripping config even though the update then reports success.

behavior under test:
1. Post-activation service restart/reconciliation must execute the reconciler from the activated runtime, never the in-memory renderer from the runtime that initiated the update.
2. A cross-version update from an old renderer to a new renderer must leave Caddy matching the newly activated runtime after restart completes.
3. Ordinary restart on the current version must remain idempotent and still reconcile stale Caddy before reload.
4. The fix must preserve fail-closed signed-edge verification; it changes only which runtime owns reconciliation after activation.

new or changed tests:
- Add a focused service-controller RED that proves Caddy reconciliation is launched from the runtime-root script via the command runner before reload, rather than by a statically imported renderer.
- Add/update lifecycle handoff coverage so a stable `runtime/current` path can resolve to the newly activated release before post-activation restart.

focused red command: run the lifecycle restart/service contract plus Caddy reconciliation contract.
expected red failure: current controller performs Caddy reconciliation in-process and therefore no activated-runtime reconciliation command is observable before reload.
no-test waiver: not applicable.

Immediate live recovery after the 0.1.43 activation-order regression succeeded. The installed 0.1.43 migration was invoked once; the client returned a generic network error, so it was not retried. Read-only reconciliation proved the Caddyfile had already been repaired (`trc_f8dac7a245c1`), and a signed request through the actual live Caddy ingress to `/gateway/configuration/snapshot` returned HTTP 200 (`trc_aea3b70a141b`).

- 2026-08-15 05:12:25 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## 0.1.43 activation-order RED / GREEN evidence

- Focused RED `trc_bb3b38820f81`: the service controller made only the old-runtime reload call. It did not invoke the Caddy reconciliation script from the activated runtime and did not use the activated runtime's reload script.
- Implementation `trc_97fb2f140fa6`: macOS lifecycle service handoff now has an explicit stable `activeRuntimeRoot` (`runtime/current`) and Consuelo home. Caddy reconciliation is executed as a process from `runtime/current/scripts/migrations/reconcile-caddy-worker-pool.ts`; the subsequent reload is also executed from `runtime/current/scripts/consuelo-reload.js`. Therefore an update process that began under N cannot overwrite N+1 configuration after the symlink is activated. The migration script itself remains the single owner of Caddy restart-on-change.
- Focused GREEN `trc_6535def65817`: lifecycle restart + Caddy reconciliation contracts and syntax pass.
- Test-selection RED `trc_f2d813caa79c`: lifecycle service/restart changes were not owned by the focused lifecycle rule and fell into the broad OS package suite.
- Test-selection ownership fix `trc_074de7010183` + generated registry/focused GREEN `trc_d66192409e76`: `service.ts` and the restart regression are now critical exclusive lifecycle-owned surfaces, and the exact restart contract is included in the lifecycle handoff suite.
- Full selected-suite GREEN `trc_115599fad150`: 35 selection contracts, 144 lifecycle/platform/tool handoff tests including the activated-runtime regression, syntax, lifecycle facade snapshots, and workspace CI policy contracts all passed with no failed suites.

## Acceptance status — 0.1.44 candidate

- [x] Second root cause reproduced before implementation.
- [x] Post-activation reconciliation/reload now come from activated `runtime/current` rather than stale in-process runtime code.
- [x] Focused lifecycle test ownership is loud and excludes unrelated broad OS package tests.
- [x] Full selected-suite execution green.
- [ ] Strict review and formal verify.
- [ ] Push new exact source commit, merge to main preserving ancestry, publish next immutable runtime, promote canary, and update this node.
- [ ] After update success, prove live Caddy remains correct; then perform one additional restart and prove it remains correct again.

- 2026-08-15 05:15:09 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## 0.1.44 final verification before publication

- Review initially found one error-handling issue around the new async reconciliation boundary and mapped CLI/install documentation opportunities (`trc_89d4ac1f0100`). The reconciliation subprocess now has an explicit causal error boundary (`trc_9afd63855997`), and CLI/install docs now document current-runtime restart/update ownership (`trc_b2106f2ab7d0`).
- Documentation validation plus the focused lifecycle/Caddy contracts passed: `trc_9cdd449fe4ad`.
- Final strict review passed with 0 blocking issues and 0 documentation opportunities: `trc_f9e9bd4a97e7`.
- Formal full verify passed and is publish-valid against `origin/main`: `trc_7d392a2f6374`.

## Acceptance status — ready to publish

- [x] Strict review and formal verify.
- [ ] Push the exact 0.1.44 candidate source commit.
- [ ] Merge it to main with a merge commit so the immutable release source is a protected-channel ancestor.
- [ ] Publish dev, promote canary, update this node, then prove update + an additional restart both preserve live Caddy and a signed private Configuration roundtrip.

- 2026-08-15 05:16:43 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`

## Live 0.1.44 deployment and restart proof

- Direct main hotfix PR #2028 merged with a merge commit (`trc_9752f3748aca`). Exact verified source `ff8b643ddd11aee4dd61c31d7fcc2378e85ce1ca` is an ancestor of main (`trc_6479d0db4a5c`).
- Main runtime publish run 31866602249 completed successfully (`trc_d0047b61d3d2`). It published Consuelo OS 0.1.44, release-set bundle `sha256:35ca27eec90dcf2f25edb7a3a6a6e78a9aa512fb6bd19bbc962fa7230f4dfe55`, darwin-arm64 bundle `sha256:265c9a6d82b9e0711c048b7a5500871c90780e4bdbf673b8277325853a8c33af`, fingerprint `sha256:7e417994089ba8f95a800bb6282a630a05614a85352726bbf894bf72ceb5a0a0` (`trc_fddc595ad8fe`).
- Dev → canary immutable promotion run 31866986202 succeeded (`trc_5be6d3dbb0e1`).
- Normal `lifecycle.update --channel canary` accepted operation `native-1786771724264-e7e23294-f9e5-4a79-a481-2f2b32ed19af` (`trc_a7905f505ed6`) and completed successfully on 0.1.44 (`trc_b58ecc77d1df`).
- After the update, both the installed 0.1.44 renderer and the persisted live Caddyfile contained none of the signed Workspace Edge signature/surface/connector header-removal directives (`trc_dfde0d3e0d36`). A signed request through the actual local Caddy ingress to `/gateway/configuration/snapshot` returned HTTP 200 (`trc_d5be2dcb829b`). This proves the old-runtime post-activation overwrite is fixed.
- Per acceptance criteria, performed one additional normal OS restart (`trc_652812dd8483`). After reconnect, runtime remained 0.1.44 and the live Caddyfile still contained none of those signed-header removal directives (`trc_833edece652a`). The same signed private Configuration request through live Caddy again returned HTTP 200 (`trc_a605d54bb7f1`). This proves both `consuelo update` and a subsequent `consuelo restart` preserve the repaired gateway contract.

## Stream follow-up state

- Tried to sync `stream/os` from main after the hotfix. The first attempt exposed a `stream.sync` manifest/script mismatch (`--repo` is advertised but rejected: `trc_a82fcbd5550e`); retry without that argument reached the real guard but refused because the shared stream worktree currently contains unrelated uncommitted/conflicted work, including a `UU` native-lifecycle test (`trc_6fb38adca22a`). No stream mutation was forced and no unrelated work was touched. Main/canary are already fixed; PR #2021 remains open as the stream follow-up surface until that unrelated conflict is cleared.

## Acceptance status — complete

- [x] Exact browser-session failure class root-caused without weakening security.
- [x] Complete private Site/Gateway route matrix has loud workspace-session + signed-edge coverage.
- [x] Caddy protects every current/future `WORKSPACE_EDGE_NODE_HEADERS` member from stripping.
- [x] Runtime releases force fresh idempotent Caddy reconciliation per version.
- [x] Cross-version update post-activation handoff executes reconciliation/reload from `runtime/current`.
- [x] Focused critical test-selection ownership prevents this class from silently falling into broad unrelated suites.
- [x] 0.1.44 published, promoted to canary, and installed on the affected home node.
- [x] Update proof: live Caddy correct + signed private Configuration request 200.
- [x] Restart proof: live Caddy still correct + signed private Configuration request 200.

- 2026-08-15 05:30:54 append: `.task/os/hotfix-private-workspace-auth-durability-on-canary/workpad.md`
