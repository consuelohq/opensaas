# DEV-1617 repair Dialer release inputs and production build

branch: `task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2630
started: 2026-10-27 America/New_York

## acceptance criteria

- [ ] A clean, frozen installation and the exact Docker build chain resolve all contacts runtime imports without relying on root hoists.
- [ ] The local Dialer lab rolls back every applied inbound migration in descending order and restores its expected baseline.
- [ ] Release preflight rejects trimmed edge secrets shorter than the runtime minimum before provider mutation.
- [ ] Focused regression tests, the service-backed lab, build proof, review and verify pass before stream publication.
- [ ] Preserve the sibling DEV-1614 and DEV-1615/1616 agents' ownership and record any integration risks.
- [ ] Inspect the supplied OS release-stall evidence and sibling task progress; fix only a proven task-local obstruction here and hand off broader OS changes separately.

## plan

1. Reproduce the failed contacts dependency boundary and refresh the original three DEV-1617 findings.
2. Define focused release/dependency and rollback/preflight tests, run red, then make the smallest repairs.
3. Run an isolated dependency/install/build check and the service-backed lab. Avoid changing the main checkout or shared node_modules.
4. Inspect the diff, run strict review and verify, diagnose durable state after timeouts, then push and promote into stream/dialer.
5. Update DEV-1617 with exact evidence. Keep source promotion, main integration, deployment, and carrier acceptance distinct.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- Start from current unshipped stream b37d4c75820b0f2a7ac4e465d49e910eef69085f.
- Latest Railway build 9a400411-5e69-4e39-bd44-f050d582b1b4 passes frozen install and logger build, then contacts fails TS2307 for @sentry/node and @consuelo/logger.
- Node-stage repair already landed October 8; do not redo it.
- Main's deleted CRM/application boundary is authoritative for eventual integration. This task must not add legacy application dependencies.
- Do not touch sibling rep readiness, callback lifecycle, or their task files.

## notes for ko

- Twilio is active, three allowlisted owned voice numbers remain available, zero in-progress calls observed.
- GHL session exchange works; public backend/edge health 200. Inbound operator route 404 indicates backend/edge mismatch.
- No live calls, purchases, Stripe checkout, recordings, schema mutations in production, or deployment changes are part of validation here.
- Supplied OS handoff describes synchronous release timeout, advisory-check gating and mutable-dev-pointer resume defects. These are hypotheses for the secondary investigation; they are not yet proven to be the current verify failure.

## improvements noticed

- Existing task starter symlinks node_modules from main; clean dependency proof must avoid shared dependency mutation.
- Older runbook still references removed GraphQL/Twenty paths; follow current standalone Bun/Hono contracts and user instructions.

## errors i ran into

- Earlier long browser-related code.call requests returned CONSUELO_NODE_UNAVAILABLE. Other typed facade operations recovered. Record durable verification state before retrying long operations.

## Test-first contract

behavior under test:
- Clean contacts build declares the runtime modules it imports, including optional-provider loading rules.
- Lab rollback follows the current migration ledger in reverse.
- Release preflight uses the same trimmed edge-secret minimum as runtime before any deployment mutation.

existing local pattern:
- Bun release contract tests in packages/dialer-server/src/release and packages/lead-connector/src/deployment.
- Existing migration/lab integration test and manifest/optional-import checks.

new or changed tests:
- Execute the actual YAML preflight run block with empty, 23-character, padded-short, 24-character and padded-valid secrets; assert fail-closed status without leaking the supplied values.
- Extend the existing service-backed lab test to assert migration 013 is included; existing rollback guard should fail while 013 is still applied.

focused red command:
- bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts
- CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1 bun test packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts

expected red failure:
- Missing runtime dependency declarations; rollback begins at migration 012 while 013 remains applied; short edge secret passes preflight.

no-test waiver:
- Dependency declaration is a mechanical package-manager repair; prove it through a clean isolated contacts build rather than a test that only mirrors package.json. Package-manager lockfile regeneration will also be checked with a frozen install.
- No waiver for the release preflight or service-backed rollback behavior.

---

## publish checklist

- Focused red/green evidence recorded.
- Isolated install/build and service-backed lab recorded.
- Self-review, strict review and verify are green.
- task.push then task.pr read back and sibling changes preserved.

- 2026-10-28 02:34:26 write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`

