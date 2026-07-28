# Worker 23E — Distribution / Release / CI Audit

Date: 2026-07-28
Reviewer: Worker 23E (direct audit)
Candidate: PR #1674, commit ef2530b136ec2a170915b583abfb2341899bd6ab
Candidate URL: https://github.com/consuelohq/opensaas/pull/1674
Audit brief: packages/os/plans/consuelo-os-foundation/workers/23e-distribution-release-ci-audit.md
Task branch: task/os-foundation-two/23e-distribution-release-ci-audit
Task PR: https://github.com/consuelohq/opensaas/pull/1708
Exact taskSession: tsk_49f5341977f4

## Verdict

DOMAIN CONDITIONAL

The immutable candidate has two unresolved P1 findings that block a clear release/distribution approval:

- 23E-R01-001: the durable allocation record is written after the first immutable external mutation, so a retry after tag creation but before the R2 state commit can allocate a second SemVer for the same source commit and release fingerprint.
- 23E-R01-002: the credentialed publication job does not depend on the distribution/native/clean-host matrix, and the active GitHub main ruleset has no required status-check contexts. A main push can therefore publish without the required distribution gate.

Two P2 findings also remain:

- 23E-R01-003: GitHub Deployment records contain only source ref, environment, bundleId, and empty required contexts, so the remote Deployment object cannot independently prove the version/fingerprint/digest identity required by the plan.
- 23E-R01-004: contents: write and deployments: write are granted at workflow scope to plan/build jobs as well as the mutation job.

No product code and no shared finding ledger were modified. This report is the only task artifact.

## Candidate identity and review boundary

The review uses the exact immutable candidate selected by Worker 23. PR #1674 is merged, with head SHA ef2530b136ec2a170915b583abfb2341899bd6ab. The current main branch is 13 commits ahead of that SHA and has no additional candidate-tree diff to review; it is not substituted for the candidate. The authorized fallback in the brief is therefore used exactly as specified.

The retained PR diff does not contain every release implementation file. Findings against files outside that retained diff are posted as precise top-level PR comments with path and line references rather than fabricated inline comments. Existing GitHub review threads were read before these posts. The prior coordinate/freeze blocker concerning the absence of synthetic audit branches and the fallback candidate is treated as stale/superseded because this brief explicitly authorizes PR #1674/SHA as the immutable fallback.

## Source set and intent-lineage table

The implementation was judged only after reading the master plan, environment registry, Worker 23 audit, independent-review framework, this audit brief, and every original prompt named by the brief. The following table is the complete intent lineage requested by the brief.

