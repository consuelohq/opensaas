# Stop CI-only main merges from redeploying dialer

branch: `task/ci/stop-ci-only-main-merges-from-redeploying-dialer`
stream: `stream/ci`
pr: https://github.com/consuelohq/opensaas/pull/2643
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
# CI-only merge should not redeploy dialer

## Intent and safety
- User explicitly approved merging CI optimization PR #2635 to main when safe and verifying production Actions.
- Preflight found three recent Consuelo Production Release push workflows failed in dialer-only job; docs, website, and OS release stages succeeded.
- 2026-10-28 run 40737396822 failure: "Configure dialer edge identity secret" invokes Railway CLI; error Invalid RAILWAY_TOKEN (do NOT disclose credentials or change deployment configuration without owning it).
- Current classifier treats modifications to .github/workflows/consuelo-ci.yaml and to production-release.yaml itself as dialer runtime release inputs, even for CI-only changes. This is unnecessary production execution and amplifies known credential failure.
- This task ONLY narrows no-op dialer release selection, does not suppress dialer source/dependency changes, does not repair Railway credentials, does not initiate calls or deploy manually.
- Preserve other agents' edits, CI status names, and safety gates. User authorized ship through stream/main.

## Acceptance criteria
1. CI-only workflow changes (.github/workflows/consuelo-ci.yaml or .github/workflows/consuelo-production-release.yaml) do not initiate a production dialer release on main push.
2. Changes to packages/dialer, dialer-server, lead-connector, logger, contacts, root lock/dependency config, and dialer rollback scripts continue to trigger dialer release, plus explicit manual target dialer/all.
3. New workflow policy tests guard both sides and ensure release job cannot run without classifier true.
4. No reduction in CI PR dialer tests; distinct CI planner still routes central CI workflow to dialer test lane.
5. Focused red/green, security-policy review and full verify; task publish to stream/ci; re-sync/check PR; merge main only after clean gates. Inspect automatic production release jobs afterward.

## Test-first contract
- Behavior: production dialer release trigger selects runtime inputs and deliberate rollback changes; it excludes unrelated CI/release workflow edits when no runtime inputs changed. Explicit workflow_dispatch target dialer/all remains supported.
- Existing pattern: packages/workspace/tests/github-workflow-policy.test.js and packages/os/tests/ci-plan.test.ts; dialer release workflow regression contracts if any.
- New test: parse production-release YAML with yaml, extract changed-file matcher and assert CI-only edits do not match while dialer source, root package config, rollback paths do; assert job if needs.dialer-changes.outputs.release == true; retain manual target dispatch contract.
- Focused red command: bun x vitest run tests/github-workflow-policy.test.js -t "does not deploy dialer for CI-only workflow edits" in packages/workspace.
- Expected red: production classifier regex currently matches consuelo-ci.yaml and consuelo-production-release.yaml; focused test should fail.
- No-test waiver: none.

## Baseline
- PR #2635 after first three tasks and main sync: stream head 589849399ccd6abaafd30327726b36211520fa02; 18 GitHub Actions tests passed, CodeRabbit review pending.
- Manual workflow_dispatch run 40741720679: planner, verify, OS contracts, dialer, Sites Gateway succeeded, downstream workflow-security full-history checkout still in progress as of ~18:13 UTC.
- Existing production release failures from invalid Railway token must be reported to dialer/release owner separately; never modify secrets here.

- 2026-10-28 18:16:06 append: `.task/ci/stop-ci-only-main-merges-from-redeploying-dialer/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 18:16:06 fs.write: `.task/ci/stop-ci-only-main-merges-from-redeploying-dialer/workpad.md`
- 2026-10-28 18:17:26 fs.write: `.task/ci/stop-ci-only-main-merges-from-redeploying-dialer/workpad.md`
- 2026-10-28 18:20:17 fs.write: `.task/ci/stop-ci-only-main-merges-from-redeploying-dialer/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

- 2026-10-28 18:17:08 apply-patch: `.github/workflows/consuelo-production-release.yaml`
## Red/green evidence
- Red: focused policy test failed on production matcher incorrectly treating .github/workflows/consuelo-ci.yaml as dialer runtime deployment change.
- Green: 31 workflow/docs/website tests and 5 existing lead-connector dialer release contract tests all passed, git diff --check clean. Runtime packages, root dependency config and rollback files remain dialer release triggers; CI-only and release-workflow-only edits no longer trigger redeploy, while explicit manual target all/dialer remains supported.
- No changes to Railway secrets or dialer runtime. This corrects automatic production selection only.
- Next: workflow security policy, review and verify, publish task to stream, check latest main, re-run PR checks, merge if safe, verify automatic production release (including dialer skipped).

- 2026-10-28 18:17:26 append: `.task/ci/stop-ci-only-main-merges-from-redeploying-dialer/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 18:17:44 `review.run`: passed — OK
- 2026-10-28 18:18:58 `verify`: passed — OK

## Final review, verification, and release scope (2026-10-28)
- A focused red regression reproduced the incorrect production dialer trigger for CI-only edits. Green: 31 workflow/docs/website policy tests and 5 LeadConnector release contracts passed, git diff --check passed.
- Changed GitHub automation security checker with explicit production workflow path found zero issues.
- review.run: zero blockers, static and typecheck checks pass. verify: passed=true, publishValid=true; 4 required registry suites passed; DB guard found no risks.
- Release scope: no dialer runtime code, credentials, or service configuration touched. Production deployment classifier still dispatches for runtime packages, root lock/manifests, rollback workflow, or explicit manual all/dialer. Main CI merge should not trigger a known-failing dialer production release.
- Optional manual CI smoke #40741720679 was cancelled after the full-history workflow-security checkout hung on a GitHub fetch for 10min; other manual jobs were green. This is runner fetch performance, not an assertion failure; disclose in final, keep a separate follow-up if ongoing.
- After publish, stream sync and require green PR test checks, then merge to main and inspect automatic production workflows.

- 2026-10-28 18:20:17 append: `.task/ci/stop-ci-only-main-merges-from-redeploying-dialer/workpad.md`
