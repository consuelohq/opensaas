# Worker 23d: Native Platforms and Local Control Audit

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

Determine whether macOS, Linux, and Windows expose one portable lifecycle product through correct platform adapters, safe local-control surfaces, durable service ownership, and release packaging without creating platform-specific lifecycle authorities.

Review the implementation as a normal high-signal teammate code review, not as a checklist recitation. Passing tests, merged PRs, worker closeouts, and review-bot approvals are claims to verify rather than proof by themselves.

## Original worker prompts and intent lineage

Primary original worker prompt set:

- `packages/os/plans/consuelo-os-foundation/workers/18-native-platform-spike.md`
- `packages/os/plans/consuelo-os-foundation/workers/19-macos-app-service.md`
- `packages/os/plans/consuelo-os-foundation/workers/20-linux-platform.md`
- `packages/os/plans/consuelo-os-foundation/workers/21-windows-platform.md`
- `packages/os/plans/consuelo-os-foundation/workers/22-cross-platform-release.md`

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

Prefix finding IDs and GitHub summaries with `23D`.

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

Review the architecture-spike decisions, SwiftUI menu-bar UX, typed framed IPC, daemon/service lifetime, detached lifecycle workers and ownership locks, snapshot ordering, redaction, launchd behavior, Linux systemd/XDG/archive paths, Windows PowerShell/service/path/ACL behavior, browser integration, package contents, executable modes, signing/notarization extension points, and cross-platform parity.

## Required evidence

Require Swift contract tests and builds, macOS package/archive inspection, Linux and Windows runner evidence, platform-adapter tests, service ownership/cleanup evidence, runtime-bundle closure, process-lifetime tests, permissions/ACL assertions, and registered native matrix results. Do not substitute container evidence for launchd, Swift, Windows service, or host permission behavior.

## Adversarial review journeys

1. Restart or update while the local control client is polling and while a mutation is active.
2. Suspend a queued detached worker, replace it, resume it, and prove it cannot execute.
3. Restart the daemon with a lower sequence and verify client/transport cache accepts only the new epoch.
4. Fail socket binding, framing, response production, worker spawn, and service startup.
5. Verify Linux service enable/start/stop/reload and Windows service/task plus ACL cleanup under failure.
6. Inspect every platform archive for required runtime entrypoints and forbidden development/test files.
7. Confirm the native UI never offers unsupported lifecycle semantics and never renders unredacted paths/secrets.

Do not mutate Consuelo OS on Ko's Mac Mini or MacBook Air. Ko performs every real-machine install, update, reset, restart, repair, rollback, and uninstall checkpoint. Reviewers may use CI, disposable homes, registered clean-host lanes, and explicitly approved read-only observation.

## Fix and disposition policy

This domain reviewer is read-only. Do not quietly patch product code and approve your own fix. Post findings to GitHub and the shared finding ledger. Worker 23 dispatches accepted repairs as narrow task branches to the original owner when ownership remains clear, or to a fresh narrowly scoped repair worker for cross-cutting defects. The same domain reviewer must verify the repaired candidate and update the original GitHub threads.

Write the durable domain report to `packages/os/plans/consuelo-os-foundation/reviews/final/23d-report.md`. The report summarizes evidence and links to GitHub; it does not replace GitHub comments.

## Acceptance gates

- Every native surface delegates to the canonical lifecycle engine.
- Platform service adapters touch only Consuelo-owned services and files.
- Local IPC is owner-only, bounded, framed, fail closed, and restart-safe.
- Platform installers and archives contain the same approved runtime closure.
- macOS, Linux, and Windows evidence is platform-appropriate and terminal green.
- Signing/notarization and Ko-controlled real-Mac checkpoints remain explicit gates, not simulated claims.

- The intent-lineage table covers every requirement in the listed original worker prompts.
- Every new finding is durable on the review-only GitHub comparison PR with an inline review comment when GitHub permits it.
- The structured review, top-level summary, and consolidated agent-fix prompt are posted to GitHub.
- All existing relevant CodeRabbit, Grok 4.5, and human findings have a current disposition.
- The report names the exact baseline SHA, candidate SHA, review PR, tests, runtime evidence, unavailable evidence, and unresolved risks.
- The domain returns `DOMAIN CLEAR`, `DOMAIN CONDITIONAL`, or `DOMAIN BLOCKED`; it does not issue the final launch decision.