| Original worker prompt | Exact requirement/section | Authoritative domain | Secondary seam reviewers | Implementation and repair PRs | Current implementation location | Automated evidence | Runtime/live evidence | Status | Remediation |
|---|---|---|---|---|---|---|---|---|---|
| 01-distribution-test-harness.md | Distribution test harness; clean OCI host, native matrix, failure injection, disposable homes, regression commands | CI/test harness and environment contracts | 02, 22, 24, 30 | #1548 distribution harness; #1550 cleanup hardening; #1663 integration; #1665 rehearsal; #1629 disposition repair; #1670 sync | .github/workflows/consuelo-os-distribution-environments.yaml; packages/os/tests/distribution; packages/os/tests/lifecycle-engine.test.ts | Workflow-contract and lifecycle tests; exact candidate OS contracts check green; distribution workflow check absent from exact candidate runs | Registry says Mac Mini/MacBook Air are Ko-owned checkpoints; dedicated least-privilege Cloudflare test token is absent, so live lane was not run | Conditional: automated harness exists; publication dependency is unresolved in 23E-R01-002 | Make the matrix a required dependency of publication and configure required GitHub contexts |
| 02-runtime-bundle-builder.md | Build one runtime bundle per platform; complete dependency closure; deterministic archive and manifest; signatures and digests | Runtime bundle/artifact integrity | 01, 22, 24, 26 | #1556 runtime bundle builder; #1574 verification repair; #1632/#1633 cross-platform parity/determinism; #1663 integration | packages/os/scripts/lib/distribution/runtime-bundle.ts; runtime publish workflow; publication preparer | runtime-bundle, publication-preparer, workflow tests pass; lifecycle tests verify archive/manifest identity and digest handling | No clean-host download/install or R2 parity run against live release objects | Conditional: code/test evidence passes; live parity unavailable | Preserve build-once identity while adding failure-injection coverage around publication allocation |
| 03-release-channels.md | SemVer allocation, dev/canary/beta/stable pointers, immutable tags/Releases, R2 state, Deployments, approval, promotion, rollback, credential separation | Release authority and channel state | 01, 02, 22, 24, 26, 30 | #1579 release channels; #1630 credential separation; #1631 repair; #1634 pinned Wrangler; #1638/#1636 required-context repairs; #1603 retention/rollback; #1663 integration; #1629 dispositions | packages/os/scripts/lib/distribution/release-channels.ts; release-channel-provider.ts; .github/workflows/consuelo-os-runtime-publish.yaml; runtime-promote.yaml; runtime-rollback.yaml | release-channels and provider-retries tests pass; provider checks committed-object idempotency and digest mismatch; workflow tests assert main-only publication and production environment | No live R2/Release/Deployment mutation or cross-authority parity check; registry blocks live lane pending test credentials | Conditional: committed-state retry and promotion logic pass; interrupted allocation is P1 and remote identity is P2 | Reserve allocation durably before external mutation or recover by immutable metadata; bind Deployment records to full signed identity |
| 22-cross-platform-release.md | Linux/macOS/Windows platform closure; one fingerprint and bundle set across platforms; no platform-specific drift | Cross-platform release | 01, 02, 03, 24, 26 | #1632/#1633 cross-platform release and fingerprint repair; #1665 matrix rehearsal; #1663 integration | runtime-publish matrix and runtime-bundle/fingerprint code | Three-platform build matrix is present; workflow-contract tests pass; exact candidate checks include OS contracts | No real Windows host or Ko-owned Mac checkpoint; distribution workflow did not appear in exact candidate checks | Conditional: matrix and deterministic code present; gate absent | Gate publication on the same exact-commit platform evidence |
| 24-distribution-integration.md | End-to-end build, publication, install, update, health, rollback, and integration contracts | Distribution integration | 01, 02, 03, 22, 26, 30 | #1663 distribution integration; #1665 rehearsal; #1629 final dispositions; #1670 sync | packages/os/tests/distribution; lifecycle-engine; installer and CLI runtime paths | 7 distribution/workflow files and 109 tests pass in the task worktree; lifecycle-engine coverage passes in the focused run | Clean host, N-1 update, health-failure rollback, R2 parity, and live Deployments unavailable by registry policy | Conditional: simulated evidence is strong; live acceptance remains unverified | Run the dedicated live lane after least-privilege credentials exist |
| 26-tool-package-layout.md | Canonical package layout, generated manifests, package-manager portability, installer inputs and runtime closure | Package/artifact layout | 01, 02, 24, 30 | #1561 canonical tool packages/manifests; #1663 integration; #1670 sync | packages/os/packages; runtime manifest/materializer; installer inputs | Lifecycle materializer runs Bun install with frozen lockfile and production dependencies; lifecycle tests cover dependency materialization | Clean-host package-manager portability and installer execution on fresh machines unavailable | Conditional: code closes runtime dependencies; some installer fixture scripts are absent in current task worktree | Restore/validate fixture inputs in CI and run fresh-host matrix |
| 30-cli-product-split.md | Consuelo OS CLI/runtime separated from consuelo-dialer; installer and command closure | CLI/runtime ownership | 01, 02, 24, 26 | #1647 CLI product split; #1663 integration; #1670 sync | packages/os CLI and installer/runtime paths | CLI/workflow tests and lifecycle engine pass; no product-code edit made by this audit | Fresh-host CLI invocation and N-1 update unavailable | Conditional: structural split covered by code/tests; live closure unverified | Include clean-host CLI/runtime smoke in the required distribution gate |

