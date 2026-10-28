# Optimize agent CI latency while strengthening change coverage

branch: `task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage`
stream: `stream/ci`
pr: https://github.com/consuelohq/opensaas/pull/2634
started: 2026-10-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/workflows/changed-files.yaml`
- `.github/workflows/ci-website.yaml`
- `packages/workspace/tests/github-changed-files.test.js`

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
# Optimize agent CI latency while strengthening change coverage

## Acceptance criteria
- Improve measured GitHub Actions PR feedback latency without removing test suites, platform coverage, security gates, or stable status-check names.
- Fix deletion-only change routing and prove the planner detects deletions, including real Git diffs.
- Avoid unnecessary full-history checkouts where Git event topology permits; preserve conservative fallback for push/manual events.
- Keep docs and website checks fail-closed if changed-file enumeration fails.
- Preserve unrelated agent edits and existing stream/ci work.
- Validate focused contract tests, workflow syntax/policy, relevant CI mechanics, review/verify; publish through task -> stream PR only. Never merge main or deploy.

## Baseline (Oct 28, 2026; 250 recent GitHub runs)
- Consuelo CI PR median 115s, p90 199s (63 completed).
- OS Distribution PR median 229s, p90 299s (6 completed).
- Individual checkout steps consume 35-115s. Most wasteful jobs start for changes later classified irrelevant.
- Separate Swamp smoke regularly fails due upstream authentication requirement; not a reason to hide a failing check.

## Plan
1. Inspect fresh task source, relevant workflow policy/contract tests, changed-file planner.
2. Write red regression tests for deletion, shallow checkout PR topology, and changed-file API fail-safe behavior.
3. Implement bounded checkout, lightweight changed-file planning, and cautious dependency caching where evidence supports it.
4. Run focused green tests, workflow/security checks, review/verify. Check diff and record any quality tradeoffs.
5. Publish task into stream/ci and report exact SHA and review URL.

## Test-first contract
- Behavior: deleted tracked files trigger their owning CI lanes; change detection remains accurate for PR merge commits and GitHub compare/listFiles pages; unknown events or inaccessible API never skip relevant checks; shallow checkout supports the required diff graph.
- Existing pattern: packages/os/tests/ci-plan.test.ts, packages/workspace/tests/github-workflow-policy.test.js, packages/workspace/tests/run-changed-os-native-tests.test.mjs, existing GitHub Actions security checker.
- New/changed tests: extend CI planner contract with deleted-path integration; create focused reusable file-selection test if GitHub API classifier is introduced; update workflow policy tests to assert stable quality/security lanes and history depth policy.
- Focused red command: bun x vitest run packages/os/tests/ci-plan.test.ts packages/workspace/tests/github-workflow-policy.test.js (plus any added classifier test; run before production edits).
- Expected red: missing deletion-safe git filter, missing/incorrect shallow checkout or change-selection implementation, missing safe-fallback contracts.
- No-test waiver: none expected (test-first required).

## Initial task state
Task session tsk_f8b1bc4cada2; task branch task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage; startFrom main. No production changes yet.

- 2026-10-28 16:21:36 append: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`

## workspace-owned: files changed

- `.github/workflows/changed-files.yaml`
- `.github/workflows/ci-website.yaml`
- `packages/workspace/tests/github-changed-files.test.js`

## workspace-owned: activity log

- 2026-10-28 16:21:36 fs.write: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`
- 2026-10-28 16:24:07 fs.write: `packages/workspace/tests/github-changed-files.test.js`
- 2026-10-28 16:24:45 fs.write: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`
- 2026-10-28 16:26:08 fs.write: `.github/workflows/changed-files.yaml`
- 2026-10-28 16:27:55 fs.write: `.github/workflows/ci-website.yaml`
- 2026-10-28 16:32:28 fs.write: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`
- 2026-10-28 16:34:42 fs.write: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`

## workspace-owned: files read

- `.github/actions/bun-install/action.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `packages/dialer-server/Dockerfile`
- `packages/os/native/macos/Package.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/tests/ci-plan.test.ts`

## Test-first red evidence (2026-10-28)
- `bun x vitest run tests/ci-plan.test.ts` in packages/os: 10 pass, 1 expected red; newly added shallow-merge deletion test fails because `readChangedFiles` is not exported yet.
- `bun x vitest run tests/github-changed-files.test.js` in packages/workspace: 8 expected red; existing reusable workflow has no checkout-free GitHub API classifier.
- Only test files changed. Implementation can proceed against these executable contracts.
- OS facade `status` returned the ambient dirty main checkout even with top-level taskSession, while task-scoped `fs.read` and `code.call` resolve the isolated task worktree. Do not mutate ambient main; use explicit taskSession and task-scoped tools. Track this tooling inconsistency.

- 2026-10-28 16:24:45 append: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`

