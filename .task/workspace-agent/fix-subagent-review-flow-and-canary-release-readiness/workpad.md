# Workpad — fix subagent review flow and canary release readiness

## Goal
Repair the durable subagent/Grok review path, clear valid unresolved workspace-agent review comments, pass deterministic gates, merge the hotfix to `stream/workspace-agent`, then publish/install/test the signed canary OS.

## Acceptance criteria
- Active durable subagent runs never report a false failure exit code while status is `starting`/`running`.
- Grok deep reviews receive a bounded deadline long enough for review workloads; unsupported reasoning-effort remains fail-closed.
- Raw Grok CLI and durable wrapper behavior are compared and documented.
- All still-valid unresolved CodeRabbit/Grok review findings on stream PR #1989 are fixed; stale comments are resolved with evidence.
- Focused selectors own the changed subagent/session/durable-task surfaces so unrelated package-wide baseline failures do not gate this hotfix.
- Strict review, DB guard, deterministic selected tests, and formal verify are green.
- Hotfix merges to `stream/workspace-agent`; no third review wait is required after the second review cycle if deterministic checks are green.
- Exact signed canary artifact is promoted, installed locally, and live-tested.

## Test-first plan
1. Add RED assertions for active durable-run exit semantics and Grok review timeout defaults.
2. Run focused subagent orchestration tests.
3. Inspect unresolved review threads and add focused RED coverage for each still-valid correctness/security finding.
4. Regenerate manifests/types/docs/test-selection registry.
5. Run affected selectors, strict review, and formal verify.
6. Publish/merge, promote canary, update local OS, and run live subagent/session/HA smoke tests.

## Known incident evidence
- Earlier durable Grok run started successfully but timed out around 112s with no output/events.
- Raw Grok CLI completed a comparable read-only invocation in ~45s, narrowing the remaining issue to wrapper deadline/budget rather than provider auth or binary health.
- Grok provider correctly rejects `reasoningEffort`; this capability error must remain explicit.
- The prior worktree disappeared before changes were committed; this recovered task starts again from the bootstrap commit and must reconstruct fixes from tests/review evidence.

## Implementation status — 2026-08-15
- Fixed durable subagent active-run envelopes: `starting`/`running` now report `exitCode: 0`; terminal failures retain nonzero codes.
- Raised canonical subagent default deadline from 5 minutes to 15 minutes; Grok `reasoningEffort` capability rejection remains explicit.
- Fixed all 22 unresolved second-cycle CodeRabbit findings from stream PR #1989 across task recovery/eviction races, activity leases, cleanup/archive safety, durable-root discovery, work-session fail-closed protection, schema strictness, generated contracts, guidance, and selector ownership.
- Added structured correlation-ID redaction exemption so request/trace IDs remain joinable while phone numbers and secrets remain redacted.
- Updated public tools documentation for typed `session.start` returns and the durable subagent deadline/status contract.

## Validation evidence
- `packages/os/tests/subagent-orchestration-contract.test.ts`: 16/16 passed.
- Durable task/session/protection focused suites: 44 passed + 1 platform skip.
- New facade activity/fallback regressions: 2/2 passed by test name.
- Generated/session contract batch: 22/22 passed.
- Lifecycle/tool-package drift rerun after fixture refresh: 183/183 passed.
- MCP/redaction/work-session Code Call: 48 passed + 1 platform skip.
- Exact task-base selector (`origin/stream/workspace-agent`): 20/20 focused suites passed; no whole-OS package fallback selected.
- Documentation validation: 105 pages validated.
- Repository strict review script: 0 task findings, 0 related blockers, 0 background findings; public docs opportunity addressed afterward.
- `git diff --check`: passed before final documentation update; rerun at publication gate.

## Review disposition
This is the authorized second review cycle. Valid CodeRabbit findings were fixed rather than deferred. Once deterministic gates and formal verify are green, do not wait for a third review cycle before canary release; resolve existing threads with fix evidence and proceed.

## workspace-owned: validation evidence

- 2026-08-15 10:55:17 `verify`: passed — OK