## Review evidence

### Candidate CI and repository policy

The exact candidate has 48 check runs. The green checks include Consuelo verify, dialer, workspace contracts, OS contracts, workflow security, and Sites Gateway + Cloudflare. Workers Builds: opensaas failed, and the congratulate job was cancelled. No check named Consuelo OS / clean OCI host or the standard distribution-environments workflow appears on the exact candidate check-run list.

The publication workflow is triggered by a push to main with paths covering packages/os, the runtime-publish workflow, bun.lock, and package.json. It grants contents: write and deployments: write at top level, plans the release, builds the three platform archives, and publishes after only plan/build. The distribution-environments workflow is a separate push/PR workflow with native/OCI/regression jobs; it is not a dependency of publication. Its path filters do not cover release-channel implementation or the runtime-publish workflow.

GitHub repository evidence read through the workspace GitHub facade:

- Classic main branch protection returned no required status checks, review requirement, or restriction configuration.
- Active main ruleset id 13478389 has deletion protection only and no required status-check rule.
- The channel branches canary, beta, and stable do not yet exist.
- The environment registry states promotion environments are credential-free and production holds Cloudflare release credentials. It also states the live integration lane is blocked until a dedicated least-privilege Cloudflare test token exists.

These facts are evidence for the CI gate and live-evidence limitations; no live resource mutation was attempted.

### Focused verification

The task worktree is based on current main and is not substituted for the immutable candidate. The focused distribution/workflow/lifecycle run passed:

- 7 test files
- 109 tests
- exit code 0
- runtime-bundle, release-channels, release-channel-provider-retries, publication-preparer, release-channel-workflows, channels-cli, workflow-contract, lifecycle-engine, and lifecycle-retention-uninstall coverage

A broader current-main selection also included installer-runtime-dependencies and returned 17 failures because the task worktree lacks scripts/install-system-daemons.sh and scripts/uninstall-system-daemons.sh, which those tests invoke. This is recorded as a current-worktree fixture/evidence failure, not promoted to a candidate finding without evidence that the exact immutable tree has the same absence.

Review gate result: unavailable after two workspace-facade HTTP 504 transport timeouts. The retry did not return a review envelope, so no pass is inferred.

## Findings

### 23E-R01-001 — P1 — version allocation is not retry-idempotent after partial publication

- Domain/seam: release authority / allocation and publication retry
- Location: packages/os/scripts/lib/distribution/release-channels.ts:488-496; provider mutation ordering at release-channel-provider.ts:786-793 and 914-918
- Category: Reliability / Data Integrity
- Merge-blocking: yes
- Disposition: open; no Ko waiver
- Risk: a process interruption after creation of the immutable GitHub tag but before the R2 release-state write can allocate a second SemVer and create a second release identity for the same source commit and release fingerprint.
- Why: planDevPublication reuses a version only when state.allocations contains allocationKey(sourceCommit, fingerprint). The provider creates the immutable tag first, then releases/assets/R2/deployment/manifest, and writes R2 state last. On a crash between the tag mutation and the state commit, the retry restores state without the allocation and allocates from the current immutable tags. The already-created tag is then part of the next-version calculation, so the same source/fingerprint receives a new version/tag/bundle identity. Workflow concurrency and expected revision protect the durable state but do not reserve the missing allocation.
- Evidence: release-channels.test.ts covers reuse after the allocation is already committed; release-channel-provider-retries.test.ts covers exact retry after committed provider objects/state and remote revision checks. Neither injects failure after the first immutable tag and before the allocation/state commit.
- Adversarial journey: interrupted publication, then retry. The first attempt can leave the immutable tag without durable allocation; the second attempt is not guaranteed to reuse the first version.
- Recommendation: create a durable allocation reservation before any external mutation, or make retry recovery query immutable tag/Release metadata keyed by sourceCommit and releaseFingerprint and adopt the already reserved version. Add failure injection at each publication operation and assert exactly one version, tag, Release, asset set, R2 set, Deployment, and channel manifest after every retry.
- Validation required: concurrent retry and interruption tests against a fresh state store and provider fixture, including failure immediately after tag creation and after each subsequent mutation.