- 2026-10-28 16:25:03 apply-patch: `packages/os/scripts/ci-plan.ts`
- 2026-10-28 16:26:08 write: `.github/workflows/changed-files.yaml`

- 2026-10-28 16:27:18 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-10-28 16:27:32 apply-patch: `.github/workflows/consuelo-ci.yaml`
- 2026-10-28 16:27:40 apply-patch: `.github/workflows/ci-docs.yaml`
- 2026-10-28 16:27:55 write: `.github/workflows/ci-website.yaml`

- 2026-10-28 16:28:24 apply-patch: `.github/workflows/consuelo-os-distribution-environments.yaml`

- 2026-10-28 16:31:08 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-10-28 16:31:20 apply-patch: `.github/workflows/consuelo-ci.yaml`

- 2026-10-28 16:32:01 apply-patch: `packages/workspace/tests/github-changed-files.test.js`
- 2026-10-28 16:32:09 apply-patch: `packages/workspace/tests/github-changed-files.test.js`
## Implementation checkpoint (2026-10-28)
- Planner now uses `git diff --no-renames` so deleted paths and both sides of moves are included in ownership routing.
- Three core Consuelo diff jobs use two-commit PR checkouts; OS contracts, dialer, and Sites Gateway use one-commit checkout when no diff is needed.
- Reusable changed-file gate queries GitHub's PR files API or compare endpoint without checkout; fails to RUN (never silently skip) on unknown event, unsupported path pattern, missing comparison SHA, or file-cap saturation. API errors fail the gate.
- CI Docs and Consuelo Website reuse this cheap gate and retain their existing build/status names. Explicit PR read permissions added; redundant docs cancellation action removed (concurrency already cancels).
- Native distribution retains Linux/macOS/macOS-Intel/Windows, and full-history checkout only on non-PR events; explicit NATIVE_TEST_BASE/HEAD already drive selection, so redundant Nx SHA action removed.
- Focused green after initial edits: CI planner 11/11; changed-file API 8/8; workflow policy 11/11; native selector node:test 8/8. Additional checkout/deletion policy test red then patched green; final comprehensive rerun pending.
- New evidence: active dialer CI run #40725522175 took ~204s including 76s full checkout and 77s Docker build. Shallow checkout now targets its dominant non-build overhead; Docker build remains mandatory.
- Stream/ci is remote ancestor of main (0 ahead, 2822 behind); preserve unrelated stale task PR #1259 and handle stream promotion carefully.

- 2026-10-28 16:32:28 append: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 16:33:10 `audit`: failed — COMMAND_FAILED
- 2026-10-28 16:33:28 `review.run`: passed — OK
- 2026-10-28 16:33:31 `verify`: passed — OK

## Final validation and risks (2026-10-28)
- Focused: packages/os/tests/ci-plan.test.ts 11/11; workspace/github-changed-files.test.js 9/9; workspace/github-workflow-policy.test.js 12/12; node --test run-changed-os-native-tests.test.mjs 8/8.
- Security check with explicit CHANGED_FILES for all five modified GitHub workflows: passed, findings [].
- git diff --check: passed. Structured git.diff reviewed; 9 product/test files changed plus scoped metadata, no unrelated edits.
- review.run against origin/main with noTests=true: 0 blocking issues, 0 prior issues, 0 documentation opportunities; static/eslint/typecheck/spec-compliance passed.
- verify against origin/main: authoritative .task/ci/.../verify.json result=pass, publishValid=true; selected critical contracts passed (additional local server 20 tests, native Windows 27 tests, workflow policy, CI planner, native selector, security), DB guard passed. The compact facade response incorrectly reported passed=false despite an OK envelope and a full pass report; report this facade inconsistency, rely on full verifier evidence.
- audit scripts failed on pre-existing unrelated SCRIPTS.md drift: documented but missing railway:logs, railway:redeploy, research:ingest, tools:search; actual but undocumented docs:deploy, media:svg, os:release-workspace-edge, web:deploy. No touched script registry/docs in this task.
- Risk: Real GitHub Actions performance benefits must be measured after PR integration; current estimates are from baseline and checkout behavior, not verified new-run averages.
- Risk: GitHub upstream Swamp compatibility job remains failing due new upstream account-token requirement. No secrets changed in this task; separate owner follow-up.
- Risk: stream/ci is 2822 commits behind main, 0 ahead. Task started from current main to avoid old code; task.pr promotion must preserve unrelated stale PR #1259 and confirm stream PR shape.
- No changes to branch protection settings, no GitHub Actions cache added (uncertain restore overhead/cache poisoning tradeoffs without measurements).
- Do not merge stream into main or deploy. Publish task -> stream PR and capture commit SHA, new runs, remaining issues.

- 2026-10-28 16:34:42 append: `.task/ci/optimize-agent-ci-latency-while-strengthening-change-coverage/workpad.md`
