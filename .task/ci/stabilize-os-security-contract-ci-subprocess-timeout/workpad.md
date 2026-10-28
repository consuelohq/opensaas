# Stabilize OS security contract CI subprocess timeout

branch: `task/ci/stabilize-os-security-contract-ci-subprocess-timeout`
stream: `stream/ci`
pr: https://github.com/consuelohq/opensaas/pull/2636
started: 2026-10-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(ci): description" --changed
bun run task:pr
bun run task:finish
```
# Stabilize OS security contract CI subprocess timeout

## Acceptance criteria
- Repair live stream/ci PR #2635 OS-contract failure without dropping a single test or changing security assertions.
- Keep all existing OS-contract suites and status names.
- Make GitHub CI resilient to expected slower subprocess startup on hosted runners while retaining finite per-test timeouts.
- Validate with focused red/green policy tests and the full OS-contract suite, review/verify, and publish into stream/ci; do not merge main or deploy.

## Incident evidence
- PR #2635, Consuelo CI run 40727428863, OS contracts job 122954486749 failed.
- The unchanged test `discovers generated auth from the installed OS home when explicit auth env is unset` at packages/os/tests/security-gateway.test.ts:1493 exhausted the default 5,000ms timeout; recorded duration ~5,616ms. It launches Bun subprocesses and an OS gateway fixture.
- 46 assertions in the job passed and 5 were skipped; observed failure is a time budget, not an assertion mismatch.
- Performance checkout optimization itself worked (changed files checkout 5s; OS workflow security checkout 5s).

## Test-first contract
- Behavior: OS contract CI runs the same three suites with a finite, 15-second per-test budget for subprocess-heavy security fixtures.
- Existing pattern: packages/workspace/tests/github-workflow-policy.test.js guards workflow invariants; .github/workflows/consuelo-ci.yaml os-contracts job runs Vitest.
- Changed test: add policy assertion for 15s timeout and exact presence of all three suites.
- Focused red command: bun x vitest run tests/github-workflow-policy.test.js -t "preserves OS security contract suites".
- Expected red: existing CI workflow does not provide --testTimeout 15000.
- No-test waiver: not applicable.
- Validation: targeted policy green, bun x vitest run three OS contract suites --testTimeout 15000, review/verify against origin/stream/ci, live GitHub verification.

- 2026-10-28 16:38:52 append: `.task/ci/stabilize-os-security-contract-ci-subprocess-timeout/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 16:38:52 fs.write: `.task/ci/stabilize-os-security-contract-ci-subprocess-timeout/workpad.md`
- 2026-10-28 16:39:39 fs.write: `.task/ci/stabilize-os-security-contract-ci-subprocess-timeout/workpad.md`
- 2026-10-28 16:40:26 fs.write: `.task/ci/stabilize-os-security-contract-ci-subprocess-timeout/workpad.md`

## workspace-owned: files read

- `packages/workspace/tests/github-workflow-policy.test.js`

## Red/green and live incident
- Red: bun x vitest run tests/github-workflow-policy.test.js -t "preserves OS security contract" failed as expected because the workflow lacked --testTimeout 15000.
- Green: full workflow policy 13/13.
- Green: all existing OS contracts using the exact new timeout: 47/47 passed, 5 previously skipped remain skipped. No assertions or suites changed.
- Workflow-only adjustment: add --testTimeout 15000 to OS contracts lane, retain three test files unchanged.
- Incident source: GitHub Actions PR #2635 OS contracts 5s timeout of subprocess-backed auth fixture; no security assertion failure.

- 2026-10-28 16:39:39 append: `.task/ci/stabilize-os-security-contract-ci-subprocess-timeout/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 16:39:55 `review.run`: passed — OK
- 2026-10-28 16:39:59 `verify`: passed — OK

## Final focused validation (2026-10-28)
- Local OS contract command: 47 assertions passed, 5 existing skips unchanged; no test deletions.
- Workflow policy: 13/13 passed, including new explicit test-timeout contract.
- review.run against origin/stream/ci: 0 blocking issues, static and typecheck passed.
- Full verify (`bun run verify -- --base origin/stream/ci --json`): passed=true, publishValid=true, DB guard passed; critical local-server, native selector, native Windows, GitHub workflow policy and workflow security tests all passed.
- OS verify compact facade incorrectly surfaced passed=false with zero file count before running the full explicit command. The explicit command produced a signed pass stamp at .task/ci/stabilize-os-security-contract-ci-subprocess-timeout/verify.json.
- Modification only to .github/workflows/consuelo-ci.yaml and regression policy test plus scoped task metadata. Preserve original stream work and do not merge main/deploy.

- 2026-10-28 16:40:26 append: `.task/ci/stabilize-os-security-contract-ci-subprocess-timeout/workpad.md`
