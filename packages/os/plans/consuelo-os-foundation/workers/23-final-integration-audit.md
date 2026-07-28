# Worker 23: Independent Final Integration Audit Orchestrator

Status: final review gate. Worker 23 is now an orchestrator for seven parallel domain audits and one fresh cross-wave synthesis audit.

## Mandatory context and independence

Bootstrap exactly once with `os.get_steering()` and read its full response. Use OS-only execution through `os.call`; pass the audit `taskSession` on every task-scoped call. Read `packages/os/plans/consuelo-os-foundation/plan.md`, `packages/os/plans/consuelo-os-foundation/environment-registry.md`, `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md`, this brief, every `23a`-`23h` subbrief, and every original worker prompt referenced by those subbriefs. Original prompts are product-intent evidence only; their historical execution and delegated-review instructions are superseded and must not be followed.

Worker 23 must not be performed by an agent that owned Worker 22, a launch implementation, a domain audit, or a repair being judged. Worker 23h must be a fresh agent that did not own Worker 23a-23g.

## Mission

Determine whether the complete approved Consuelo OS foundation is ready for final promotion. Do not infer completion from merged PRs, green CI, review bots, worker reports, or the number of completed waves. Establish original intent, inspect current code and runtime evidence, conduct normal high-signal GitHub code review, dispatch bounded repairs, and issue an evidence-backed launch decision.

## Canonical GitHub review surface and coordinate recovery

Worker 23 should create a dedicated review-only GitHub comparison PR when practical, but the domain reviews must not be blocked merely because synthetic audit branches or that dedicated PR were not created. The mandatory invariant is an exact immutable candidate SHA plus an authoritative GitHub comparison surface that exposes the code being reviewed.

For the current completed foundation wave, the authorized recovery surface is ordinary promotion PR #1674 at exact immutable head `ef2530b136ec2a170915b583abfb2341899bd6ab`. Until Worker 23 records a newer numbered candidate after accepted repairs, review round 1 uses that SHA and PR #1674 as the authoritative GitHub review surface.

Use this recovery order:

1. Resolve the ordinary all-stream promotion PR and its exact head SHA. Verify that the SHA contains every required implementation-stream promotion and accepted repair. A merged or closed promotion PR is acceptable when its reviewed head is immutable and its diff remains available.
2. Resolve the comparison baseline from the promotion PR base or merge base and record the exact baseline when GitHub or repository history exposes it.
3. Preferred path: create `audit/os-foundation-baseline`, create or fast-forward `audit/os-foundation-final-candidate`, and open the labeled `[REVIEW ONLY] Consuelo OS foundation final audit` comparison PR. Never merge that review-only PR.
4. Required fallback: when the synthetic audit branches or dedicated review-only PR are absent, use the ordinary promotion PR itself—including a merged immutable PR—as the authoritative GitHub review surface. Use its exact head as the candidate, its recorded base/merge base as the baseline, and its retained diff for inline review.
5. If GitHub cannot attach a finding inline on the retained diff, post a precise top-level comment naming the exact candidate SHA, file, line or symbol, and concrete risk. The lack of a dedicated review-only PR is process debt, not a reason to skip code inspection.
6. Block only when the exact candidate identity, required lineage, or any authoritative reviewable comparison cannot be recovered. Do not return `DOMAIN BLOCKED` solely because `audit/os-foundation-baseline`, `audit/os-foundation-final-candidate`, labels, or the dedicated review-only PR are missing.
7. During a review round, keep the candidate SHA fixed. After accepted repairs merge, increment the review-round number, freeze the new exact candidate SHA, record its lineage, update or replace the authoritative GitHub review surface, and rerun every affected reviewer.
8. Retain all GitHub comments, structured reviews, reports, and dispositions as the durable audit record.

All domain reviewers must leave inline review comments when GitHub permits, plus structured review objects, consolidated agent-fix prompts, top-level summaries, and dispositions directly on the authoritative GitHub review surface. GitHub is the source of truth; local review output is temporary evidence.

## Original-intent inventory

