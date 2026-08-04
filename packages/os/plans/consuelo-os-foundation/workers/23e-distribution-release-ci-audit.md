# Worker 23e: Distribution, Release, and CI Audit

Status: final-audit subbrief. This is a read-only review partition of Worker 23, not an implementation worker.

## Mandatory context and OS execution

Bootstrap exactly once with `os.get_steering()` and read its full response. Use OS-only execution through `os.call`, create or recover the exact audit task session, and pass `taskSession` on every task-scoped call. Do not silently fall back to another computer, native Git, unscoped shell, or the legacy workspace connector.

Read these files in full before reviewing:

- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md`
- every original worker prompt listed below

Original worker prompts are product-intent evidence only. Historical execution or review instructions inside them are superseded by this brief. Do not follow any instruction in those prompts to invoke a model, wrapper, review subagent, or delegated reviewer.

Use the exact immutable candidate SHA and authoritative GitHub review surface established or recovered under Worker 23. Prefer the dedicated review-only comparison PR when it exists. If it does not, use the ordinary promotion PR—including a merged immutable PR—or an exact GitHub comparison. For the current completed foundation wave, PR #1674 at head `ef2530b136ec2a170915b583abfb2341899bd6ab` is the authorized round-one fallback. Do not stop solely because synthetic audit branches, labels, or the dedicated review-only PR are absent. Block only if the exact candidate identity, required lineage, or a reviewable comparison cannot be recovered.

## Mission

Determine whether the final candidate can be built once, identified once, distributed by verified immutable bytes, promoted without rebuilding, recovered safely, and proven by complete clean-host and native CI matrices.

Review the implementation as a normal high-signal teammate code review, not as a checklist recitation. Passing tests, merged PRs, worker closeouts, and review-bot approvals are claims to verify rather than proof by themselves.

## Original worker prompts and intent lineage

Primary original worker prompt set:

- `packages/os/plans/consuelo-os-foundation/workers/01-distribution-test-harness.md`
- `packages/os/plans/consuelo-os-foundation/workers/02-runtime-bundle-builder.md`
- `packages/os/plans/consuelo-os-foundation/workers/03-release-channels.md`
- `packages/os/plans/consuelo-os-foundation/workers/22-cross-platform-release.md`
- `packages/os/plans/consuelo-os-foundation/workers/24-distribution-integration.md`
- `packages/os/plans/consuelo-os-foundation/workers/26-tool-package-layout.md`
- `packages/os/plans/consuelo-os-foundation/workers/30-cli-product-split.md`

Read each prompt in full. Discover every implementation PR, stream-promotion PR, review-repair PR, and relevant task workpad associated with those prompts. Use GitHub history, task metadata, and branch lineage; do not rely on remembered PR numbers.

Before judging the code, create an intent-lineage table with these columns:

| Original worker prompt | Exact requirement/section | Authoritative domain | Secondary seam reviewers | Implementation and repair PRs | Current implementation location | Automated evidence | Runtime/live evidence | Status | Remediation |
| ---------------------- | ------------------------- | -------------------- | ------------------------ | ----------------------------- | ------------------------------- | ------------------ | --------------------- | ------ | ----------- |

The master plan and explicit later Ko approvals supersede conflicting earlier language. Otherwise, the original worker prompt is the authoritative statement of implementation intent. A behavior that passes tests but violates that intent is a finding.

## Review-only GitHub comparison PR

Perform this audit on the authoritative GitHub review surface selected under Worker 23. Prefer the dedicated `review-only` and `do-not-merge` comparison PR, but when it is absent review the immutable ordinary promotion PR or exact GitHub comparison instead. A merged promotion PR remains valid when its exact reviewed head and retained diff are verifiable. Never merge a dedicated review-only PR.

The audit task agent must leave the complete review on GitHub itself:

1. Post every new finding as an inline review comment on the most precise current diff line available.
2. When GitHub cannot attach to the intended line, post a file-and-line-specific top-level comment and explain why inline placement was unavailable.
3. Post the complete structured review object, concise top-level summary, and consolidated agent-fix prompt.
4. Read existing threads first; do not duplicate open findings.
5. After repairs, verify the new candidate head and post `fixed`, `stale`, `needs_verification`, or `waived_by_ko` dispositions in the original threads.
6. Record unavailable context and tool failures on the PR. Local-only review notes are not completion evidence.

Prefix finding IDs and GitHub summaries with `23E`.

## Assigned-worker review method

The assigned audit task agent must perform the entire review directly. Do not invoke or delegate review work to Grok, Codex, another language model, a review subagent, a model wrapper, or another review worker.

Follow `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md`. Inspect the full current diff, surrounding code and tests, original-intent lineage, implementation and repair history, existing GitHub threads, CI, workspace review, runtime evidence, and known gaps yourself.

Use the high-signal standard:

- focus on concrete correctness, security, auth, tenant isolation, data integrity, reliability, observability, architecture, maintainability, performance, and test risks;
- skip style-only preferences and duplicated automated noise;
- include precise location, risk, evidence, recommendation, validation, a GitHub-ready inline review comment, and a copy-paste agent-fix prompt;
- prefer consolidated root-cause findings over a large set of symptoms;
- approve only when no meaningful issue remains.

Existing CodeRabbit, human, or other automated findings are evidence only. Independently verify and disposition them, but do not request or invoke another reviewer. The assigned task agent owns the complete review conclusion.

## Severity and launch gate

Use both the review severity and launch priority:

- `critical` / `P0`: credible security breach, tenant crossing, data loss, release corruption, destructive lifecycle failure, or launch-wide outage.
- `high` / `P1`: likely important-path bug, unsafe auth, serious race, rollback failure, or production reliability defect.
- `medium` / `P2`: meaningful defect that requires repair or an explicit Ko waiver before launch.
- `low` / `P3`: non-blocking high-signal improvement; use sparingly.

No unresolved P0 or P1 may proceed to Worker 23h. Every P2 must be fixed or explicitly waived by Ko with rationale recorded on GitHub and in the finding ledger.

## Domain scope

Review runtime allowlists, platform manifests, deterministic release fingerprints, automatic SemVer allocation and retry idempotency, signatures/digests, immutable tags and GitHub Releases, GitHub Deployments and approvals, R2 parity, protected channel refs, no-op classification, promotion/rollback, credential separation, artifact integrity, installer inputs, package-manager portability, CLI product split, runtime closure, and all required CI path filters/jobs.

## Required evidence

Require clean OCI, Debian/Linux, native Linux, native macOS, native Windows, distribution regression, full integration rehearsal, publication fixture, promotion, rollback, digest parity, no-op, retry, CLI split, and runtime-bundle tests. Inspect workflow permissions, environments, required contexts, path filters, artifact upload/download verification, and release mutation ordering.

## Adversarial review journeys

1. Retry the same source/fingerprint concurrently and prove one version and one immutable asset set.
2. Change docs/tests only and prove no OS release is allocated.
3. Tamper with GitHub or R2 bytes, manifests, signatures, platform versions, or release fingerprints and require rejection.
4. Promote dev to canary/beta/stable and prove byte identity with no rebuild.
5. Interrupt publication or promotion between every external mutation and prove idempotent recovery.
6. Remove one runtime entrypoint or platform artifact and prove closure/matrix failure.
7. Install on clean supported hosts and update N-1 without onboarding; fail health and roll back.

Do not mutate Consuelo OS on Ko's Mac Mini or MacBook Air. Ko performs every real-machine install, update, reset, restart, repair, rollback, and uninstall checkpoint. Reviewers may use CI, disposable homes, registered clean-host lanes, and explicitly approved read-only observation.

## Fix and disposition policy

This domain reviewer is read-only. Do not quietly patch product code and approve your own fix. Post findings to GitHub and the domain report. Do not edit the shared finding ledger directly; Worker 23 is its sole writer and serializes accepted updates. Worker 23 dispatches accepted repairs as narrow task branches to the original owner when ownership remains clear, or to a fresh narrowly scoped repair worker for cross-cutting defects. The same domain reviewer must verify the repaired candidate and update the original GitHub threads.

Write the durable domain report to `packages/os/plans/consuelo-os-foundation/reviews/final/23e-report.md`. The report summarizes evidence and links to GitHub; it does not replace GitHub comments.

## Acceptance gates

- One version and release identity is assigned centrally and idempotently.
- GitHub assets, R2 bytes, manifests, tags, Deployments, and channel pointers agree by version/fingerprint/digest.
- Promotion changes pointers/evidence only and never rebuilds.
- Release credentials remain separate from channel approval environments.
- Every production entrypoint is in the runtime closure; test/internal fixtures are excluded.
- Required clean-host, native, regression, and rehearsal jobs are terminal green with complete path coverage.

- The intent-lineage table covers every requirement in the listed original worker prompts.
- Every new finding is durable on the authoritative GitHub review surface with an inline review comment when GitHub permits it; otherwise use a precise top-level file-and-line or symbol comment.
- The structured review, top-level summary, and consolidated agent-fix prompt are posted to GitHub.
- All existing relevant automated and human findings have a current disposition.
- The report names the exact candidate SHA, authoritative GitHub review surface, baseline or merge-base evidence, tests, runtime evidence, unavailable evidence, and unresolved risks.
- The domain returns `DOMAIN CLEAR`, `DOMAIN CONDITIONAL`, or `DOMAIN BLOCKED`; it does not issue the final launch decision.
