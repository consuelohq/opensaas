# Resolve final managed cloud review findings

branch: `task/os/resolve-final-managed-cloud-review-findings`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2288
started: 2026-08-29

## acceptance criteria

- [x] Provisioning bookkeeping failure cannot roll D1 back after the authoritative heartbeat node record has been persisted.
- [x] Explicit invalid selector cwd values fail closed; only an absent cwd defaults to repository root.
- [x] Current-head CodeRabbit naming/formatting nitpicks are resolved without broad formatting churn.
- [x] Affected selector, routing, heartbeat, syntax, and Worker bundle validations pass.

## plan

1. Reproduce both current-head review findings with focused red tests.
2. Separate provisioning bookkeeping from the node/D1 rollback boundary.
3. Validate present selector cwd values before path resolution.
4. Clear current naming/formatting nitpicks manually and avoid full-file formatting churn.
5. Run affected suites, strict review, and formal verify before stream promotion.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- Keep provisioning-ready bookkeeping after the node-persistence rollback block. A bookkeeping exception can still fail/retry the heartbeat request, but it no longer corrupts already-reconciled D1 state.
- Treat only `cwd === undefined` as absent. Present false/array/blank values are invalid and return the existing `INVALID_SUITE_CWD` result without executing the suite command.
- Reverted a full Prettier pass because it touched hundreds of unrelated lines; applied only the exact formatting/naming review changes manually.

## notes for ko

- RED evidence: invalid `cwd:false` returned success from repo root; provisioning bookkeeping failure persisted the connected node but rolled D1 back so explicit route resolution became `allowed:false`.
- GREEN evidence: selector 63/63, workspace-node routing 48/48, heartbeat client/script 13/13, OS syntax check passed, Device Authority Wrangler dry-run passed.
- Final task validation: strict review 0 findings/0 blockers; formal verify passed with `publishValid: true` and DB safety clean.

## improvements noticed

- none yet

## errors i ran into

- Initial heartbeat regression expected a 503, but the route handler surfaces this thrown bookkeeping error as 500. Adjusted the test to the real response code so the RED assertion reached the D1 inconsistency.
- Running Prettier on the full routing test file created a 1,300-line formatting delta. Restored those two OS files from the task HEAD and reapplied only the intended changes.
- Two attempted Bun package-script invocations printed CLI help instead of executing the script. Corrected validation by invoking `node scripts/check-syntax.js` and `bun x wrangler ... --dry-run` with the process cwd set to `packages/os`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
1. A heartbeat that has already persisted the authoritative node record and reconciled D1 must not roll D1 back merely because managed-cloud provisioning metadata fails afterward; provisioning bookkeeping is outside the node/D1 atomic rollback boundary.
2. Test-selection suite `cwd` defaults to `.` only when absent; a present non-string or blank `cwd` fails closed with `INVALID_SUITE_CWD` before executing the command.
existing local pattern: workspace node heartbeat currently wraps node persistence, D1 reconciliation, and provisioning-ready metadata in one catch that restores D1 from the old node; selector cwd resolver currently treats invalid present values as absent.
new or changed tests: add a heartbeat regression that forces provisioning-ready update failure after node/D1 persistence and asserts the new heartbeat state remains consistent; extend selector cwd tests with false/array/blank invalid values and prove the command never executes.
focused red commands: `bun --cwd packages/os test tests/workspace-node-registry-routing.test.ts` and `bun x vitest run packages/workspace/tests/test-selection.test.js -t "cwd"`.
expected red failures: heartbeat route is rolled back after provisioning metadata failure; invalid present cwd values execute from repo root instead of returning `INVALID_SUITE_CWD`.
no-test waiver: not applicable.

- 2026-08-29 06:15:16 append: `.task/os/resolve-final-managed-cloud-review-findings/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:15:16 fs.write: `.task/os/resolve-final-managed-cloud-review-findings/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-29 06:18:00 apply-patch: `packages/os/scripts/workspace-node-heartbeat.ts`
- 2026-08-29 06:18:00 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-29 06:18:09 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-29 06:18:55 apply-patch: `.task/os/resolve-final-managed-cloud-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 06:19:32 `review.run`: passed — OK
- 2026-08-29 06:20:18 `verify`: passed — OK

- 2026-08-29 06:20:26 apply-patch: `.task/os/resolve-final-managed-cloud-review-findings/workpad.md`