Create a master intent matrix covering implementation prompts 01-22, 24-26, and 30 plus Worker 28's planning deliverable. Worker 23 is this audit orchestrator, Worker 27 is a review procedure rather than implementation scope, and Worker 29 enters scope only when Ko explicitly approved extraction on GitHub. For each in-scope original worker prompt, discover all implementation, stream-promotion, audit, and repair PRs and map requirements to current files and evidence.

The seven domain briefs own the first-pass matrix partitions:

- `23a-core-runtime-lifecycle-recovery-audit.md`
- `23b-provider-control-plane-audit.md`
- `23c-web-auth-launcher-traces-security-audit.md`
- `23d-native-platform-local-control-audit.md`
- `23e-distribution-release-ci-audit.md`
- `23f-multi-node-registry-routing-audit.md`
- `23g-repository-boundaries-operability-docs-audit.md`

Before dispatch, Worker 23 assigns one authoritative domain to every requirement row. Overlap permits secondary seam review, never shared disposition ownership:

| Requirement family                                                                           | Authoritative domain | Secondary seam reviewers   |
| -------------------------------------------------------------------------------------------- | -------------------- | -------------------------- |
| Lifecycle authority, recovery, managed components, steering/runtime identity mechanics       | 23a                  | 23d, 23f                   |
| Customer provider control plane and provider-neutral contracts                               | 23b                  | 23e                        |
| Authentication, workspace sessions, launcher, GTM, traces, OAuth, MCP, and web isolation     | 23c                  | 23f                        |
| Native service adapters, local IPC, platform behavior, and native package contents           | 23d                  | 23a, 23e                   |
| Runtime-bundle closure, release identity, publication, promotion, artifact integrity, and CI | 23e                  | 23d, 23g                   |
| Node identity, signed presence, defaults, routing, offline behavior, and revocation          | 23f                  | 23a, 23c, 23d              |
| Repository/package boundaries, CLI separation, operability, legal scope, and documentation   | 23g                  | 23e                        |
| Cross-wave seams and final launch decision                                                   | 23h                  | 23a-23g as evidence owners |

Every intent-lineage row records `Authoritative domain` and `Secondary seam reviewers`. A secondary reviewer may discover and post a seam finding, but must transfer it to the authoritative domain and may not issue the final disposition. The authoritative reviewer consolidates duplicates, owns the repair-verification decision, and updates the original GitHub thread. If ownership is ambiguous, Worker 23 assigns it before review continues. Worker 23h synthesizes the authoritative matrices and cannot silently reassign or drop a domain-owned requirement.

The final synthesis is `23h-cross-wave-final-go-no-go.md`.

## Audit sequence

### Phase 1: freeze and inventory

Record the exact candidate SHA, authoritative GitHub review surface, baseline or merge-base evidence, ordinary promotion PR, optional dedicated review-only PR, worker-prompt inventory, implementation/repair PR inventory, required environments, current CI, unavailable evidence, and reviewer independence. Missing synthetic audit branches are recorded as process debt and do not stop code review when the exact candidate and comparison are recoverable.

### Phase 2: parallel domain reviews

Run Worker 23a through 23g in parallel against the same frozen candidate SHA. Each assigned worker performs the entire review directly under `independent-review-framework.md`, independently verifies existing automated and human findings, posts directly to GitHub, and writes its report under `packages/os/plans/consuelo-os-foundation/reviews/final/`. No worker invokes or delegates to another model, review subagent, wrapper, or reviewer.

### Phase 3: finding ledger and repairs

Worker 23 is the sole writer of `packages/os/plans/consuelo-os-foundation/reviews/final/finding-ledger.md`. Domain and synthesis agents post findings to GitHub and their own report; they never edit the shared ledger concurrently. Worker 23 serializes accepted ledger updates after each reviewer completes, uses deterministic IDs in the form `23<DOMAIN>-R<ROUND>-<NNN>`, rejects duplicate IDs, checks duplicate path/risk fingerprints and conflicting dispositions, and records the authoritative domain, source reviewer, repair PR, validation, disposition, waiver, and candidate SHA. The ledger is append-only within a review round except for explicit disposition updates that preserve the prior value in GitHub history.

