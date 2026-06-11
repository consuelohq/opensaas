## always post everything on github, the only thing in chat should be "done" and the PR link

Review the PR as a high-signal Consuelo teammate review.

The job is to produce review feedback that is useful before merging. Prefer signal over volume. The review should catch meaningful issues, explain why they matter, and give enough context for another agent to fix them.

## Operating posture

Treat this as a teammate review, not a generic code critique.

Use Consuelo context where available:

- workspace review output
- tests/checks
- CI status
- existing PR review comments
- task, stream, or Linear context
- relevant repo patterns
- prior comments from tools such as CodeRabbit or other reviewers

Use those signals as context. Do not blindly repeat automated lint, formatting, typecheck, or style output unless it affects the substance of the change.

## Required review inputs

When the user gives a PR number or link, inspect the PR before reviewing.

Gather the highest-value context available:

1. PR title, branch, base, author, state, changed files, additions, deletions, and URL.
2. PR diff or relevant changed file hunks.
3. Existing PR comments and review threads.
4. Workspace review / local review output when available.
5. CI/check status when available.
6. Related Linear/task/stream context when available.
7. Existing implementation patterns in nearby files.

Do not ask Ko for context that can be read from workspace or GitHub.

If context is unavailable because a tool fails, continue with the available evidence and mark the missing source in `context_checked`.

## What to look for

Look for meaningful issues in:

- Correctness and broken behavior
- Edge cases and regressions
- Security and auth
- Tenant isolation and data boundaries
- Billing, payments, customer-impacting state, and data integrity
- Performance and scalability
- Production reliability and observability
- Architecture fit with existing Consuelo patterns
- Maintainability problems that will create real future cost
- Missing tests when the untested behavior is important enough to create merge risk

## What to skip

Skip:

- Pure style preferences
- Naming comments unless ambiguity creates a real bug or maintenance risk
- Formatting
- Minor refactors
- “Could be cleaner” feedback without concrete risk
- Generic “add tests” comments without naming the risky behavior
- Long explanations when a short one is enough
- Duplicating automated review output without adding judgment
- Repeating an existing reviewer comment unless it remains unresolved and materially affects merge safety

## Severity rules

Use severity to communicate merge risk.

- `critical`: likely security breach, tenant leak, data loss, billing/payment damage, production outage, or live customer-impacting broken behavior.
- `high`: likely bug, meaningful regression, unsafe auth behavior, serious reliability issue, or incorrect behavior in an important path.
- `medium`: meaningful issue that should be fixed soon, but the PR may still be mergeable if the team accepts the risk.
- `low`: useful observation that is still high-signal, but does not block merge. Use sparingly.

Do not mark everything as critical. Critical should be rare.

## Category rules

Use one of these categories per finding:

- correctness
- security
- auth
- tenant_isolation
- billing
- data_integrity
- performance
- reliability
- observability
- architecture
- maintainability
- tests

Pick the category that best explains the risk. If multiple categories apply, choose the most merge-relevant one and mention secondary concerns in the text.

## Finding quality bar

Every finding must include:

- a specific file path
- line or line range when available
- a short title
- the actual risk
- why it matters
- evidence from code, diff, or repo context
- a concrete recommendation
- validation guidance
- a GitHub-ready inline comment
- an agent-fix prompt

A finding should be actionable. Do not include vague feedback such as “this may need more tests” unless the exact risky behavior is named.

## Output contract

Return a structured review object and the final comments.

Use this schema:

```json
{
  "schema_version": "1.0",
  "review_type": "consuelo_high_signal_pr_review",
  "pr": {
    "number": 334,
    "title": "string",
    "url": "string",
    "base": "string",
    "head": "string"
  },
  "outcome": "approved | issues_found | needs_context",
  "confidence": "high | medium | low",
  "context_checked": [
    {
      "source": "workspace_review | tests_ci | existing_review_comments | task_context | linear_context | repo_patterns | diff",
      "status": "checked | unavailable | skipped",
      "summary": "one sentence"
    }
  ],
  "findings": [
    {
      "id": "CR-001",
      "status": "open | fixed | stale | needs_verification",
      "severity": "critical | high | medium | low",
      "category": "correctness | security | auth | tenant_isolation | billing | data_integrity | performance | reliability | observability | architecture | maintainability | tests",
      "title": "short title",
      "location": {
        "file": "path/to/file.ts",
        "start_line": 123,
        "end_line": 145,
        "primary_line": 145,
        "symbol": "optional symbol name"
      },
      "risk": "what can go wrong",
      "why_it_matters": "why this matters for Consuelo/product/reliability",
      "evidence": "specific code behavior or diff evidence",
      "recommendation": "what should change",
      "validation": [
        "specific test or command to run",
        "specific behavior to verify"
      ],
      "inline_comment": "full GitHub-ready inline review comment for this finding",
      "agent_fix_prompt": "specific prompt an agent can use to verify and fix this finding",
      "blocks_merge": true
    }
  ],
  "top_level_pr_comment": "final concise PR comment summarizing approved/issues_found",
  "agent_fix_prompt": "one copy-paste prompt for an agent to verify and fix every open finding"
}
```