### 23E-R01-002 — P1 — credentialed publication is not gated on the required distribution matrix

- Domain/seam: CI gate / publication mutation ordering
- Location: .github/workflows/consuelo-os-runtime-publish.yaml:164-171; .github/workflows/consuelo-os-distribution-environments.yaml:27-50 and 57 onward; repository ruleset main id 13478389
- Category: CI / Release Integrity
- Merge-blocking: yes
- Disposition: open; no Ko waiver
- Risk: a main push can enter a credentialed build-once/release-once publication even when clean OCI, native Linux/macOS/Windows, Debian, or regression checks are absent or failing.
- Why: publish needs only plan and build. The distribution-environments workflow runs independently and has no needs edge into publish. Its path filters omit release-channel implementation and runtime-publish changes, so a release-path change may not exercise the matrix at all. The publish step's tests=consuelo-os-distribution-environments string is evidence text, not a dependency or required check. The exact candidate check runs contain no distribution-environments or clean-OCI check. Repository policy independently confirms classic main protection has no required checks and the active main ruleset contains only deletion protection.
- Evidence: exact candidate check-run list; workflow source; raw GitHub branch protection and ruleset response. workflow-contract.test.ts asserts matrix shape but not that publication needs the matrix; release-channel-workflows.test.ts asserts publish shape but not the external gate.
- Adversarial journey: docs-only/path-filter changes and release-workflow changes. A change can skip the distribution workflow while the credentialed main-push publisher remains eligible. The same gap applies when a required matrix job fails unless repository settings independently block the merge; current settings do not establish that.
- Recommendation: expose the required matrix as a reusable workflow or same-workflow gate for the exact commit, make publish needs that gate, correct path filters to cover every release implementation and workflow input, and configure the active main ruleset with the resulting required check contexts. Extend workflow tests to assert the dependency and required-context contract.
- Validation required: a failing matrix prevents any mutation; a docs-only change produces no release; a release-workflow change invokes the gate; exact commit status contexts are required before merge/publish.

### 23E-R01-003 — P2 — Deployment records do not carry full release identity

- Domain/seam: GitHub Deployments / authority parity / approval evidence
- Location: packages/os/scripts/lib/distribution/release-channel-provider.ts:468-486
- Category: Data Integrity / Observability
- Merge-blocking: no, but requires fix or explicit Ko waiver
- Disposition: open; no Ko waiver
- Risk: a GitHub Deployment object can claim a bundle was deployed without independently binding the Deployment to the version, release fingerprint, platform bundle set, archive digests, or required gate evidence.
- Why: createDeployment posts ref and environment with auto_merge false, an empty required_contexts array, and payload containing only bundleId. Existing-deployment matching also compares only bundleId, environment, and ref. The signed R2 state records more identity, but the Deployment authority requested by the plan cannot independently prove that identity or that required contexts were satisfied.
- Evidence: provider source and the plan's signed-manifest/authority requirements. The provider retry tests verify idempotency and digest checks for provider objects but do not assert a complete Deployment identity payload or non-empty required contexts.
- Recommendation: include signed release identity, version, source commit, release fingerprint, bundle set, and archive digests in the Deployment payload; match all fields on retry; bind required contexts to the exact release gate or explicitly make signed R2 state the sole authority while retaining a verifiable Deployment evidence link. Add mismatch/tamper tests.
- Validation required: inspect the remote Deployment payload and assert that source/version/fingerprint/digest identity is immutable and matches the signed channel manifest.

