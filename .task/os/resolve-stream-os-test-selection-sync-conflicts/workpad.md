# resolve stream os test selection sync conflicts

branch: `task/os/resolve-stream-os-test-selection-sync-conflicts`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2456/resolve-stream-os-test-selection-sync-conflicts
github pr: https://github.com/consuelohq/opensaas/pull/2456
started: 2026-09-11

## acceptance criteria

- [x] Preserve both stream/os local-steering coverage and main's stream-sync coverage.
- [x] Union the divergent subagent, Code Call regression, and Node SQLite focused contracts instead of choosing one side.
- [x] Regenerate the derived test-selection registry from reconciled rules.
- [x] Keep focused test-selection validation green before promotion back to the stream.
- [ ] Promote to stream/os and rerun stream.sync against main without source conflicts.

## plan

1. Reconcile the three stream/main test-selection conflicts additively.
2. Regenerate the derived registry and run focused tests.
3. Promote to stream/os, retry stream.sync, then continue the release flow.

## current status

- Reconciliation is implemented and locally verified; ready to promote into stream/os and retry the main sync.

## files changed

- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-11 04:42:24 fs.write: `.task/os/resolve-stream-os-test-selection-sync-conflicts/workpad.md`

## workspace-owned: validation evidence

- 2026-09-11 04:45:31 `review.run`: passed — OK
- 2026-09-11 04:45:44 `verify`: passed — OK
- RED after first source reconciliation, before registry/main-contract completion: 75 passed / 4 failed in `packages/workspace/tests/test-selection.test.js`, exposing the stale generated registry plus the missing main Code Call and Node SQLite rule additions.
- GREEN after completing the additive merge and regenerating the registry: 79/79 test-selection tests passed.
- `packages/workspace/tests/stream-sync-node-modules.test.js`: 1/1 passed. The second main-side generated-registry test file does not exist on the pre-sync stream branch yet; it will arrive from main during stream.sync.
- Final review: 0 blocking issues. Final verify: publishValid=true, no DB risks.

## key decisions

- Treat the conflict as additive integration, not a winner-takes-all choice: both sides' focused contracts are valid.
- Bring forward main's Code Call process-regression and Trace SQLite selection rules now because the copied main assertions correctly exposed those dependencies.
- Do not copy the generated registry by hand; regenerate it from the reconciled rules.

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

## Test-first contract — stream/os sync reconciliation

behavior under test: preserve both stream/os and origin/main test-selection coverage so `stream.sync` can merge main without dropping either side's focused rules/tests.
existing local pattern: `packages/workspace/tests/test-selection.test.js` validates explicit rule selection and `packages/workspace/scripts/test-selection.js generate` owns the generated registry.
new or changed tests: preserve the existing stream durable-subagent test and bring forward origin/main's Dialer/trace-SQLite/stream-sync selection tests; then run the focused test-selection suite.
focused red command: not applicable before reconciliation because the failure is Git's three-way merge conflict, already reproduced by `stream.sync` in three test-selection files.
expected red failure: `stream.sync` reported content conflicts in `test-selection.rules.json`, generated `test-selection.registry.json`, and `tests/test-selection.test.js`.
no-test waiver: explicit integration-only waiver for the pre-edit red step; the merge conflict itself is the failing reproduction and no product behavior is being invented. Post-edit focused tests and a second `stream.sync` are required.

### Conflict resolution plan
- Keep both explicit rules: stream's `os-local-steering-authority` and main's `workspace-stream-sync-runtime`.
- Union `os-subagent-runtime` coverage: orchestration + lifecycle regressions + executable discovery + runner termination, retaining `--no-file-parallelism`.
- Keep the stream durable-subagent selection test and main's three focused selection tests.
- Regenerate `test-selection.registry.json` from the reconciled rules instead of hand-editing generated counts/content.

- 2026-09-11 04:42:24 append: `.task/os/resolve-stream-os-test-selection-sync-conflicts/workpad.md`

## workspace-owned: files read

- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-09-11 04:46:08 apply-patch: `.task/os/resolve-stream-os-test-selection-sync-conflicts/workpad.md`