# fix OS connector provisioning deployment contract and failure propagation

branch: `task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1383/fix-os-connector-provisioning-deployment-contract-and-failure-propagation
github pr: https://github.com/consuelohq/opensaas/pull/1383
started: 2026-07-10
base: `origin/main`

## acceptance criteria

- [x] Device grants can enter terminal `failed` state with safe `workspace_route_setup_failed` metadata.
- [x] Google callback, workspace-selection POST, and direct approval persist the same terminal failure and clear bootstrap, tunnel, and access-token material.
- [x] Device token polling returns the stable terminal failure instead of `authorization_pending`.
- [x] `/health` reports connector provisioning ready only when both the D1 route registry and connector provisioner exist.
- [x] Worker configuration declares deterministic connector provisioning values and required `CLOUDFLARE_API_TOKEN` secret metadata without storing a token.
- [x] Release preflight parses remote Worker secret metadata, fails before snapshot/deploy mutation when the token is absent, and verifies connector provisioning health.
- [x] Synchronous and asynchronous CLI failures produce one concise message without a Bun stack trace.
- [x] Required focused, regression, provisioning-contract, typecheck, dry-run, review, and verify gates pass.
- [x] A real release attempt stops intentionally with `Device authority secret CLOUDFLARE_API_TOKEN is not configured` while the remote secret is absent.

## implementation

- Added a single sanitized terminal grant-failure transition used by Google OAuth callback, workspace-selection POST, and direct approval.
- Added stable terminal token-poll responses and binding-based connector-provisioning readiness health.
- Added deterministic non-secret Cloudflare connector configuration and required Worker secret metadata.
- Added a pure Worker-secret readiness helper that parses Wrangler JSON output.
- Refactored the release operator around injected command/fetch dependencies, import-safe execution, pre-mutation secret preflight, readiness health verification, and concise failure handling.
- Kept all Cloudflare authority server-side; customer `cloudflared` remains accountless.

## files changed

- `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/scripts/lib/device-authority-release-readiness.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/os-release-device-auth.ts`

## TDD evidence

- Red run before production implementation: 8 expected failures and 21 existing passes across the focused Worker/release suite.
- Expected red causes: missing readiness health field, nonterminal and unsanitized provisioning failure, missing deterministic config/secret helper, and missing import-safe preflight seam.
- Final focused Worker/release suite: 30/30 passing.
- Behavior coverage includes all three provisioning entry points, two stable terminal polls, persisted failed state, token clearing, safe-message redaction, remote-secret ordering, health readiness, import safety, and concise sync/async failures.

## validation evidence

- Focused Worker/release tests: 30 passed, 0 failed.
- OAuth device HTTP client + onboarding flow: 28 passed, 0 failed.
- Cloudflare provisioning contract suites with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`: 28 passed, 0 failed.
- `packages/os` typecheck: passed (`workspace script syntax checks passed`).
- `wrangler deploy --dry-run`: passed; Wrangler 4.74.0 accepted all deterministic bindings. It emitted the expected warning that `[secrets]` fields are experimental.
- Real release preflight: exited 1 with exactly `Device authority secret CLOUDFLARE_API_TOKEN is not configured`; stdout empty; no Bun stack; no R2 upload; no deploy command.
- `review.run --base origin/main --no-tests`: final run passed with zero blocking or pre-existing findings.
- `verify --base origin/main`: passed; publish-valid stamp written; workspace audit test passed; database guard reported zero risks/findings.
- `git diff --check origin/main`: passed.

## live-release state

- Remote Worker secret inventory still lacks `CLOUDFLARE_API_TOKEN`.
- The release operator intentionally stops before every remote mutation.
- No live release was performed.
- The missing server-side Worker secret is the only observed live-release blocker.

## recovery notes

- PR #1383 originally contained only the task bootstrap commit and zero implementation files.
- The restart left a prunable Git worktree registration plus a metadata-only directory, with no source checkout or recoverable uncommitted implementation.
- The metadata-only directory was moved to macOS Trash, the stale worktree record was pruned, and the same task branch/PR was safely recreated from current `main`.
- No unrelated user changes were present or overwritten.

## key decisions

- Preserve PR #1383 and its branch rather than create a competing PR.
- Never store, print, or snapshot a real `CLOUDFLARE_API_TOKEN` value.
- Do not add customer Cloudflare login or credentials and do not weaken WAF policy.
- Test release ordering through injected dependencies rather than source-order assertions.

## publish checklist

- [x] focused tests red for expected reasons
- [x] implementation complete
- [x] focused and regression tests green
- [x] `review.run --base origin/main --no-tests`
- [x] `verify --base origin/main`
- [x] workpad finalized
- [ ] task pushed
- [ ] task promoted through `task.pr`
- [ ] task finished when safe

- 2026-07-10 21:00:29 write: `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/workpad.md`

## workspace-owned: files changed

- `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/scripts/lib/device-authority-release-readiness.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/os-release-device-auth.ts`

## workspace-owned: activity log

- 2026-07-10 21:00:29 fs.write: `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/workpad.md`

## workspace-owned: validation evidence

- Focused Worker/release tests: 30 passed, 0 failed.
- OAuth device HTTP client + onboarding flow: 28 passed, 0 failed.
- Cloudflare provisioning contract suites with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`: 28 passed, 0 failed.
- `packages/os` typecheck: passed (`workspace script syntax checks passed`).
- `wrangler deploy --dry-run`: passed; Wrangler 4.74.0 accepted all deterministic bindings. It emitted the expected warning that `[secrets]` fields are experimental.
- Real release preflight: exited 1 with exactly `Device authority secret CLOUDFLARE_API_TOKEN is not configured`; stdout empty; no Bun stack; no R2 upload; no deploy command.
- `review.run --base origin/main --no-tests`: final run passed with zero blocking or pre-existing findings.
- `verify --base origin/main`: passed; publish-valid stamp written; workspace audit test passed; database guard reported zero risks/findings.
- `git diff --check origin/main`: passed.
- 2026-07-10 21:00:48 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/current.json`, `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/evidence-log.json`, `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/read-log.json`, `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/session.json`, `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/verify.json`, `.task/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation/workpad.md`, `.task/tasks/security/fix-os-connector-provisioning-deployment-contract-and-failure-propagation.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/scripts/lib/device-authority-release-readiness.ts`, `packages/os/tests/os-device-authority-release-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/os-release-device-auth.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none
