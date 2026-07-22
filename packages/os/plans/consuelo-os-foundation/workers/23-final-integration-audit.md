# Worker 23: Independent Final Integration Audit

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full. Then read every completed launch worker report for prompts 01-27 and 30, Worker 28's architecture-audit report, the integrated diff, and the current test/release evidence. Worker 29 is included only if Ko separately approved repository extraction. This task must be performed by an agent that did not own the integration implementation.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Determine whether the complete approved plan is actually done. Do not infer completion from merged PRs, passing unit suites, or worker claims.

## Audit method

Build a requirement matrix with one row for every non-negotiable, implementation item, acceptance gate, migration, and out-of-scope boundary in the master plan and worker briefs.

For every row record:

- requirement;
- owner task/PR;
- implementation location;
- automated evidence;
- live/runtime evidence where required;
- status: proven, partially proven, blocked, missing, or scope violation;
- exact remediation.

## Required live journeys

Where credentials and test hosts are available, independently exercise:

1. Clean terminal install on an empty supported host.
2. Existing-install update through an immutable dev runtime bundle without onboarding.
3. Promotion of the same bytes to a later channel.
4. Failed update and rollback.
5. Repair and uninstall/reinstall.
6. Mac Mini dev behavior while the Air is offline.
7. MacBook Air canary/beta acceptance when brought online.
8. Steering response with system prompt, runtime identity, managed skills summary, and update count, excluding `decision.md`.
9. Railway, Vercel, and Cloudflare customer-provider discovery and safe read call.
10. Universal login, workspace reuse, launcher, `/gtm`, traces, OAuth, and MCP tools discovery/call.
11. Secret redaction and customer/operator Cloudflare boundary.
12. Cross-platform manifest completeness and at least CI-backed Linux/Windows install evidence.
13. Same-account second-machine join with distinct node IDs, home/default preservation, presence, explicit routing, offline handling, and revocation.
14. `consuelo restart`, update-notification preferences, visible user steering preservation, and `consuelo` versus `consuelo-dialer` boundary.

Do not mutate the Mac Mini production-like internal OS or live stable channel without Ko's explicit approval. Use disposable state or the Air for destructive rehearsals.

## Technical-debt audit

Specifically search for:

- duplicate release authorities;
- stale tool/skill manifests;
- legacy `decision.md` installation or steering inclusion;
- hard-coded Consuelo repo, workspace, Railway project, environment, service, Homebrew, or machine paths in customer runtime;
- shell string interpolation in provider tools;
- secrets in logs, environment dumps, command lines, diagnostics, or UI;
- platform code that rebuilds promoted runtime bundles;
- direct feature work or human commits on protected release branches;
- customer install paths that require Cloudflare credentials/accounts;
- deleted functionality kept alive through hidden compatibility fallbacks;
- package/runtime directories that accumulate without retention.
- active imports or runtime consumers of the retired `packages/os/tooling` authority.

## Fix policy

This is read-only by default. Do not quietly fix findings and declare success. Produce a prioritized remediation plan. Small audit-only test corrections may be proposed, but implementation requires explicit approval or a follow-up task.

## Acceptance result

Return one of:

- `READY`: every launch-critical requirement is proven and remaining gaps are explicitly deferred non-launch scope.
- `CONDITIONAL`: specific bounded blockers remain with an executable remediation sequence.
- `NOT READY`: systemic or security-critical requirements are missing.

Include a numeric score only after the evidence matrix, never as a substitute for it.

## Completion report

Deliver the matrix, live evidence, untested assumptions, security findings, launch blockers, deferred work, and the exact next action. A green CI badge alone is not an acceptable completion report.