## workspace-owned: files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-10-28 02:34:26 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:37:37 write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:37:37 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:37:59 fs.write: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-10-28 02:38:00 fs.write: `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- 2026-10-28 02:39:51 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:41:07 fs.write: `packages/dialer-server/scripts/local-dialer-lab.ts`
- 2026-10-28 02:41:08 fs.write: `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- 2026-10-28 02:41:09 fs.write: `.github/workflows/consuelo-production-release.yaml`
- 2026-10-28 02:41:21 fs.write: `packages/dialer-server/scripts/local-dialer-lab.ts`
- 2026-10-28 02:45:07 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:48:59 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:49:00 fs.write: `packages/workspace/tests/test-selection.test.js`
- 2026-10-28 02:49:26 fs.write: `packages/workspace/test-selection.rules.json`
- 2026-10-28 02:49:26 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
- 2026-10-28 02:53:06 fs.write: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Red evidence and refined scope

- Preflight regression ran red: a whitespace-only edge secret passed the existing shell preflight. Command: bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts (4 pass / 1 fail).
- Existing service-backed lab ran red before its outer rollback: learning-rollback-scenario.ts also omitted migration 013 and hard-coded 12 restored migrations. Fix both rollback paths and compare restored ledger to the original snapshot. Command: CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1 bun test packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts (1 fail).
- Installed Bun is 1.3.14; this stream explicitly declares packageManager bun@1.3.14. The active stream build contract is authoritative for this dependency-only repair; do not migrate main package managers or restore legacy workspaces. Use bun add --lockfile-only --ignore-scripts to preserve the shared node_modules symlink.
- Docker is absent. Prove the full package build chain and Linux cross-compilation locally in an isolated fixture; leave actual Linux image/runtime evidence to CI/Railway.

- 2026-10-28 02:39:51 append: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`

- 2026-10-28 02:41:07 write: `packages/dialer-server/scripts/local-dialer-lab.ts`

- 2026-10-28 02:41:08 write: `packages/dialer-server/src/lab/learning-rollback-scenario.ts`

- 2026-10-28 02:41:09 write: `.github/workflows/consuelo-production-release.yaml`

- 2026-10-28 02:41:21 write: `packages/dialer-server/scripts/local-dialer-lab.ts`

## Green evidence

- Focused release contract: 5 passed, 0 failed; executes the actual workflow preflight with empty/whitespace, 23-character, padded-short, Unicode whitespace, 24-character, and padded-valid secrets.
- Service-backed local lab: 1 passed, 0 failed, 39 assertions; isolated PostgreSQL/Redis, migration 013 rollback and reapply, concurrent authority/simulation proof, and full cleanup.
- Isolated strict-linked contacts fixture first reproduced exactly TS2307 for @sentry/node and @consuelo/logger, with no other compiler errors. After package-manager repair, frozen install and logger/contacts builds pass.
- Full clean tracked-source export with working changes, no inherited node_modules: frozen Bun install passes; logger -> contacts -> dialer -> lead-connector -> dialer-server builds pass; all three Dialer package typechecks pass.
- Clean product suites: dialer 264 passed; server 219 passed / 71 skipped (service-backed flags opt-in); LeadConnector 161 passed. Service-backed lab was run separately above.
- Linux x64 server cross-compilation succeeds. This is compilation evidence, not a Linux container runtime or carrier test. Docker is not installed; no Docker image was run locally.
- Clean fixture: /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-dialer-clean-release-xfbynngl. Per-stage status/logs in release-validation-status.json and release-step-*.log; contains no provider credentials.
- Formatting-only final change to the release contract test will be checked by the repository gate. No broad extra test reruns are needed unless it changes behavior or exposes new failure.
- Secondary monitoring: both manual ChatGPT agents have managed Dialer task worktrees. App thread summaries currently expose only their initial messages; they are insufficient to infer progress/stall. OS traces returned no verify events in the current window, so no current verify deadlock is yet proven.

