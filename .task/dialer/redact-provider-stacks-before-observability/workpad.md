# redact provider stacks before observability

branch: `task/dialer/redact-provider-stacks-before-observability`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1773/redact-provider-stacks-before-observability
github pr: https://github.com/consuelohq/opensaas/pull/1773
started: 2026-08-04

## acceptance criteria

- [x] Provider error stacks are phone-redacted before reaching logger metadata or Sentry extras.
- [x] A focused regression test fails before the fix and passes afterward.
- [x] Focused tests, typecheck classification, formatting, and publish verification pass.

## discovery

- The existing `getSafeErrorDetails` redacts `Error.message` but copies `Error.stack` unchanged.
- Both the Nest logger and Sentry extras receive that unchanged `errorStack` during parallel dial failures.
- The existing group-creation failure test is the narrow regression seam.

## red test evidence

- `twenty-server:jest` failed 1 of 19 focused tests before implementation: the logger received the full `+14155552671` in `errorStack` instead of `***2671`.

## validation evidence

- Focused `ParallelService` spec: 19 passed, 0 failed after implementation.
- `twenty-server:typecheck` was run but is unavailable as a task-specific pass: it reports existing errors across unrelated command runners, migrations, DTOs, and entities; none reference either changed file.
- Prettier and `git diff --check`: pass.
- Direct ESLint is unavailable in this task worktree because `packages/twenty-eslint-rules` is absent, causing the existing `twenty/inject-workspace-repository` rule to be unresolved.
- The verifier reported four related pre-existing `ERROR_HANDLING` findings in this same service. The status callback now has a logged/Sentry error boundary, and the three sequential helper loops use equivalent promise chains; focused tests remain 19/19 green.
- Underlying full `verify --no-stamp` after those fixes: `publishValid: true`, 0 task findings, 0 related same-file findings, both selected server suites passed, database guard passed. The project-wide typecheck remains explicitly classified as one pre-existing non-blocking finding.

## plan

1. Extend the existing failure-path test with a phone-bearing provider stack and assert redaction in logger metadata and Sentry extras.
2. Redact the stack through the same helper already used for the message.
3. Run the focused spec, typecheck, formatting, and full publish verification before merging to the stream.

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

- none yet

## workspace-owned: validation evidence

- 2026-08-04 20:44:19 `verify`: failed — COMMAND_FAILED
- 2026-08-04 20:46:29 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-04 20:31:14 apply-patch: `.task/dialer/redact-provider-stacks-before-observability/workpad.md`
- 2026-08-04 20:31:14 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

- 2026-08-04 20:32:19 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- 2026-08-04 20:32:19 apply-patch: `.task/dialer/redact-provider-stacks-before-observability/workpad.md`

- 2026-08-04 20:33:02 apply-patch: `.task/dialer/redact-provider-stacks-before-observability/workpad.md`

- 2026-08-04 20:33:26 apply-patch: `.task/dialer/redact-provider-stacks-before-observability/workpad.md`

## workspace-owned: files read

- none yet

- 2026-08-04 20:40:03 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`

- 2026-08-04 20:44:23 apply-patch: `.task/dialer/redact-provider-stacks-before-observability/workpad.md`

- 2026-08-04 20:46:53 apply-patch: `.task/dialer/redact-provider-stacks-before-observability/workpad.md`