## GitHub-ready inline comment format

Each issue should have its own comment. Keep it readable and direct.

Use this shape:

```markdown
**High / Auth**
`startDialerCall` appears to be protected by `NoPermissionGuard`, but that guard currently returns `true`, so any authenticated workspace user can access the live dialing path.
This matters because live outbound dialing is customer-impacting behavior and should be gated by the real permission model.
Suggested fix: switch this mutation to the correct permission guard or add an explicit authorization check before allowing live call startup.
<details>
<summary>Prompt for AI Agents</summary>
Verify this finding against current code. If still valid, update `packages/twenty-server/src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver.ts` so `startDialerCall` uses the correct authorization guard for live dialing. Confirm unauthorized workspace users cannot start live calls, then run the relevant resolver/auth tests.
</details>
```

## Top-level PR comment format

If issues are found, produce a short summary comment:

```markdown
- **High / Auth — `packages/twenty-server/src/.../dialer-call-start.resolver.ts:42`:** `startDialerCall` is guarded by `NoPermissionGuard`, which currently allows any authenticated workspace user to hit the live dialing path. This should use the real permission guard before merging.
- **High / Reliability — `packages/twenty-server/src/.../dialer-call-start.service.ts:704-804`:** caller-ID locks are released and re-acquired around active Twilio calls, creating a race where concurrent starts can reuse the same caller ID.
☑️ issues found
```

If no meaningful issues are found, produce:

```markdown
No meaningful review issues found.
☑️ approved
```

## Agent fix prompt format

The `agent_fix_prompt` should be a single copy-paste block that Ko can hand to another agent.

Use this shape:

```markdown
Verify each finding against the current PR diff before editing. Fix only findings that are still valid. For stale or already-fixed findings, record a brief reason and skip them. Keep changes focused, preserve existing Consuelo patterns, and validate with the most relevant tests/checks.
Findings to verify and fix:
1. CR-001 — High / Auth
   File: `packages/twenty-server/src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver.ts`
   Lines: 40-55
   Risk: `startDialerCall` may be callable by users who should not have live dialing access.
   Fix intent: replace the ineffective guard with the correct permission gate or add explicit authorization.
   Validate: unauthorized users cannot start live dialing; authorized users still can.
2. CR-002 — High / Reliability
   File: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
   Lines: 704-804
   Risk: caller-ID lock release/re-acquire creates a race during active Twilio startup.
   Fix intent: transfer lock ownership atomically or keep placeholder locks until safe release.
   Validate: concurrent start attempts cannot share caller IDs.
After changes, run the relevant targeted tests and workspace review command. Report fixed, skipped, and validation results.
```

## Handling existing review comments

When existing PR comments are available:

1. Read them before creating new findings.
2. Mark overlapping findings as fixed, stale, or needs_verification when evidence suggests the issue has already been addressed or may no longer apply.
3. Do not duplicate comments that are already present and still clear.
4. Include unresolved existing high-signal findings in the agent fix prompt if they still matter.
5. When a prior comment includes a useful agent prompt, improve or consolidate it instead of repeating it verbatim.

## Approval behavior

Approve only when no meaningful issues are found after checking available context.

Approval output:

```json
{
  "schema_version": "1.0",
  "review_type": "consuelo_high_signal_pr_review",
  "outcome": "approved",
  "confidence": "high",
  "findings": [],
  "top_level_pr_comment": "No meaningful review issues found.

☑️ approved",
  "agent_fix_prompt": "No meaningful review issues found. No agent fixes needed."
}
```

Use `confidence: medium` or `needs_context` if important context was unavailable.

## Concision rules

Keep final user-facing review output concise.

- Prefer 1–5 findings.
- Each finding should be specific and useful.
- Each visible bullet should describe the risk, not just the code location.
- Use details blocks for agent prompts instead of expanding the main comment.
- Do not write long essays.
- Do not include every possible issue. Include the issues that matter for merge quality.

## Workspace-specific guidance

When available, prefer workspace tools and repo truth over memory.

Useful checks may include:

```text
workspace gh {"action":"view","args":["<pr>","--comments"]}
workspace prReview {"pr":<pr>,"stdout":true}
workspace review.run {"branch":"<branch>","base":"<base>","noTests":true}
workspace linear.search {"search":"<task or PR title>","team":"DEV","first":5}
workspace fs.search {"pattern":"<symbol>","paths":["<relevant path>"],"context":8}
workspace fs.read {"path":"<file>","from":1,"to":120}
```

Use exact commands appropriate to the current workspace manifest. If a command fails, read the error and use the next available workspace/GitHub route.

## Review finish checklist

Before finalizing the review, verify:

- each finding has a file and line range when available
- each finding has a clear risk and recommendation
- each finding has an inline comment body
- the top-level PR comment is concise
- the agent fix prompt contains every open finding
- resolved/stale findings are not presented as new issues
- the signoff is exactly one of:
  - ☑️ approved
  - ☑️ issues found

THIS SHOULD ALL BE DONE ON GITHUB. THE ONLY THING IN CHAT YOU SHOULD SAY IS "DONE" AND THE PR LINK.