- 2026-10-28 02:45:07 append: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 02:45:29 `review.run`: passed — OK
- 2026-10-28 02:45:34 `verify`: passed — OK
- 2026-10-28 02:46:30 `verify`: passed — OK
- 2026-10-28 02:50:22 `review.run`: passed — OK
- 2026-10-28 02:50:25 `verify`: passed — OK

## Verified publish-gate obstruction and bounded recovery

- Typed verify twice returned outer OK/exit 0 with passed=false, publishValid=false and files=0 (traces trc_1f565c847d15, trc_775419f51d66). No task verify stamp was written.
- Running the exact verifier via task-scoped code.call exposed the real failure: selected prerequisite [yarn,nx,run,@consuelo/contacts:build] exits Unsupported package manager specification (bun@1.3.14). The actual verifier exits 1 and correctly lists seven changed files. Server and LeadConnector suites still pass. This is not a product-test failure.
- Scope extension: replace only the Dialer prerequisite commands in this stream's test-selection rule with the existing Bun package build chain (logger before contacts), update its focused existing regression test and regenerate the registry. This is needed to publish DEV-1617 and unblock sibling Dialer tasks; no general OS release behavior changes.
- Add focused red coverage before changing the selector rule. Preserve fail-closed gates. No debug skip flags, fake stamp, or success override.
- Broader OS facade summary/cwd issue remains a separate investigation: the typed result hides the raw failure and reports zero files. Capture a handoff with exact traces; do not silently patch OS source in this Dialer task.

- 2026-10-28 02:48:59 append: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`

- 2026-10-28 02:49:00 write: `packages/workspace/tests/test-selection.test.js`

- 2026-10-28 02:49:26 write: `packages/workspace/test-selection.rules.json`

- Selector regression ran red: both Dialer-server and shared-contacts changes lacked a logger prerequisite and still selected Yarn. Added source-rule repair only after this red evidence; registry will be generated from the canonical rule.

- 2026-10-28 02:49:26 append: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`

## Final validation and secondary OS finding

- Existing selector regression suite: 82 passed, 0 failed, including logger -> contacts -> Hono ordering for both shared contacts and server changes.
- Final strict review passed: zero new, pre-existing, or blocking findings (trc_20d211a47ebe).
- Actual unmodified verifier command executed from this task worktree via task-scoped code.call: passed=true, publishValid=true; all five selected suites and DB guards passed; a real scoped verify.json was written (trc_f31675552204). No debug skip flags or fake stamps were used.
- Typed verify still executes the wrong command context and returned files=0 / passed=false / publishValid=false in 353ms (trc_b67ad03f19e5). Bounded supported recovery is code.call running the exact verifier from the canonical task worktree, as above.
- Current-main executor.ts still has resolveWorkspaceCommandCwd route only code-run/code-call and task:/stream: scripts to taskWorktree. verify is omitted. compactVerifyData drops because and testSelection; a separate OS regression should assert both task cwd and failure preservation. Do not ship that OS correction inside this Dialer PR.
- Read-back diff has ten scoped product/workflow/validation source files plus task metadata. Registry regeneration also refreshes three already-existing tests missing from the stale inventory; no sibling task code is included.
- All task acceptance criteria are satisfied for stream publication. Main integration, production image deployment, frontend/backend alignment and live carrier acceptance remain subsequent work. Retain the task checkout while the stream is unshipped.

- 2026-10-28 02:53:06 append: `.task/dialer/dev-1617-repair-dialer-release-inputs-and-production-build/workpad.md`
