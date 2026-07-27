# Worker 23c: Web Authentication, Launcher, Traces, and Security Audit

Status: final-audit subbrief. This is a read-only review partition of Worker 23, not an implementation worker.

## Mandatory context and OS execution

Bootstrap exactly once with `os.get_steering()` and read its full response. Use OS-only execution through `os.call`, create or recover the exact audit task session, and pass `taskSession` on every task-scoped call. Do not silently fall back to another computer, native Git, unscoped shell, or the legacy workspace connector.

Read these files in full before reviewing:

- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/plans/consuelo-os-foundation/workers/27-grok-review-pipeline.md`
- every original worker prompt listed below

Use the exact baseline SHA, candidate SHA, and review-only GitHub comparison PR established by Worker 23. Stop if any of those coordinates drift or cannot be independently verified.

## Mission

Determine whether universal login, workspace session handoff, authenticated launcher and `/gtm`, traces, OAuth/MCP routing, deployment behavior, and web security remain correct, isolated, redacted, and fail closed across the final integrated candidate.

Review the implementation as a normal high-signal teammate code review, not as a checklist recitation. Passing tests, merged PRs, worker closeouts, and review-bot approvals are claims to verify rather than proof by themselves.

## Original worker prompts and intent lineage

Primary original worker prompt set:

- `packages/os/plans/consuelo-os-foundation/workers/13-web-auth-contract.md`
- `packages/os/plans/consuelo-os-foundation/workers/14-universal-login.md`
- `packages/os/plans/consuelo-os-foundation/workers/15-launcher-gtm-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/16-traces-hono.md`
- `packages/os/plans/consuelo-os-foundation/workers/17-web-security-e2e.md`

Read each prompt in full. Discover every implementation PR, stream-promotion PR, review-repair PR, and relevant task workpad associated with those prompts. Use GitHub history, task metadata, and branch lineage; do not rely on remembered PR numbers.

Before judging the code, create an intent-lineage table with these columns:

| Original worker prompt | Exact requirement/section | Implementation and repair PRs | Current implementation location | Automated evidence | Runtime/live evidence | Status | Remediation |
| ---------------------- | ------------------------- | ----------------------------- | ------------------------------- | ------------------ | --------------------- | ------ | ----------- |

The master plan and explicit later Ko approvals supersede conflicting earlier language. Otherwise, the original worker prompt is the authoritative statement of implementation intent. A behavior that passes tests but violates that intent is a finding.

## Review-only GitHub comparison PR

Perform this audit on the canonical review-only GitHub comparison PR created by Worker 23. The PR compares the verified pre-foundation baseline with the frozen final candidate and is labeled `review-only` and `do-not-merge`. Never merge it.

The audit task agent must leave the complete review on GitHub itself:

1. Post every new finding as an inline review comment on the most precise current diff line available.
2. When GitHub cannot attach to the intended line, post a file-and-line-specific top-level comment and explain why inline placement was unavailable.
3. Post the complete structured review object, concise top-level summary, and consolidated agent-fix prompt.
4. Read existing threads first; do not duplicate open findings.
5. After repairs, verify the new candidate head and post `fixed`, `stale`, `needs_verification`, or `waived_by_ko` dispositions in the original threads.
6. Record unavailable context and tool failures on the PR. Local-only review notes are not completion evidence.

Prefix finding IDs and GitHub summaries with `23C`.

## Grok 4.5 teammate-review method

Render `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md` with this domain brief, the full plan, exact comparison diff, surrounding code, original intent lineage, existing GitHub comments, current CI, workspace review, task context, and known gaps. Run the existing read-only Grok 4.5 procedure from `packages/os/plans/consuelo-os-foundation/workers/27-grok-review-pipeline.md`. Grok is evidence, not authority: independently verify every proposed finding against the current candidate before posting it.

Use the Grok high-signal standard:

- focus on concrete correctness, security, auth, tenant isolation, data integrity, reliability, observability, architecture, maintainability, performance, and test risks;
- skip style-only preferences and duplicated automated noise;
- include precise location, risk, evidence, recommendation, validation, a GitHub-ready inline review comment, and a copy-paste agent-fix prompt;
- prefer consolidated root-cause findings over a large set of symptoms;
- approve only when no meaningful issue remains.

CodeRabbit findings must also be verified and dispositioned. A CodeRabbit rate limit does not waive Grok 4.5 or this agent's independent review.

## Severity and launch gate

Use both the Grok severity and launch priority:

- `critical` / `P0`: credible security breach, tenant crossing, data loss, release corruption, destructive lifecycle failure, or launch-wide outage.
- `high` / `P1`: likely important-path bug, unsafe auth, serious race, rollback failure, or production reliability defect.
- `medium` / `P2`: meaningful defect that requires repair or an explicit Ko waiver before launch.
- `low` / `P3`: non-blocking high-signal improvement; use sparingly.

No unresolved P0 or P1 may proceed to Worker 23h. Every P2 must be fixed or explicitly waived by Ko with rationale recorded on GitHub and in the finding ledger.

## Domain scope

Review PKCE and OAuth parameter handling, short-lived single-use handoff, scoped workspace sessions, membership resolution, same-account workspace reuse, protected route ordering, pre-auth data boundaries, derived workspace links, `/gtm`, trace table/live feed, Hono route integration, bearer challenges, MCP discovery/call, connector authorization, WAF/origin routing, deployment cleanup, and secret redaction.

## Required evidence

Require auth contract tests, route matrices, negative membership and cross-workspace tests, session replay/expiry tests, launcher/GTM/trace integration, MCP and connector tests, deterministic security E2E, registered Cloudflare cleanup evidence, and deployed-source reconciliation where required. Inspect response bodies, cookies, redirects, cache headers, and logs.

## Adversarial review journeys

1. Replay, expire, duplicate, interrupt, and cross-workspace the authorization handoff.
2. Attempt protected launcher, GTM, traces, node, MCP, and connector access before auth and from another workspace.
3. Verify pre-auth preview contains only static or sanitized data, not CSS-hidden protected content.
4. Exercise route-order conflicts, malformed OAuth parameters, refresh rotation, and duplicate refreshes.
5. Route a request through an unauthorized or revoked connector/node.
6. Force edge/deployment failure and verify fail-safe cleanup deletes only the current run ID.
7. Search UI, responses, logs, CI artifacts, and diagnostics for secrets or private workspace data.

Do not mutate Consuelo OS on Ko's Mac Mini or MacBook Air. Ko performs every real-machine install, update, reset, restart, repair, rollback, and uninstall checkpoint. Reviewers may use CI, disposable homes, registered clean-host lanes, and explicitly approved read-only observation.

## Fix and disposition policy

This domain reviewer is read-only. Do not quietly patch product code and approve your own fix. Post findings to GitHub and the shared finding ledger. Worker 23 dispatches accepted repairs as narrow task branches to the original owner when ownership remains clear, or to a fresh narrowly scoped repair worker for cross-cutting defects. The same domain reviewer must verify the repaired candidate and update the original GitHub threads.

Write the durable domain report to `packages/os/plans/consuelo-os-foundation/reviews/final/23c-report.md`. The report summarizes evidence and links to GitHub; it does not replace GitHub comments.

## Acceptance gates

- Authentication and workspace isolation fail closed.
- Session handoff is scoped, single-use, short-lived, and replay-resistant.
- Workspace links and `/gtm` are derived from authenticated records.
- Trace and MCP surfaces remain protected and tenant-correct.
- Edge cleanup is bounded and production resources are never test fixtures.
- Existing OAuth, gateway, route-order, bearer, and redaction regressions remain locked.

- The intent-lineage table covers every requirement in the listed original worker prompts.
- Every new finding is durable on the review-only GitHub comparison PR with an inline review comment when GitHub permits it.
- The structured review, top-level summary, and consolidated agent-fix prompt are posted to GitHub.
- All existing relevant CodeRabbit, Grok 4.5, and human findings have a current disposition.
- The report names the exact baseline SHA, candidate SHA, review PR, tests, runtime evidence, unavailable evidence, and unresolved risks.
- The domain returns `DOMAIN CLEAR`, `DOMAIN CONDITIONAL`, or `DOMAIN BLOCKED`; it does not issue the final launch decision.
