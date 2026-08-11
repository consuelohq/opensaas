# automate dialer production release

branch: `task/dialer/automate-dialer-production-release`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1839/automate-dialer-production-release
github pr: https://github.com/consuelohq/opensaas/pull/1839
started: 2026-08-11

## acceptance criteria

- [x] PR CI covers dialer, dialer-server, LeadConnector, deployment configs, and relevant dependency/workflow changes as one release surface.
- [x] PR CI runs all three package tests/typechecks plus dialer-server and embed builds without production credentials.
- [x] Pushes to main can release Railway -> safe smoke -> Cloudflare -> GHL menu/read-back -> manifest, serialized and fail-closed.
- [x] GitHub stores deployment-only credentials; Stripe/Twilio/Groq/database/runtime secrets remain in Railway.
- [x] Production GHL menu updates one configured ID via official v3 API and verifies exact read-back.
- [x] Safe smoke proves health/auth/signature boundaries without calls, billing, recording, transcription, or number mutation.
- [x] Release manifest records git SHA, Railway/Cloudflare IDs, asset hashes, GHL evidence, and smoke results.
- [x] Manual rollback requires explicit known-good Railway/Cloudflare identifiers.
- [x] Build emits a stable Marketplace external-loader artifact for one-time manual installation; normal releases require no Marketplace browser/session credentials.
- [x] Workflow policy, focused contracts, package suites, typechecks/builds, strict review, and canonical verify pass.

## plan

1. Add red contract tests for CI/release/rollback invariants, exact GHL menu update/read-back, safe smoke/manifest, and stable Marketplace loader.
2. Implement package-owned deployment helpers; keep provider parsing/verification out of YAML where practical.
3. Extend Consuelo CI + production release and add explicit dialer rollback workflow.
4. Run red->green focused tests, then broad package validation, workflow policy, strict review, and canonical verify.
5. Push/merge through task lifecycle; configure GitHub Environment settings/secrets only after an explicit settings mutation step.

## current status

- Discovery complete. Official docs confirm Railway project-token CI deploys, Cloudflare token-scoped Wrangler deploy/rollback, GitHub protected environments, and HighLevel v3 Custom Menu read/update via agency private token.
- No production provider or GitHub settings mutation has occurred.
- `stream/dialer` is synced with current `main` at merge commit `176870235746d0c9ff075108fba135a4b4dfdbd1`; the updated stream is a true ancestor of this task branch.
- Release implementation is complete. Strict review and canonical verify are green; task is ready to publish.