### 23E-R01-004 — P2 — plan/build jobs inherit mutation-capable GitHub permissions

- Domain/seam: CI security / credential separation
- Location: .github/workflows/consuelo-os-runtime-publish.yaml:13-15
- Category: Security
- Merge-blocking: no, but requires fix or explicit Ko waiver
- Disposition: open; no Ko waiver
- Risk: plan and build execute package installation and build code while inheriting contents: write and deployments: write. A compromised dependency or build script can attempt tag, Release, or Deployment mutation before the intended publish job.
- Why: permissions are workflow-wide rather than scoped to the publication mutation job. The environment protection for the publish job narrows production credentials, but it does not remove write-scoped GITHUB_TOKEN authority from earlier jobs.
- Evidence: exact candidate workflow permissions and job graph. The workflow tests check write permission presence but do not require job-local least privilege.
- Recommendation: set workflow/default permissions to read-only and grant contents/deployments write only on the mutation job and mutation step; keep plan/build and approval jobs read-only. Add a workflow-contract assertion that build jobs have no mutation permissions.
- Validation required: inspect generated job permissions and prove package/build steps cannot create tags, Releases, or Deployments.

## Adversarial journey results

| Journey | Result |
|---|---|
| Concurrent retries | Committed-state retry, optimistic revision, provider object digest checks, and exact committed retry are covered and pass. First-tag-before-state failure is not covered and fails the one-version guarantee: 23E-R01-001. |
| Docs-only changes | Fingerprint/classification code excludes non-runtime docs/test changes and publication remains no-op when the fingerprint is unchanged. The repository-level required-gate behavior is not established; path-filter/publish coupling remains part of 23E-R01-002. |
| Tampered artifacts | Lifecycle release download verifies archive digest, manifest identity, signature, platform, architecture, version, and fingerprint; lifecycle tests cover archive/signature tamper and inventory corruption. Live R2/GitHub parity was unavailable. |
| No-rebuild promotion | Promotion consumes signed source state and updates protected pointers/Release/Deployment/manifest without invoking the build matrix. Transition and stable-approval checks are present and focused tests pass. |
| Interrupted publication/promotion | Provider operations are ordered for idempotent recovery and R2 state is written last, but allocation is not durable before the first tag mutation. Promotion retries are guarded by signed current state and consensus; live remote recovery was not exercised. |
| Missing runtime artifacts | Runtime bundle collection requires the platform archives/manifest/signature/digests and the build matrix includes macOS arm64, Linux x64, and Windows x64. Exact candidate had no distribution workflow check, so publication gate evidence is incomplete. |
| Clean-host installation | Lifecycle-engine tests cover disposable install, update, lock, download interruption, health failure, rollback, dependency materialization, migrations, and no-onboarding paths. The registry prohibits live Mac/Windows/OCI execution without the dedicated test credential; broader local installer tests fail because the referenced daemon scripts are absent from the current task worktree. N-1 and real-host evidence remain unavailable. |

## Positive coverage confirmed

- Build-once structure exists: one plan, one three-platform build matrix, artifact download/merge, and one publish mutation path.
- Deterministic fingerprints and canonical release-set IDs include sorted platform/architecture/digest/bundle identity.
- Immutable tag/Release/asset/R2 provider mutations reject conflicting existing digests and support exact committed-state retries.
- Signed manifests, archive digests, manifest identity, and lifecycle staging checks are implemented and covered by focused tests.
- Promotion and rollback do not rebuild; they consume signed state, enforce channel transitions/approval, and update protected pointers and channel manifests.
- Environment separation is structurally present: channel approval environments are credential-free and mutation uses the protected production environment.
- Runtime closure is implemented by staging the bundle and running Bun frozen-lockfile production dependency materialization before service preflight.
- The Consuelo OS CLI and dialer product split has distinct package/runtime ownership in the candidate tree.
- Focused automated evidence for the distribution and release seams is green at 109/109 tests.

