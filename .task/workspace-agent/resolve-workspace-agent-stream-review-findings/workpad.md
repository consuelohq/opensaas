# resolve workspace agent stream review findings

branch: `task/workspace-agent/resolve-workspace-agent-stream-review-findings`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2020/resolve-workspace-agent-stream-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2020
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/streams/workspace-agent/AGENTS.md` (deleted)

## workspace-owned: files changed

- `packages/workspace/streams/workspace-agent/AGENTS.md` (deleted)

## workspace-owned: activity log

- 2026-08-15 04:35:29 fs.write: `.task/workspace-agent/resolve-workspace-agent-stream-review-findings/workpad.md`
- 2026-08-15 04:46:11 fs.trash: `packages/workspace/streams/workspace-agent/AGENTS.md`
- 2026-08-15 04:47:48 fs.write: `.task/workspace-agent/resolve-workspace-agent-stream-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:47:09 `checkFiles`: passed — OK
- 2026-08-15 04:47:40 `review.run`: passed — OK
- 2026-08-15 04:49:00 `verify`: failed — COMMAND_FAILED
- 2026-08-15 04:58:30 `checkFiles`: passed — OK
- 2026-08-15 04:58:44 `review.run`: passed — OK
- 2026-08-15 04:59:10 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agent): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: resolve all still-actionable review findings on stream PR #1989 without regressing the approved session/task architecture; major security/correctness findings must gain focused regression coverage.
existing local pattern: session affinity and work-session authority live in packages/os; generated types/docs are derived from canonical schemas; task/work routing remains fail-closed.
new or changed tests: add focused tests for Consuelo-home resolution, sandbox credential-read denial, session-label fallback, error-code parity, MCP workSession max length, and trace-persistence success; rename session-start tests to the required naming form. For any release-path finding, first verify it does not conflict with the explicitly approved lease-based work-session lifecycle.
focused red command: run only inspected targeted test files after destructive-literal preflight; exact commands will be recorded once affected tests are mapped.
expected red failure: current stream should reproduce each valid review finding before its production fix.
no-test waiver: only for pure test-name/style corrections; no waiver for security, routing, schema, or persistence behavior.

- 2026-08-15 04:35:29 append: `.task/workspace-agent/resolve-workspace-agent-stream-review-findings/workpad.md`

## workspace-owned: files read

- `packages/documentation/src/content/docs/reference/mcp.mdx`
- `packages/documentation/src/content/docs/reference/result-and-error-formats.mdx`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/fs.js`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/code-call/location.ts`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/code-call/types.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/fs-write.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/redaction.test.ts`
- `packages/os/tests/runtime-bundle-managed-site-assets.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/trace-history-redaction.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tests/trace-search-query.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/tests/trace-sites-gateway-read-layer.test.ts`
- `packages/os/tests/trace-sites-history-endpoint-contract.test.ts`
- `packages/os/tests/trace-sites-runtime-boundary.test.ts`
- `packages/os/tests/work-session-code-call.test.ts`
- `packages/os/tests/work-session-fs.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/streams/workspace-agent/AGENTS.md`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/typeorm-cli-contract.test.mjs`

## Implementation status

Resolved the still-actionable stream #1989 review findings:
- generated ErrorCode parity now includes TASK_SESSION_REQUIRED / TASK_SESSION_NOT_FOUND;
- Code Call resolves daemon-owned Consuelo home and denies credential-directory reads in Darwin containment;
- workSession MCP descriptor caps identifiers at 240 chars;
- trace Session labels fall through empty work paths correctly;
- work-session trace fixture reports persistence only when the originating tool succeeds;
- session-start and work-session trace tests use the required naming convention;
- filesystem apply-patch requires the bounded mutation-path resolver and all three FS mutators cover task+work conflicts;
- Code Call mutual exclusion keys off workSession authority, not the resolved physical root;
- docs now include INVALID_SESSION_ROUTE and workspace/session routing mismatch errors;
- the approved metadata-only work-session lifecycle is documented as a renewable seven-day affinity lease, with no session.finish in this tranche;
- canonical workspace-agent stream guidance is populated and the deprecated packages/workspace placeholder copy is removed.

## Validation evidence

- Focused Vitest: 52 passed, 1 platform-conditional skipped across work-session Code Call/FS, session foundation, trace inspector, trace persistence, and generated error-code parity.
- Changed-file checks: 14/14 JS/TS files passed syntax/type checks.
- `git diff --check`: passed.
- Strict review against `origin/stream/workspace-agent`: 0 branch-owned issues, 0 blockers, 0 documentation opportunities.
- Prior task PRs #1984, #1993, #1994, #2000, #2001, #2006 had no actionable inline review comments; stream PR #1989 contained the review debt addressed here.

- 2026-08-15 04:47:48 append: `.task/workspace-agent/resolve-workspace-agent-stream-review-findings/workpad.md`

- 2026-08-15 04:54:11 apply-patch: `packages/os/SCRIPTS.md`

- 2026-08-15 04:54:38 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-15 04:54:38 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 04:57:39 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-15 04:57:39 apply-patch: `packages/workspace/tests/test-selection.test.js`
