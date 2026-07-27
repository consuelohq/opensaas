# Worker 23: Independent Final Integration Audit Orchestrator

Status: final review gate. Worker 23 is now an orchestrator for seven parallel domain audits and one fresh cross-wave synthesis audit.

## Mandatory context and independence

Bootstrap exactly once with `os.get_steering()` and read its full response. Use OS-only execution through `os.call`; pass the audit `taskSession` on every task-scoped call. Read `packages/os/plans/consuelo-os-foundation/plan.md`, `packages/os/plans/consuelo-os-foundation/environment-registry.md`, `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`, `packages/os/plans/consuelo-os-foundation/workers/27-grok-review-pipeline.md`, this brief, every `23a`-`23h` subbrief, and every original worker prompt referenced by those subbriefs.

Worker 23 must not be performed by an agent that owned Worker 22, a launch implementation, a domain audit, or a repair being judged. Worker 23h must be a fresh agent that did not own Worker 23a-23g.

## Mission

Determine whether the complete approved Consuelo OS foundation is ready for final promotion. Do not infer completion from merged PRs, green CI, review bots, worker reports, or the number of completed waves. Establish original intent, inspect current code and runtime evidence, conduct normal high-signal GitHub code review, dispatch bounded repairs, and issue an evidence-backed launch decision.

## Canonical review-only GitHub comparison PR

Worker 23 must create one review-only GitHub comparison PR that exposes the complete foundation diff for inline review:

1. Resolve the pre-foundation baseline SHA from the first foundation task metadata and independently confirm it from the earliest implementation PR merge base. If the sources disagree, stop and document the conflict.
2. Freeze Worker 22's fully integrated candidate SHA after all required implementation streams are synchronized. Do not start domain audits while the candidate is moving.
3. Create an immutable `audit/os-foundation-baseline` branch at the verified baseline SHA.
4. Create or fast-forward `audit/os-foundation-final-candidate` to the frozen candidate SHA.
5. Open `audit/os-foundation-final-candidate` into `audit/os-foundation-baseline` with title `[REVIEW ONLY] Consuelo OS foundation final audit`, labels `review-only` and `do-not-merge`, and a body containing both SHAs, the ordinary promotion PR, the original prompt inventory, and the audit sequence.
6. Never merge this PR. It is the durable GitHub code-review surface. The ordinary candidate promotion PR remains the only promotion path.
7. During a review round, do not move the candidate head. After all initial domain audits finish, accepted repairs may merge into the real candidate stream; then fast-forward the audit head once, record the new SHA, and run required verification rounds.
8. Close the review-only PR only after Worker 23h posts its final decision. Retain GitHub comments and reports as the durable audit record.

All domain reviewers must leave inline review comments, structured review objects, consolidated agent-fix prompts, top-level summaries, and dispositions directly on this PR. If a finding cannot attach to a diff line, use a precise file-and-line top-level comment. GitHub is the source of truth; local review output is temporary evidence.

## Original-intent inventory

Create a master intent matrix covering launch prompts 01-26 and 30, Worker 28's planning deliverable, and Worker 29 only when Ko explicitly approved extraction. Worker 27 is a review procedure, not implementation scope. For each original worker prompt, discover all implementation, stream-promotion, audit, and repair PRs and map requirements to current files and evidence.

The seven domain briefs own the first-pass matrix partitions:

- `23a-core-runtime-lifecycle-recovery-audit.md`
- `23b-provider-control-plane-audit.md`
- `23c-web-auth-launcher-traces-security-audit.md`
- `23d-native-platform-local-control-audit.md`
- `23e-distribution-release-ci-audit.md`
- `23f-multi-node-registry-routing-audit.md`
- `23g-repository-boundaries-operability-docs-audit.md`

The final synthesis is `23h-cross-wave-final-go-no-go.md`.

## Audit sequence

### Phase 1: freeze and inventory

Record baseline SHA, candidate SHA, ordinary promotion PR, review-only PR, worker-prompt inventory, implementation/repair PR inventory, required environments, current CI, unavailable evidence, and reviewer independence.

### Phase 2: parallel domain reviews

Run Worker 23a through 23g in parallel against the same frozen candidate SHA. Each reviewer follows the Grok 4.5 high-signal review format, independently verifies Grok and CodeRabbit findings, posts directly to GitHub, and writes its report under `packages/os/plans/consuelo-os-foundation/reviews/final/`.

### Phase 3: finding ledger and repairs

Maintain `packages/os/plans/consuelo-os-foundation/reviews/final/finding-ledger.md` with finding ID, domain, priority, GitHub thread, owner, repair PR, validation, disposition, waiver, and candidate SHA.

Domain reviewers remain read-only. Dispatch accepted fixes as narrow task branches. Return owned defects to the original worker/task lineage when practical. Cross-cutting defects receive fresh bounded repair tasks with explicit file ownership. No repair agent approves its own work.

No unresolved P0 or P1 may proceed. Every P2 must be fixed or explicitly waived by Ko on GitHub with rationale. P3 items are recorded but do not block unless they combine into a systemic risk.

### Phase 4: repair verification and second freeze

After accepted repairs merge into the candidate stream, freeze a second candidate SHA. Re-run affected domain audits, current-head CI, Grok 4.5, CodeRabbit when available, and all required platform/clean-host gates. Every original finding thread receives a current disposition.

### Phase 5: independent synthesis

Dispatch Worker 23h as a fresh agent. It reviews cross-wave seams, repeats the required end-to-end journeys, verifies that repairs did not invalidate other domains, and posts the final GitHub review plus `23h-go-no-go.md`.

## Grok-style review contract

Use `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md` as the required review-quality contract. The Grok subagent remains read-only. In Worker 23 direct-posting mode, the audit task agent itself verifies and posts every finding and disposition to GitHub. A local structured JSON object that was not posted does not count.

Every finding includes precise location, severity and P-priority, category, concrete risk, evidence, recommendation, validation, GitHub-ready inline review comment, and agent-fix prompt. Read existing threads before posting. Do not duplicate automated comments, and do not approve while meaningful current findings remain.

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

Do not promote the ordinary candidate PR to `main` until Worker 23h returns `GO` and this orchestrator returns `READY`, unless Ko explicitly accepts a documented conditional gate on GitHub.
