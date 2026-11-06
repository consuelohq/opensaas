# Fix Cloudflare UI-only release route permissions and record deployed Worker evidence

branch: `task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2773
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Release recovery contract — DEV-1676
Goal: repair GitHub UI-only Cloudflare deployment without changing Railway, GHL Marketplace records, secrets, dialer runtime, billing, numbers, live calls, or parallel agents.
Baseline evidence: production run https://github.com/consuelohq/opensaas/actions/runs/42155129323 at merge SHA 9ca29cd8b65b9814a229d4d516576a38f4e1f5fb. All LeadConnector tests/build/preflight passed; wrangler uploaded Worker version 15b36ec5-9fbf-4930-a0ff-562142e519f2 and deployed it to 100%, then failed zone route reconciliation with 403 /zones/.../workers/routes. Public /, /admin, /overlay, /health 200; deployed UI JS/CSS contain DEV-1676 changes. Previous rollback version 5b8207fd-8886-4644-9992-8c380671185a.
Test-first contract:
- Behavior: pre-existing Worker routes remain untouched. Production UI-only job uploads a new Worker version and deploys it at 100% using version APIs, not wrangler deploy. It captures a machine-readable active Worker version receipt and verifies built assets. No Railway tokens or operations and no routing/dependency changes.
- Existing pattern: packages/lead-connector/src/deployment/release-workflow.contract.test.ts tests YAML, and .github/workflows/consuelo-production-release.yaml has exact allowlisted frontend_only classifier. Reuse these.
- New/changed test: assert UI job includes wrangler versions upload, versions deploy and deployments list --json, explicitly excludes release:deploy-worker/worker route update, retains exact SHA builds, and preserves no Railway access. Run focused red test before workflow edit.
- Focused red command: bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts. Expected red: current UI release job still calls release:deploy-worker and lacks versions upload/deploy + JSON evidence.
- Scope: one YAML workflow and its existing contract test; no changes to UI or backend; no-test waiver not needed. Build local assets before wrangler --dry-run to satisfy assets.directory. Verify package tests, build, exact classifier, strict review and formal verify; publish via isolated task-only main-based PR #2773. Do not merge unrelated stream/dialer.
- Deployment target: after exact-head CI, merge only main PR; main push's UI classifier should select frontend_only and skip full Railway; inspect successful GitHub release job and deployment evidence. Existing GHL managed browser signed out; cannot claim GHL in-app verified without auth.

- 2026-11-06 03:17:50 append: `.task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence/workpad.md`

## workspace-owned: files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

## workspace-owned: activity log

- 2026-11-06 03:17:50 fs.write: `.task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence/workpad.md`
- 2026-11-06 03:18:00 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-06 03:18:15 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-06 03:18:47 fs.write: `.task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence/workpad.md`
- 2026-11-06 03:24:28 fs.write: `.task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 03:18:42 `review.run`: passed — OK
- 2026-11-06 03:18:56 `verify`: passed — OK
- 2026-11-06 03:24:38 `review.run`: passed — OK
- 2026-11-06 03:24:50 `verify`: passed — OK

## Recovery validation and publication
- New release job changes only .github/workflows/consuelo-production-release.yaml; regression contract test in packages/lead-connector/src/deployment/release-workflow.contract.test.ts.
- Red-to-green: contract test failed against old wrangler deploy (route-writing job); passes after Worker versions upload --keep-vars, versions deploy --version-tag and deployment JSON receipt. Local Wrangler versions upload dry-run passes from built exact source without modifying production. YAML parses to seven original jobs with UI job 12 steps.
- Full LeadConnector tests: 245 pass / 0 fail / 1913 assertions, typecheck and build pass, git diff --check clean.
- Formal strict review.run base origin/main: 0 blockers/issues. No backend, dialer calling, billing, secret or Marketplace edits.
- Public UI was already verified live at calls.consuelohq.com from first deployment, version 15b36ec5-9fbf-4930-a0ff-562142e519f2 at 100%; previous version 5b8207fd-8886-4644-9992-8c380671185a. Current CI UI release will reupload identical app source and verify exact compiled bytes with provenance and record version/artifact. The GitHub token failed earlier only on zone routes; new version APIs do not reconcile routes.
- Next gates: formal verify publish-valid, scoped main PR #2773, exact SHA CI all jobs, exact-head main merge, postmerge automatic frontend_only=true UI-only job with Railway skipped, Worker manifest and public assets proof, Linear DEV-1676 update.

- 2026-11-06 03:18:47 append: `.task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence/workpad.md`

- 2026-11-06 03:23:50 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-06 03:24:07 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-06 03:24:15 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
## Review finding and additional safety regression
- GitHub reviewer on PR #2773 raised P1: approved UI plus launch-QA files in the same push could bypass both existing allowlists and initiate a full Railway release.
- Added an actual disposable-git regression before changing production YAML; it failed with release=true, frontend_only=false on the mixed QA+UI fixture.
- UI-only classification now regards the existing allowlisted QA artifacts as neutral, including package.json *only if* its semantically compared difference is the lab:launch script. New tests: UI-only, QA+UI, QA+UI+safe lab script all route Cloudflare only; runtime or dependency changes still route full release; QA-only still skips deployment; explicit manual Dialer dispatch still full release.
- New focused run: 6 passed, 118 assertions; build, typecheck, diff checks green. No change to dialer runtime.

- 2026-11-06 03:24:28 append: `.task/dialer/fix-cloudflare-ui-only-release-route-permissions-and-record-deployed-worker-evidence/workpad.md`
