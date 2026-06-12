# fix current OS review findings

branch: `task/os/fix-current-os-review-findings`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/967

## Objective

Verify each supplied inline/nitpick finding against current `stream/os`, fix only findings still valid, skip stale findings with a brief reason, keep the patch minimal, and validate.

## Exploration

- Read stream context for `stream/os`; recent stream commits include hosted embedding gateway default and semantic index repo scoping.
- Read repo standards: `AGENTS.md`, `CODING-STANDARDS.md`, and `packages/workspace/SCRIPTS.md` before code edits.
- Read target files before editing: workflow hook, artifact renderer, embedder/config/gateway/store, install-state, and semantic-index test.

## Test-first contract

Behavior under test:
- `workflow.js` forwards `state.noTests` intent into `validation.review` instead of always forcing `noTests: true`.
- `artifact-render.ts` sanitizes map hrefs before rendering/querying, reports CLI render errors with deterministic context, fixes stale usage text, and avoids per-frame query/storage work in scroll sync.
- `embedder.js` rejects unknown embedding providers instead of silently routing to the gateway.
- `embedding-config.js` honors boolean `truncate: false`; gateway request model and config id use the resolved `apiModel` consistently.
- `store.js` runtime asset metadata does not persist raw `remoteUrl`.
- `install-state.ts` reports `exists` for security files/directories already present.
- `semantic-index-storage.test.ts` uses exported helpers/behavior rather than source-string assertions, only if feasible without importing native SQLite side effects.

Focused validation plan:
- Existing package syntax/typecheck: `cd packages/os && bun run typecheck`.
- Focused tests where available: semantic embedding gateway test and semantic index storage test.
- Add focused tests only when a current issue has a reasonable existing test surface. For comments that touch generated inline browser script in `artifact-render.ts`, validate with syntax/typecheck and readback/diff unless an existing renderer fixture test exists.

Expected red failures before implementation:
- Source inspections should show which findings are still live; no new production code changes before verification.

- 2026-06-11 17:35:48 write: `.task/os/fix-current-os-review-findings/workpad.md`

## files changed

- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/artifact-render.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/artifact-render.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-index-storage.test.ts`

## workspace-owned: files changed

- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/artifact-render.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/artifact-render.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-index-storage.test.ts`

## workspace-owned: activity log

- 2026-06-11 17:35:48 fs.write: `.task/os/fix-current-os-review-findings/workpad.md`
- 2026-06-11 17:41:09 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:41:19 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:41:48 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:42:43 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:45:02 fs.write: `packages/os/tests/semantic-embedding-gateway.test.ts`
- 2026-06-11 17:45:36 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:46:21 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:47:07 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:47:55 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 17:48:07 fs.write: `packages/os/tests/artifact-render.test.ts`
- 2026-06-11 17:48:25 fs.patch: `packages/os/tests/install-state.test.ts`
- 2026-06-11 17:49:54 fs.patch: `packages/os/scripts/lib/index/embedding-config.js`
- 2026-06-11 17:50:33 fs.patch: `packages/os/scripts/lib/index/embedding-config.js`
- 2026-06-11 17:50:56 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:51:29 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:51:37 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:11 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:35 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:50 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:58 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:53:44 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:54:46 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:55:33 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:56:39 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:58:02 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 17:58:52 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 17:59:25 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 17:59:57 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:00:47 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:01:31 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:02:20 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:02:48 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:03:18 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:03:25 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:03:51 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:04:38 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:05:14 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:06:28 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-11 18:07:25 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:09:03 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:13:27 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 18:19:00 fs.patch: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:22:17 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:23:32 fs.patch: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:25:23 fs.patch: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:27:26 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:30:05 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:31:42 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:42:17 fs.write: `.task/os/fix-current-os-review-findings/workpad.md`

## workspace-owned: files read

- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/artifact-render.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-index-storage.test.ts`

## workspace-owned: validation evidence

- 2026-06-11 18:11:37 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-11 18:13:27 patch lines 184-187: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 18:13:38 `checkFiles`: passed — OK
- 2026-06-11 18:19:00 patch lines 1-16: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:22:17 write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:23:32 patch lines 22-28: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:25:23 patch lines 20-24: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:27:26 write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:30:05 patch lines 382-382: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:31:42 patch lines 378-390: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:35:07 `checkFiles`: passed — OK
- 2026-06-11 18:38:46 `review.run`: passed — OK
- 2026-06-11 18:40:01 `verify`: passed — OK
- 2026-06-11 18:43:18 `verify`: passed — OK
- 2026-06-12 18:26:15 `review.run`: passed — OK
- 2026-06-12 18:37:59 `review.run`: passed — OK
- 2026-06-12 18:39:46 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/launcher-final-mobile-sizing/current.json`, `.task/design/launcher-final-mobile-sizing/evidence-log.json`, `.task/design/launcher-final-mobile-sizing/read-log.json`, `.task/design/launcher-final-mobile-sizing/session.json`, `.task/design/launcher-final-mobile-sizing/verify.json`, `.task/design/launcher-final-mobile-sizing/workpad.md`, `.task/design/match-launcher-pierre-mobile-spacing/current.json`, `.task/design/match-launcher-pierre-mobile-spacing/evidence-log.json`, `.task/design/match-launcher-pierre-mobile-spacing/read-log.json`, `.task/design/match-launcher-pierre-mobile-spacing/session.json`, `.task/design/match-launcher-pierre-mobile-spacing/verify.json`, `.task/design/match-launcher-pierre-mobile-spacing/workpad.md`, `.task/design/responsive-sites-launcher-spacing/current.json`, `.task/design/responsive-sites-launcher-spacing/evidence-log.json`, `.task/design/responsive-sites-launcher-spacing/read-log.json`, `.task/design/responsive-sites-launcher-spacing/session.json`, `.task/design/responsive-sites-launcher-spacing/verify.json`, `.task/design/responsive-sites-launcher-spacing/workpad.md`, `.task/diff-cockpit/ai-review-comments-sidebar/workpad.md`, `.task/diff-cockpit/compact-review-dashboard/current.json`, `.task/diff-cockpit/compact-review-dashboard/evidence-log.json`, `.task/diff-cockpit/compact-review-dashboard/read-log.json`, `.task/diff-cockpit/compact-review-dashboard/session.json`, `.task/diff-cockpit/compact-review-dashboard/verify.json`, `.task/diff-cockpit/compact-review-dashboard/workpad.md`, `.task/os/add-workflow-intent-bundles/current.json`, `.task/os/add-workflow-intent-bundles/evidence-log.json`, `.task/os/add-workflow-intent-bundles/read-log.json`, `.task/os/add-workflow-intent-bundles/session.json`, `.task/os/add-workflow-intent-bundles/verify.json`, `.task/os/add-workflow-intent-bundles/workpad.md`, `.task/os/emit-workflow-roles-in-tool-manifest/current.json`, `.task/os/emit-workflow-roles-in-tool-manifest/evidence-log.json`, `.task/os/emit-workflow-roles-in-tool-manifest/read-log.json`, `.task/os/emit-workflow-roles-in-tool-manifest/session.json`, `.task/os/emit-workflow-roles-in-tool-manifest/verify.json`, `.task/os/emit-workflow-roles-in-tool-manifest/workpad.md`, `.task/os/fix-current-os-review-findings/workpad.md`, `.task/os/wire-task-workflow-hook-dispatcher/current.json`, `.task/os/wire-task-workflow-hook-dispatcher/evidence-log.json`, `.task/os/wire-task-workflow-hook-dispatcher/read-log.json`, `.task/os/wire-task-workflow-hook-dispatcher/session.json`, `.task/os/wire-task-workflow-hook-dispatcher/verify.json`, `.task/os/wire-task-workflow-hook-dispatcher/workpad.md`, `.task/security/address-cloudflare-edge-provisioning-nits/current.json`, `.task/security/address-cloudflare-edge-provisioning-nits/evidence-log.json`, `.task/security/address-cloudflare-edge-provisioning-nits/read-log.json`, `.task/security/address-cloudflare-edge-provisioning-nits/session.json`, `.task/security/address-cloudflare-edge-provisioning-nits/verify.json`, `.task/security/address-cloudflare-edge-provisioning-nits/workpad.md`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/current.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/evidence-log.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/read-log.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/session.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/verify.json`, `.task/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies/workpad.md`, `.task/security/cloudflare-tdd-contracts/current.json`, `.task/security/cloudflare-tdd-contracts/evidence-log.json`, `.task/security/cloudflare-tdd-contracts/read-log.json`, `.task/security/cloudflare-tdd-contracts/session.json`, `.task/security/cloudflare-tdd-contracts/workpad.md`, `.task/security/fix-cloudflare-d1-registry-review-findings/current.json`, `.task/security/fix-cloudflare-d1-registry-review-findings/evidence-log.json`, `.task/security/fix-cloudflare-d1-registry-review-findings/read-log.json`, `.task/security/fix-cloudflare-d1-registry-review-findings/session.json`, `.task/security/fix-cloudflare-d1-registry-review-findings/verify.json`, `.task/security/fix-cloudflare-d1-registry-review-findings/workpad.md`, `.task/security/fix-cloudflare-tdd-review-comments/current.json`, `.task/security/fix-cloudflare-tdd-review-comments/evidence-log.json`, `.task/security/fix-cloudflare-tdd-review-comments/read-log.json`, `.task/security/fix-cloudflare-tdd-review-comments/session.json`, `.task/security/fix-cloudflare-tdd-review-comments/workpad.md`, `.task/security/fix-workspace-gateway-review-comments/current.json`, `.task/security/fix-workspace-gateway-review-comments/evidence-log.json`, `.task/security/fix-workspace-gateway-review-comments/read-log.json`, `.task/security/fix-workspace-gateway-review-comments/session.json`, `.task/security/fix-workspace-gateway-review-comments/verify.json`, `.task/security/fix-workspace-gateway-review-comments/workpad.md`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/current.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/evidence-log.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/read-log.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/session.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/verify.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/workpad.md`, `.task/security/make-workspace-gateway-contracts-green/current.json`, `.task/security/make-workspace-gateway-contracts-green/evidence-log.json`, `.task/security/make-workspace-gateway-contracts-green/read-log.json`, `.task/security/make-workspace-gateway-contracts-green/session.json`, `.task/security/make-workspace-gateway-contracts-green/verify.json`, `.task/security/make-workspace-gateway-contracts-green/workpad.md`, `.task/security/repair-workspace-edge-signature-contract/current.json`, `.task/security/repair-workspace-edge-signature-contract/evidence-log.json`, `.task/security/repair-workspace-edge-signature-contract/read-log.json`, `.task/security/repair-workspace-edge-signature-contract/session.json`, `.task/security/repair-workspace-edge-signature-contract/workpad.md`, `.task/security/write-cloudflare-edge-router-registry-tests/current.json`, `.task/security/write-cloudflare-edge-router-registry-tests/evidence-log.json`, `.task/security/write-cloudflare-edge-router-registry-tests/read-log.json`, `.task/security/write-cloudflare-edge-router-registry-tests/session.json`, `.task/security/write-cloudflare-edge-router-registry-tests/workpad.md`, `.task/tasks/design/launcher-final-mobile-sizing.json`, `.task/tasks/design/match-launcher-pierre-mobile-spacing.json`, `.task/tasks/design/responsive-sites-launcher-spacing.json`, `.task/tasks/diff-cockpit/ai-review-comments-sidebar.json`, `.task/tasks/diff-cockpit/compact-review-dashboard.json`, `.task/tasks/os/add-workflow-intent-bundles.json`, `.task/tasks/os/emit-workflow-roles-in-tool-manifest.json`, `.task/tasks/os/wire-task-workflow-hook-dispatcher.json`, `.task/tasks/security/address-cloudflare-edge-provisioning-nits.json`, `.task/tasks/security/back-cloudflare-registry-with-d1-and-preserve-post-bodies.json`, `.task/tasks/security/cloudflare-tdd-contracts.json`, `.task/tasks/security/fix-cloudflare-d1-registry-review-findings.json`, `.task/tasks/security/fix-cloudflare-tdd-review-comments.json`, `.task/tasks/security/fix-workspace-gateway-review-comments.json`, `.task/tasks/security/make-cloudflare-edge-router-registry-contracts-green.json`, `.task/tasks/security/make-workspace-gateway-contracts-green.json`, `.task/tasks/security/repair-workspace-edge-signature-contract.json`, `.task/tasks/security/write-cloudflare-edge-router-registry-tests.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`, `packages/os/cloudflare/workspace-edge/src/index.ts`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/hooks/README.md`, `packages/os/hooks/dispatcher.js`, `packages/os/hooks/intent.js`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/generate-tool-manifest.ts`, `packages/os/scripts/intent.js`, `packages/os/scripts/lib/artifacts.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/scripts/lib/workspace-connector-transport.ts`, `packages/os/scripts/lib/workspace-device-authorization.ts`, `packages/os/scripts/lib/workspace-edge-beta-smoke.ts`, `packages/os/scripts/smoke-workspace-edge.ts`, `packages/os/scripts/task-hook.js`, `packages/os/scripts/task-start.js`, `packages/os/tests/artifacts.test.ts`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/cloudflare-d1-route-registry.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/oauth-device-onboarding-contract.test.ts`, `packages/os/tests/task-hook-dispatcher.test.ts`, `packages/os/tests/task-manifest-workflow-roles.test.ts`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tests/workspace-edge-beta-smoke-contract.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/workflows.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## findings disposition

- `hooks/task/workflow.js`: valid. `validation.review` now uses `Boolean(state.noTests)` instead of forcing `noTests: true`.
- `artifact-render.ts` map hrefs: valid. Map links are normalized to safe hash fragments before rendering and before generated browser selectors are used.
- `artifact-render.ts` CLI usage: valid. Usage now points at `packages/os/scripts/artifact-render.ts`.
- `artifact-render.ts` CLI error handling: valid. Render/validate/write flow now uses a deterministic `try/catch` with contextual stderr and non-zero exit.
- `artifact-render.ts` scroll loop: valid. The generated reader script now caches rail/top DOM lookups and writes scroll position through a throttled idle/debounced path.
- `embedder.js`: valid. Unknown providers now fail closed instead of routing to the gateway.
- `embedding-config.js`/`embedding-gateway.js`: valid. Boolean `truncate: false` is honored, and gateway model/body/header use resolved `config.apiModel`.
- `store.js`: valid. Runtime asset metadata no longer persists raw `remoteUrl`, and repo identity strips embedded HTTPS credentials before hashing/metadata.
- `install-state.ts`: valid. Security generated/override dir and generated auth/Caddyfile actions now report `exists` when present before the run.
- `semantic-index-storage.test.ts` nitpick: valid. Replaced source-string assertions with behavior tests over exported helper outputs and a stubbed registry DB call.

Skipped fixes:

- The existing full `tests/install-state.test.ts` suite still has an unrelated stale expectation: it expects `Traces`, while the current rendered sites index says `Tracing`. I did not change that because it is outside the supplied security-action finding. The new targeted security-action test passes.

## validation

- `checkFiles` passed for all changed JS/TS/test files.
- `bun --cwd packages/os test tests/semantic-embedding-gateway.test.ts tests/semantic-index-storage.test.ts tests/artifact-render.test.ts` passed: 3 files, 15 tests.
- `bun --cwd packages/os test tests/install-state.test.ts -t "reports existing generated security assets as existing on reprovision"` passed.
- `cd packages/os && bun run typecheck` passed.
- `review.run` passed with zero must-fix issues.
- `verify` passed and wrote a publish-valid stamp.

Tooling gap: I used scoped `task.call` Python restores after line-range patches corrupted files; a typed single-file restore/apply helper would reduce recovery risk.

- 2026-06-11 18:42:17 append: `.task/os/fix-current-os-review-findings/workpad.md`