## files changed

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/railway.json`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Dialer suite: 174/174 pass (`trc_9aff647316d0`, first package result).
- Dialer-server suite: 134/134 pass (`trc_3a5d4b916656`).
- LeadConnector suite: 120/120 pass (`trc_3a5d4b916656`).
- Typechecks: dialer, dialer-server, LeadConnector all pass (`trc_1df69044ed03`).
- Production builds: dialer-server executable + LeadConnector embed pass (`trc_de7d1735c92f`).
- Stable Marketplace loader emitted: 202-byte HTTPS-only external loader; build marker records it (`trc_7f1da64f47af`).
- YAML parse: all three changed workflows pass (`trc_40348f8d02d5`).
- Workflow policy: exact three changed workflows, zero findings (`trc_3ce4eb6d07d5`).
- Prettier: all task-owned non-metadata files pass (`trc_a9557f16da14`).
- `git diff --check`: pass (`trc_de7d1735c92f`).
- Pinned provider CLI contracts verified for Railway CLI 5.27.2 and project-local Wrangler rollback (`trc_7e5b6f77c8fc`).
- Strict review: 0 owned issues, 0 blockers (`trc_cf43180c0b4f`).
- Canonical verify: passed, `publishValid: true`, DB risk scan clean (`trc_837b77c769dc`).
- Exact-head GitHub CI on `9633f27a1492f270d9196a111afd3980310e5f4d` exposed one clean-run prerequisite gap: `Consuelo / dialer` failed only in `Typecheck dialer release packages` because `@consuelo/logger` exports `dist` and had not been built on the fresh runner (`trc_3abf7ba80441`).
- RED follow-up: release workflow contract failed on missing logger prerequisite/classification/watch patterns and missing Docker image proof (`trc_00dba4c9efce`, `trc_4e716c538afa`).
- GREEN follow-up: logger -> three typechecks -> dialer -> LeadConnector -> dialer-server build sequence passes (`trc_33ecd21658d4`); clean-build workflow/Docker contract passes 4/4 (`trc_2862979f0012`).
- PR gate now builds the exact Railway Dockerfile on GitHub runners; local Docker proof is unavailable because Docker is not installed on this Mac (`trc_091f2291a0aa`).
- `packages/logger/**` now triggers dialer PR CI, main production release, and Railway watch patterns because logger is compiled into the dialer runtime.
- Final clean-build contract: 4/4 pass, including logger classification, dependency-order Dockerfile, production path classification, and explicit rollback (`trc_3c801cedafbb`).
- Final workflow YAML + formatting + `git diff --check`: pass (`trc_3c801cedafbb`).
- Final workflow policy on the exact three changed workflows: zero findings (`trc_2f3640ce7061`).
- GitHub PR gate now builds `packages/dialer-server/Dockerfile` directly, so the next exact-head CI run—not this Mac, which has no Docker binary—is the authoritative clean Linux container proof.
- 2026-08-11 21:55:29 `review.run`: passed — OK
- 2026-08-11 21:56:30 `review.run`: passed — OK
- 2026-08-11 21:57:58 `review.run`: passed — OK
- 2026-08-11 21:58:24 `verify`: passed — OK
- 2026-08-11 21:59:02 `verify`: passed — OK
- 2026-08-11 22:16:05 `review.run`: passed — OK
- 2026-08-11 22:16:15 `review.run`: passed — OK
- 2026-08-11 22:16:32 `verify`: passed — OK

## key decisions

- Extend the existing Consuelo CI/release architecture; do not build a parallel deploy platform.
- Keep runtime application secrets in Railway; GitHub receives deployment-only credentials.
- Official HighLevel Custom Menu API is allowed; Marketplace browser/developer-session credentials are not.
- Normal main merge is the release approval; no second manual approval is designed into workflow code.
- Production GitHub Environment settings/secrets are intentionally not mutated by this task; that durable settings step needs explicit approval after the code is merged.
- Runtime application secrets remain in Railway; GitHub Actions only receives deployment credentials and non-secret target identifiers.

## Test-first contract

- Behavior: complete dialer PR gate; main-only ordered release; exact-ID GHL read-back; non-mutating smoke; secret-free manifest/bootstrap.
- Existing patterns: Consuelo changed-file CI, protected production environment, LeadConnector custom-menu adapter/tests, package Bun tests/builds.
- New tests: workflow release contract; production-menu + stable-loader tests; dialer-server smoke/manifest tests.
- Red command: preflight target test files for destructive literals, then run only those focused tests.
- Expected red: current CI ignores dialer-server/LeadConnector; no dialer release/rollback lane; menu is sandbox-upsert only; no loader/smoke/manifest contract.

## notes for ko

- After merge, create/configure GitHub Environment `consuelo dialer / production` with the documented deployment-only values and restrict deployments to `main`.
- The stable Marketplace loader is generated but is not installed automatically. Prove its real HighLevel CSP/runtime behavior in the sandbox, then perform the one-time Marketplace source swap manually if green.

## improvements noticed

- `stream.sync` repeatedly lost MCP transport without changing the remote branch. Recovery used the authenticated GitHub merge API to perform the same non-force `main -> stream/dialer` merge, then verified `behindBy: 0`.
- `fs.write` exposes a schema that rejects `force` while the underlying writer requires force for overwrites; workpad overwrite used task-scoped runtime as the narrow fallback.
- The current `wait --pr` helper requests a removed GitHub CLI JSON field (`conclusion`); CI monitoring used the typed GitHub checks surface instead.

## issues and recovery

- OS/MCP transport intermittently returned network errors for read/verify calls. No deploy/provider mutation was retried blindly; state was checked before retries.
- Initial task start was sourced from `main` while PR base was `stream/dialer`. The task was validated with the stream merged locally, then `stream/dialer` was synced to `main` and merged into the task so the PR base is now a true ancestor without force-push/reset.
- First pushed release head `9633f27a1492f270d9196a111afd3980310e5f4d` was correctly blocked by the new dialer CI gate on clean-run `@consuelo/logger` resolution. The fix builds logger before typecheck, builds all workspace runtime packages in dependency order, and makes the PR gate build the production Dockerfile.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Discovery
- Goal: automate dialer release on main through existing Consuelo CI/release architecture.
- Approval: implement PR gates, Railway -> Cloudflare -> GHL menu release, post-deploy verification, release manifest, rollback workflow, and credential isolation.
- Marketplace inline module update: do not automate unsupported browser/session credentials; test stable external-loader feasibility separately.

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/scripts/validate-local-runtime.ts`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/release/production-release.test.ts`
- `packages/dialer-server/src/routes/commercial.ts`
- `packages/dialer-server/src/routes/health.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/dialer-server/src/routes/twilio.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/dialer/package.json`
- `packages/dialer/tsconfig.json`
- `packages/lead-connector/EMBED.md`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/src/deployment/commercial-artifacts.test.ts`
- `packages/lead-connector/src/deployment/custom-menu.test.ts`
- `packages/lead-connector/src/deployment/custom-menu.ts`
- `packages/lead-connector/src/deployment/marketplace-bootstrap.test.ts`
- `packages/lead-connector/src/deployment/production-menu.test.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- `packages/lead-connector/tsconfig.json`
- `packages/lead-connector/wrangler.jsonc`
- `packages/logger/package.json`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/scripts/stream-sync.js`

- 2026-08-11 22:14:35 apply-patch: `.task/dialer/automate-dialer-production-release/workpad.md`

- 2026-08-11 22:15:41 apply-patch: `.task/dialer/automate-dialer-production-release/workpad.md`
