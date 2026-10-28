# fix MCP recovery review blockers

branch: `task/tooling-reliability/fix-mcp-recovery-review-blockers`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2604/fix-mcp-recovery-review-blockers
github pr: https://github.com/consuelohq/opensaas/pull/2604
started: 2026-09-27

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-27 16:43:03 fs.write: `.task/tooling-reliability/fix-mcp-recovery-review-blockers/workpad.md`
- 2026-09-27 16:53:02 fs.write: `.task/tooling-reliability/fix-mcp-recovery-review-blockers/workpad.md`

## workspace-owned: validation evidence

- 2026-09-27 16:50:23 `review.run`: passed — OK
- 2026-09-27 16:51:51 `review.run`: passed — OK
- 2026-09-27 16:53:13 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(tooling-reliability): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- `task.start` and `session.start` routed to a non-default node must not return until the newly created task/work-session affinity is durably claimed; an immediate follow-up using only the returned session id must route back to the creator node.
- Existing-session/non-creation post-upstream affinity refresh remains outside the response-critical path, so a blocked bookkeeping write cannot hold an already completed MCP response open.
- For a mutating MCP call with an explicit caller `requestId`, exactly one executor invocation may acquire that idempotency key. A duplicate while the first is running returns a bounded in-progress result; a duplicate after completion replays the recorded terminal result without executing the mutation again; reusing the id for a different tool/input fails closed as a conflict.
- Recovery state is durable across local OS workers/processes, bounded by retention/size limits, stored with private permissions, and keyed by a fingerprint that excludes transport-only correlation metadata.
- Calls without an explicit caller requestId retain existing execution behavior; transport-generated request ids remain correlation-only.

existing local pattern:
- Stream commit `eed002fe` contains the response-boundary hardening: stable edge-to-local request ids, metadata-only received/response-ready receipts, runtime diagnostics, and deferred post-upstream affinity bookkeeping.
- Codex review on stream PR #2597 identified two P1 gaps: blanket deferral races creation-time affinity, and metadata receipts alone do not provide at-most-once retry/replay for lost mutating responses.
- Use shared local durable state with atomic claim/replace semantics rather than an in-memory map so the worker pool cannot execute the same idempotency key twice.

new or changed tests:
- Routing regression intentionally blocks creation-affinity persistence and proves start response waits for it, then immediate follow-up stays on the creator node.
- Existing non-creation deferred-bookkeeping regression remains green.
- Local MCP request-recovery tests with a fake mutating executor: concurrent same-id call executes once, completed retry replays identical result, different fingerprint conflicts, and no explicit caller id does not dedupe.
- Persistence/permissions/retention tests for request recovery state and focused selector ownership.

focused red command:
`bun x vitest run packages/os/tests/workspace-node-registry-routing.test.ts -t 'creation affinity|post-upstream affinity' packages/os/tests/mcp-request-recovery.test.ts`

expected red failure:
- Creation affinity currently returns before the deferred claim settles.
- No durable result claim/replay layer exists for explicit requestId mutating calls.

no-test waiver: not applicable.

- 2026-09-27 16:43:03 append: `.task/tooling-reliability/fix-mcp-recovery-review-blockers/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`

## RED evidence

- Before production edits, the focused RED run failed in both intended places:
  - `mcp-request-recovery.test.ts` could not import the not-yet-existing durable recovery module.
  - `persists task.start creation affinity before returning the response` received the response before the deliberately blocked affinity claim settled.
- The existing non-creation `post-upstream affinity bookkeeping` regression remained green, preserving the requirement that ordinary bookkeeping not hold completed responses open.

## GREEN implementation

- Creation-time affinity is response-critical only for `task.start` and `session.start`. Their successful upstream response is parsed and the new task/work-session owner is claimed before response handoff. Immediate follow-up regressions prove both task and work sessions stay on `node-member` instead of falling back to the workspace default.
- Other post-upstream affinity refresh/release work remains deferred through the Worker execution context, preserving the nonblocking response path fixed in the preceding task.
- Added a shared local request-recovery store for explicit caller `requestId` on mutating tools:
  - atomic `wx` claim gives one executor ownership across the local worker pool;
  - same id + same caller/tool/input while running returns bounded `REQUEST_IN_PROGRESS`;
  - same id after completion replays the bounded terminal result without re-executing;
  - same id with different caller/tool/input fails closed as `REQUEST_ID_CONFLICT`;
  - dead-owner running records become terminal failure instead of risking a duplicate mutation;
  - oversized/nonserializable completed results are marked non-replayable and never re-executed automatically.
- Recovery keys are scoped to the authenticated caller, exclude transport-only `requestId` from the semantic fingerprint, and are stored under the Consuelo node runs directory with 0700 directories / 0600 files.
- Transport-generated request ids remain correlation-only. A caller that omits an explicit requestId retains existing behavior, so legitimate repeated mutations are not accidentally deduplicated.
- Terminal recovery records default to seven-day retention, 1000-record bound, and 2 MiB result replay bound. Retention is best-effort and never controls execution correctness.

## Validation

- Focused recovery tests: 6/6 green, covering completed replay, concurrent in-progress handling, fingerprint conflict, authenticated caller scope isolation, oversized-result no-rerun behavior, private permissions, and retention.
- MCP gateway + request receipt/recovery contracts: green.
- Full workspace node routing suite: 73/73 green, including task.start and session.start creation-affinity ordering plus existing deferred bookkeeping.
- Full test-selection suite: 89/89 green; `os-mcp-response-completion-boundary` owns the new recovery files and stays critical/exclusive rather than waking the broad OS package suite.
- Strict review after the implementation is clean: zero blockers. The only reported item is a nonblocking public MCP docs opportunity; this change is operational reliability rather than a new public end-user API.
- `git diff --check` green.

## Key decisions

- At-most-once retry applies only when the caller supplies an explicit stable `requestId`. Inventing semantic dedupe for calls without one would suppress intentional repeat mutations.
- Creation-time affinity is the one post-upstream write that must precede response handoff because the returned session id is immediately usable. Refresh/release bookkeeping remains off the response-critical path.
- If a prior owner disappeared while a mutation was marked running, fail closed rather than guess whether the side effect happened and execute it again.

- 2026-09-27 16:53:02 append: `.task/tooling-reliability/fix-mcp-recovery-review-blockers/workpad.md`