## Evidence limits and dispositions

Unavailable evidence is not represented as a fabricated pass:

- No live R2 parity comparison, live GitHub Release/tag/asset mutation, or live Deployment inspection was run.
- No fresh-host Linux/OCI, Windows, Mac Mini, or MacBook Air install/update/rollback was run.
- No N-1 update or real health-failure rollback was run on a live host.
- The environment registry says the live integration lane is blocked pending a dedicated least-privilege Cloudflare test token and that Ko controls physical checkpoint machines. The exact failure/absence is recorded here; no fallback environment was substituted.
- GitHub check evidence is limited to the exact candidate's observed runs; missing distribution check contexts are part of 23E-R01-002.
- The independent Grok review result is unavailable because its request returned HTTP 402; no Grok conclusion is claimed.

Existing thread dispositions reviewed before posting:

- The earlier candidate-freeze/coordinate blocker on PR #1674 is stale/superseded by the explicit authorized fallback in the 23E brief.
- Prior Worker 23/23B lineage, round, and report-integrity threads resolved in the current wave are treated as fixed/current and are not duplicated here.
- No existing open thread was found that makes 23E-R01-001 through 004 redundant.
- Current 23E dispositions are open for all four findings; none is fixed, stale, or waived by Ko.

## Required fix prompt

The agent-fix prompt posted on PR #1674 requires:

1. Reserve or recover the sourceCommit + releaseFingerprint allocation before/through the first immutable provider mutation. Inject failures after every publication operation and assert one version/tag/Release/asset/R2/Deployment/manifest identity after concurrent retries.
2. Make the required distribution/native/OCI/regression matrix a hard dependency of credentialed publication for the exact commit. Repair path filters and main required contexts, and add workflow-contract tests for needs and failure blocking.
3. Bind GitHub Deployments to signed version/fingerprint/source/bundle/digest identity and enforce identity on retry; bind required contexts or make the signed authority model explicit and test it.
4. Scope write permissions to the mutation job/step; build and plan jobs must not receive contents/deployments write.
5. Re-run the focused suites, review and verify gates, and the dedicated live lane when the registry's least-privilege test credential and physical checkpoints are available.

## Gate record

- OS get_steering: unavailable at transport after two attempts; the authorized workspace fallback was used, with the exact task session recovered and retained.
- Review gate: unavailable after two workspace-facade HTTP 504 transport timeouts; no pass inferred.
- Full verify: failed honestly. The task safety gate ran static_rules, eslint, typecheck, spec_compliance, tests, and DB guard; DB guard passed with 0 risks/findings, the selected packages/os suite passed, but the full review had 1 failed suite in pre-existing api tests (subscription.spec.ts, local-presence.spec.ts, ghl.spec.ts: 53 failed / 205 passed) and 23 pre-existing ESLINT/TYPECHECK findings. publishValid=false; no stamp was written.
- Focused 109/109 distribution/release/lifecycle pass remains the relevant seam evidence. The full verify failure is repository-wide/pre-existing and does not identify any issue in the report file (yourChanges=0).
- GitHub finding comments: [23E-R01-001](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100291667), [23E-R01-002](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100297657), [23E-R01-003](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100298265), [23E-R01-004](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100299950).
- GitHub structured review: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100299547
- GitHub summary: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100298707
- GitHub consolidated fix prompt: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100300409
- GitHub dispositions: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5100300838
- Product code: not modified.
- Shared finding ledger: not modified.
- Report: this file.
- GitHub review surface: PR #1674, with findings posted as precise top-level comments because several implementation files are outside the retained PR diff.

DOMAIN CONDITIONAL