Domain reviewers remain read-only. Dispatch accepted fixes as narrow task branches. Return owned defects to the original worker/task lineage when practical. Cross-cutting defects receive fresh bounded repair tasks with explicit file ownership. No repair agent approves its own work.

No unresolved P0 or P1 may proceed. Every P2 must be fixed or explicitly waived by Ko on GitHub with rationale. P3 items are recorded but do not block unless they combine into a systemic risk.

### Phase 4: repair verification and candidate refreezes

After each accepted repair batch merges into the candidate stream, freeze the next numbered candidate SHA and update or replace the authoritative GitHub review surface only between review rounds. The same assigned reviewers rerun every affected domain or synthesis audit directly, rerun current-head CI and all required platform/clean-host gates, and independently re-evaluate existing automated and human threads. Do not invoke a delegated reviewer. Every original finding thread receives a current disposition before the next round begins.

### Phase 5: independent synthesis

Dispatch Worker 23h as a fresh agent. It reviews cross-wave seams, repeats the required end-to-end journeys, verifies that repairs did not invalidate other domains, and posts the final GitHub review plus `23h-go-no-go.md`. If 23h raises a finding, return to Phases 3 and 4, preserve that reviewer or assign an explicitly independent replacement, and rerun 23h against the next frozen candidate.

## Assigned-worker review contract

Use `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md` as the required review-quality contract. The assigned domain or synthesis task agent is the sole reviewer and must perform every inspection, judgment, GitHub post, repair verification, and disposition directly. Do not invoke or delegate to Grok, Codex, another language model, a review subagent, a model wrapper, or another review worker.

Every finding includes precise location, authoritative domain, secondary seam reviewers, severity and P-priority, category, concrete risk, evidence, recommendation, validation, GitHub-ready inline review comment, and agent-fix prompt. Read existing threads before posting. Existing bot comments are evidence only. Do not duplicate them, and do not approve while meaningful current findings remain. A local structured object that was not posted by the assigned worker does not count.

## Required integrated journeys

Worker 23h must cover at least clean install, update without onboarding, identical-byte promotion, failed update and rollback, repair, uninstall/reinstall, steering, provider reads, universal login, launcher/GTM/traces, OAuth/MCP, secret redaction, native package/control paths, Linux/Windows evidence, two-node join/default/routing/offline/revocation, restart, notification preferences, user steering preservation, and the `consuelo`/`consuelo-dialer` boundary.

Ko controls every mutation on the Mac Mini and MacBook Air. Missing human checkpoints are reported as unavailable or conditional evidence, never fabricated or silently replaced by another machine.

## Acceptance result

Return exactly one final classification:

- `READY`: Worker 23h returned `GO`; every launch-critical requirement is proven; no unresolved P0/P1 or unwaived P2 remains.
- `CONDITIONAL`: Worker 23h returned `NO-GO` only because bounded external or Ko-controlled checkpoints remain, with an executable remediation sequence and no hidden systemic uncertainty.
- `NOT READY`: systemic, security-critical, destructive, cross-tenant, release-integrity, or broadly unproven requirements remain.

A numeric score may follow the evidence matrix but never replaces it.

## Completion report

GitHub must contain all domain inline comments, structured reviews, fix prompts, repair links, dispositions, waivers, and the final synthesis. The repository report set must include the finding ledger, `23a-report.md` through `23g-report.md`, and `23h-go-no-go.md`, each naming the exact SHA it reviewed.

Do not promote the ordinary candidate PR to `main` until Worker 23h returns `GO` and this orchestrator returns `READY`. The only exception is an explicit Ko acceptance on GitHub after Worker 23h returns `NO-GO` solely for bounded external or Ko-controlled checkpoints and this orchestrator returns exactly `CONDITIONAL`; the ledger must show zero unresolved P0/P1 findings and every P2 must be fixed or have a recorded Ko waiver with rationale. A `NOT READY` result, systemic uncertainty, or an unwaived P2 can never use the conditional exception.
