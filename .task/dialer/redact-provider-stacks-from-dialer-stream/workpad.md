# redact provider stacks from dialer stream

branch: `task/dialer/redact-provider-stacks-from-dialer-stream`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1774/redact-provider-stacks-from-dialer-stream
github pr: https://github.com/consuelohq/opensaas/pull/1774
started: 2026-08-04

## acceptance criteria

- [x] Preserve the current Effect-based stream architecture while redacting provider stacks before observability.
- [x] A focused regression test fails before the fix and passes afterward.
- [x] Focused tests, formatting, and publish verification pass.

## discovery

- This task is explicitly based on `stream/dialer`; the superseded main-based PR 1773 was closed to prevent an architectural regression.
- The current stream's `getSafeErrorDetails` redacts the provider message but copies `cause.stack` unchanged.
- The existing safe group-creation failure spec is the narrow regression seam for logger and Sentry extras.

## plan

1. Add a phone-bearing provider-stack assertion to the existing failure-path spec. Done.
2. Redact `cause.stack` with the same helper as `cause.message`. Done.
3. Run the focused spec, formatting, and full publish verification, then merge to the dialer stream. Done.

## current status

- The regression failed before the production change because the full phone number remained in `errorStack`.
- The production change now redacts both occurrences in the provider stack before logger and Sentry observability.
- Focused Twenty Server spec passes: 23/23 tests.

## files changed

- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 20:55:03 `verify`: passed — OK
- Focused regression: 23/23 tests passed.
- Formatting and `git diff --check` passed.
- Full verifier: `publishValid: true`, review passed with zero blocking issues, selected test suite passed, and DB guard passed with zero risks/findings.

## key decisions

- Preserve the original exception object for `Sentry.captureException`; sanitize only the structured observability extras derived from it.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The typed verifier completed but its MCP transport dropped. The user-approved underlying `bun run verify -- --no-stamp --json` confirmed the same result with `publishValid: true`; the facade recovered afterward.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-04 20:49:39 apply-patch: `.task/dialer/redact-provider-stacks-from-dialer-stream/workpad.md`
- 2026-08-04 20:49:39 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`
- 2026-08-04 20:51:51 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`

- 2026-08-04 20:52:29 apply-patch: `.task/dialer/redact-provider-stacks-from-dialer-stream/workpad.md`

- 2026-08-04 20:56:08 apply-patch: `.task/dialer/redact-provider-stacks-from-dialer-stream/workpad.md`