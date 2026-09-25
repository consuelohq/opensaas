# Close OS connection and trace review findings

branch: `task/os/close-os-connection-and-trace-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2377/close-os-connection-and-trace-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2377
started: 2026-09-04

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

- 2026-09-04 15:45:40 fs.write: `.task/os/close-os-connection-and-trace-review-findings/workpad.md`
- 2026-09-04 15:49:16 fs.write: `.task/os/close-os-connection-and-trace-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-09-04 15:49:01 `review.run`: passed — OK
- 2026-09-04 15:50:04 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract — completed review round

behavior under test: successful empty trace hydration replaces serialized seed rows; failed initial heatmap history load clears aria-busy; revocation of an existing D1 route never recreates a raced-away row; existing-record UPDATE reports failure when it changes zero rows
existing local pattern: observability/settings source contract tests cover emitted browser behavior; cloudflare-d1-route-registry.test.ts supplies a production-shaped prepared-statement fixture
new or changed tests: add empty hydration and aria-busy source contracts; make the D1 fixture report meta.changes and reject unmatched UPDATE; assert revocation uses UPDATE and the existing row is actually modified
focused red command: bun test packages/os/tests/observability-traces-site.test.ts packages/os/tests/settings-site.test.ts packages/os/tests/cloudflare-d1-route-registry.test.ts
expected red failure: empty history does not always call replaceRows, failure path leaves aria-busy true, revocation uses the upsert path, and zero-row UPDATE is accepted
no-test waiver: not applicable

- 2026-09-04 15:45:40 append: `.task/os/close-os-connection-and-trace-review-findings/workpad.md`

- 2026-09-04 15:47:15 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-09-04 15:47:15 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-09-04 15:47:16 apply-patch: `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- 2026-09-04 15:47:44 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-09-04 15:47:44 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-09-04 15:47:44 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`

## Implementation and validation

- Successful persisted-history hydration now replaces the current table for both populated and empty snapshots.
- Failed Home heatmap refresh clears aria-busy while preserving any cached historical aggregate.
- Revocation uses the existing-record UPDATE path and cannot recreate a row deleted after the read.
- Existing-record D1 writes inspect meta.changes and fail when no row matched; the production-shaped fixture now models that result and proves the stored heartbeat update.
- Focused red: tracing and Home each failed their new assertion; D1 contract passed 11 and failed the raced-delete revocation case.
- Combined green: 75 tests, 0 failures across 8 files; 571 expectations.
- OS syntax/type contract: passed.
- Workspace edge and device authority Cloudflare dry runs: passed.
- Strict workspace review: 0 issues, 0 blockers.

- 2026-09-04 15:49:16 append: `.task/os/close-os-connection-and-trace-review-findings/workpad.md`
