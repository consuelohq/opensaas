# fix web security workflow source coverage

branch: `task/os-web/fix-web-security-workflow-source-coverage`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1664/fix-web-security-workflow-source-coverage
github pr: https://github.com/consuelohq/opensaas/pull/1664
started: 2026-07-26

## acceptance criteria

- [ ] The deterministic web-security workflow triggers when any runtime source exercised by its test suite changes.
- [ ] Every test file executed by the workflow is included in both pull-request and push path filters.
- [ ] The manual Cloudflare mutation lane remains separately gated and unchanged.
- [ ] Focused security contract, workspace review, and publish verification pass.

## plan

1. Add a failing contract that enumerates the workflow's runtime-source and test-file trigger closure.
2. Update both pull-request and push path filters with the smallest explicit coverage set.
3. Run the focused Worker 17 security contract, strict review, and full verify.
4. Publish, merge into stream/os-web, and synchronize local refs.

## current status

- Implementation complete. Focused contract and complete deterministic web-security command are green; review and publish verification are pending.

## files changed

- `.github/workflows/consuelo-os-web-security-e2e.yaml`
- `packages/os/tests/web-security-e2e.test.ts`
- `.task/os-web/fix-web-security-workflow-source-coverage/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-26 21:00:35 `review.run`: passed — OK
- 2026-07-26 21:01:07 `verify`: passed — OK

## test-first contract

- Behavior under test: relevant web-security runtime or contract changes always schedule the deterministic web-security job.
- Existing pattern: parse the workflow YAML in `web-security-e2e.test.ts` and assert both event path lists.
- Changed test: expand the existing workflow path assertion to the complete explicit dependency set.
- Focused red command: `bun x vitest run tests/web-security-e2e.test.ts` from `packages/os`.
- Expected red failure: both path-filter arrays omit the newly required runtime and test paths.
- Observed red: path-filter assertion failed as expected; the same run also exposed a pre-existing time-dependent Worker 17 fixture whose six-hour inventory expired at 18:00 UTC. The repair will inject a deterministic verification clock rather than weaken expiry enforcement.

## key decisions

- Keep explicit path filters rather than broad `packages/os/**`, preserving focused CI while preventing known coverage drift.

## notes for ko

- Worker 17 itself was already merged as PR #1662. This repair closes a late review finding and removes a same-day expiry flake from its deterministic fixture.
- The live Cloudflare mutation lane remains manual and was not executed.

## improvements noticed

- none yet

## issues and recovery

- Initial red run had two failures: the intended path-coverage failure and an expired fixed-time inventory. The latter was repaired by creating the verification fixture relative to the test run while retaining the separate exact expiry assertion.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-web): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-os-web-security-e2e.yaml`
- `packages/os/tests/web-security-e2e.test.ts`

## validation summary

- Red: focused contract failed on missing workflow paths and expired verification fixture.
- Green: `web-security-e2e.test.ts` 5/5.
- Full deterministic workflow command: 99 passed, 50 intentionally skipped across 10 files.
