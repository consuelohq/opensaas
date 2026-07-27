# Consuelo OS Worker Prompt Index

Status: final architecture baseline. Worker 01 is complete and the section 11.1 environment registry is populated and validated. The existing OS subagent wrapper plus Worker 27's committed review procedure satisfy the review prerequisite, so Wave 0 is dispatchable after this plan PR reaches `main`.

Every worker must bootstrap through Consuelo OS, read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` and its assigned brief in full, and use the task-scoped OS workflow. No silent fallback to the old workspace connector or another computer is allowed.

## Release model

Open PRs run checks only. Merging to `main` computes the version-neutral OS release fingerprint. An unchanged fingerprint is a no-op; a changed fingerprint automatically receives one SemVer, one immutable tag, one GitHub Release, one runtime-bundle set, one GitHub Deployment record, and one signed dev channel update. Signed manifests, immutable tags, Deployments, and Releases are authoritative. Protected permanent `canary`, `beta`, and `stable` branches are secondary automation-controlled promotion refs. Promotion reuses the exact version and runtime-bundle bytes without rebuilding.

The Mac Mini tracks dev. The MacBook Air is the real-machine canary/beta acceptance node. Ko runs every install, update, reset, restart, and uninstall command on both machines; workers stop at a human checkpoint.

## Dependency waves

The environment registry now contains exact OCI, macOS, Windows, Linux, Cloudflare-fixture, and runtime-bundle-fixture coordinates. Worker 01 owns that completed setup. Every later worker must use those registered lanes and the existing review procedure.

### Integrated review and execution safety

- `27-grok-review-pipeline.md` documents the mandatory Grok 4.5 GitHub review procedure used by every later task.
- Do not dispatch Worker 27. The review procedure is already available through `packages/os/scripts/subagent.ts` and is executed inside each implementation task.

### Wave 0: contracts, clean-host tests, and architecture boundaries

- `01-distribution-test-harness.md` is complete and is not dispatched again.
- `02-runtime-bundle-builder.md`
- `13-web-auth-contract.md` may begin in read/test-first mode.
- `18-native-platform-spike.md` may run as a bounded research/prototype task.
- `26-tool-package-layout.md` defines canonical tool/manifest ownership.
- `28-repository-product-boundary-audit.md` is read-only planning and may run without blocking launch work.

Wave 0 establishes a mandatory OCI clean-host lane in CI plus macOS and Windows runner contracts. Local Docker is not required on Ko's Mac.

Wave 0 tasks may run concurrently because their implementation ownership is disjoint. Worker 02 owns the runtime-bundle contract; Worker 26 owns tool packages and generated manifests. Neither edits shared/root package-script wiring in parallel. Worker 24 performs that final integration after both land.

### Wave 1: distribution and node core

- `03-release-channels.md` depends on 01 and 02, with the integrated review procedure applied to its PR.
- `04-lifecycle-engine.md` depends on 01 and 02, with the integrated review procedure applied to its PR.
- `05-retention-rollback-uninstall.md` depends on 04.
- `06-managed-components.md` depends on 02 and 04's lifecycle contract.
- `25-multi-node-registry-routing.md` depends on 13 and the existing device-authority tests.
- `07-steering-runtime-context.md` depends on 06's update-plan summary contract and 25's safe node-summary contract.
- `08-provider-core.md` depends on 26.

### Wave 2: provider adapters and web implementation

- `09-railway-provider.md` depends on 08.
- `10-vercel-provider.md` depends on 08.
- `11-cloudflare-provider.md` depends on 08.
- `12-provider-integration.md` depends on 09, 10, and 11.
- `14-universal-login.md` depends on 13 and 25.
- `15-launcher-gtm-routing.md` depends on 13 and 14.
- `16-traces-hono.md` depends on the authenticated workspace contract from 13.
- `17-web-security-e2e.md` depends on 14, 15, 16, and 25.

### Wave 3: distribution integration

- `30-cli-product-split.md` depends on 04 and the product-boundary findings from 28.
- `24-distribution-integration.md` depends on 01-07, 25-26, and 30. It proves clean install, update without onboarding, restart, rollback, component migration, node continuity, and steering before native shells consume the lifecycle.

### Wave 4: native and platform delivery

- `19-macos-app-service.md` depends on 04, 05, 18, 24, and 25.
- `20-linux-platform.md` depends on 04 and 05.
- `21-windows-platform.md` depends on 04 and 05.
- `22-cross-platform-release.md` depends on 03, 19, 20, and 21.

### Downstream repository architecture

- `28-repository-product-boundary-audit.md` produces the evidence-backed monorepo-versus-extraction decision, branding/license inventory, Twenty cleanup map, and Yarn-to-Bun feasibility plan.
- `29-os-repository-scaffold.md` is gated on Ko approving Worker 28's decision and Worker 24 proving the runtime-bundle boundary. Do not dispatch it automatically.

### Final audit

- `independent-review-framework.md` is the direct review-quality contract executed entirely by each assigned Worker 23 agent; no model, wrapper, subagent, or delegated reviewer is invoked.
- `23-final-integration-audit.md` orchestrates the final review only after launch implementation prompts 01-26 and 30 are integrated. Prior implementation-review history is evidence, but Worker 23 does not invoke Worker 27, Grok, another model, or a delegated review agent. It verifies Worker 28's planning deliverable and includes Worker 29 only when extraction was separately approved.
- `23a-core-runtime-lifecycle-recovery-audit.md` reviews lifecycle, recovery, managed components, and steering.
- `23b-provider-control-plane-audit.md` reviews Railway, Vercel, Cloudflare, approvals, and customer/operator separation.
- `23c-web-auth-launcher-traces-security-audit.md` reviews universal login, workspace sessions, launcher, `/gtm`, traces, and web security.
- `23d-native-platform-local-control-audit.md` reviews macOS, Linux, Windows, local IPC, services, and native packaging.
- `23e-distribution-release-ci-audit.md` reviews runtime bundles, versions, publication, promotion, artifact integrity, and CI.
- `23f-multi-node-registry-routing-audit.md` reviews node identity, signed presence, defaults, routing, offline state, and revocation.
- `23g-repository-boundaries-operability-docs-audit.md` reviews source/package authority, CLI separation, runtime closure, legal scope, operability, and docs.
- `23h-cross-wave-final-go-no-go.md` is a fresh independent synthesis after accepted repairs and issues the final `GO` or `NO-GO`.

Worker 23 creates one review-only GitHub comparison PR spanning the verified pre-foundation baseline to the frozen final candidate. All domain and synthesis agents review the same PR themselves, post every finding and disposition directly to GitHub, and never merge that review-only PR. Historical review instructions inside original worker prompts are intent evidence only and are not executed by the final-audit agents.

## Stream ownership

- Prompts 01-07, 24, 26, and 30: `stream/os-distribution`
- Prompt 27 is a cross-stream review procedure, not a separately dispatched task.
- Prompts 08-12: `stream/os-provider-tools`
- Prompts 13-17 and 25: `stream/os-web`
- Prompts 18-22: `stream/os-native`
- Prompts 28-29: `stream/repository-architecture`
- Prompt 23: independent audit task based on the final integration candidate

## Orchestration rules

- Do not dispatch dependent prompts before their prerequisite PRs are merged into the relevant stream.
- Parallel workers must have disjoint write ownership.
- Central manifests, package scripts, and shared workflow files belong to the named integration prompt, not individual adapters.
- A worker finding a cross-stream problem documents it and stops at its boundary instead of editing another stream.
- If an assigned environment, OS route, task session, model, credential, or test lane is broken, unavailable, or mismatched, stop and fix or realign it before implementation continues. Do not bypass the environment or silently fall back to another machine/provider.
- Every task PR remains independently reviewable and carries focused tests.
- Every task closes with CodeRabbit disposition and the Grok 4.5 review posted to GitHub as inline comments plus one top-level PR comment. GitHub is the durable source of truth; temporary prompt/output files are removed after posting.
- The Grok prompt includes the master plan, task brief, exact diff, existing comments, validation/CI summary, task context, and relevant repo patterns.
- After GitHub contains the complete report, the implementation worker returns a concise chat summary with the PR URL and stream, exact changes, validation/review dispositions, contribution to the larger plan, and remaining follow-ups. Implementation workers never respond with only `done`; that exception is reserved for a standalone Grok review task whose structured review is already on GitHub.
- Worker agents do not mutate OS on Ko's real Macs. Ko performs the human-checkpoint command, then the worker may resume read-only validation.
- A powered-off MacBook Air is an expected offline-node state, not evidence that provisioning or routing is broken.
