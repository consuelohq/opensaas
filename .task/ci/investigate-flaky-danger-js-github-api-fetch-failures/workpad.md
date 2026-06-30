# Investigate flaky danger-js GitHub API fetch failures

branch: `task/ci/investigate-flaky-danger-js-github-api-fetch-failures`
stream: `stream/ci`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1224/investigate-flaky-danger-js-github-api-fetch-failures
github pr: https://github.com/consuelohq/opensaas/pull/1224
started: 2026-06-27

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Workflow retry mitigation implemented, validated locally, verify stamp written, pending push.

## files changed

- `.github/workflows/ci-utils.yaml`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- `ruby -e require_yaml_load_file`: pass
- `bash -n /tmp/danger-ci-retry-block.sh`: pass
- Regex fixture classification: pass
- 2026-06-27 20:30:14 `review.run`: passed — OK
- 2026-06-27 20:30:15 `review.run`: passed — OK
- 2026-06-27 20:33:12 `verify`: failed — COMMAND_FAILED
- 2026-06-27 20:33:12 `verify`: failed — COMMAND_FAILED

## key decisions

- Use workflow-local retry rather than broad Danger suppression or media rollback.

## notes for ko

- Failure was operational. It can recur when GitHub returns a prematurely closed compressed response while Danger is fetching PR metadata.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(ci): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [x] The failed Danger run 28300393618 is fully inspected.
- [x] The exact workflow/job file that runs Danger is identified.
- [x] The exact package/script that maps to `nx danger:ci` is identified.
- [x] The DangerJS package/version and transitive fetch client are identified.
- [x] The failure mode is classified: known flake, version bug, large PR diff issue, GitHub API issue, or repo config issue.
- [x] If fixable, propose or implement a narrow mitigation.
- [x] If repo fix is not appropriate, propose a documented rerun policy or workflow retry strategy.
- [x] Any code change has focused validation, or at minimum reproducible workflow/config validation.
- [x] Media code remains untouched unless investigation proves media-specific causality.

## Test-first contract

Behavior under test: operational classification and workflow hardening for transient Danger/GitHub API fetch failures.
Existing pattern to follow: repo CI workflow and twenty-utils package scripts; prefer workflow/script validation over media tests.
New or changed tests: deferred until failure mode is classified. If a workflow/script change is made, validate syntax/config and the exact script behavior where possible.
Focused red command: none yet; investigation-first task with no production behavior change.
Expected red failure: not applicable before classification.
No-test waiver: active for read-only investigation. Any implementation will add matched validation before push.

## Investigation log

- Started from main via task session `tsk_10ae1d9347dc` on branch `task/ci/investigate-flaky-danger-js-github-api-fetch-failures`.
- Scope boundary: do not modify media code; inspect failed Danger run and CI configuration first.


- 2026-06-27 20:24:44 apply-patch: `.github/workflows/ci-utils.yaml`

## Investigation findings

- Failed run inspected: GitHub Actions run 28300393618, workflow `CI Utils`, event `pull_request_target`, head branch `stream/media`, head SHA `7242d7aa85e715776356f09a7ff45b05538d9e64`, conclusion `failure`.
- Failed job inspected: job 83847586011, name `danger-js`, run attempt 1, started 2026-06-27T20:08:47Z and completed 2026-06-27T20:09:48Z.
- Log evidence: `cd packages/twenty-utils && npx nx danger:ci` ran `danger ci --use-github-checks --failOnErrors`; Danger failed while fetching GitHub PR metadata from `pulls/1221/files?page=1&per_page=100` and `pulls/1221/commits` with `FetchError: Invalid response body while trying to fetch ... Premature close`, `code: ERR_STREAM_PREMATURE_CLOSE`, from `node-fetch/lib/index.js:400`.
- Classification: transient GitHub API/body stream failure exposed by a DangerJS client retry weakness. The failure happened before repo Danger rules could evaluate. It is not evidence of media code causality.
- Large PR assessment: PR 1221 was moderate size, 30 changed files, +1530/-9, so this was not an obvious diff-size or pagination limit case.
- Workflow location: `.github/workflows/ci-utils.yaml`, job `danger-js`, step `Utils / Run Danger.js`.
- Script mapping: `packages/twenty-utils/package.json` script `danger:ci` is `danger ci --use-github-checks --failOnErrors`; Nx infers `twenty-utils:danger:ci` via `nx:run-script`. No `packages/twenty-utils/project.json` exists.
- Version evidence: installed `danger` is 13.0.5; installed transitive root `node-fetch` is 2.7.0; Danger depends on `node-fetch ^2.6.7` and `async-retry 1.2.3`.
- Danger internals: `danger/distribution/api/fetch.js` retries HTTP response acquisition and HTTP 401/5xx statuses, but the observed body decode failure occurs later during `response.json()` in `danger/distribution/platforms/github/GitHubAPI.js`, so it is not retried by Danger 13.0.5.
- Upstream check: Danger 13.0.10 exists and changed fetch-related files, including a move from `node-fetch` toward `undici`, but I did not find evidence that a dependency update alone would safely and specifically solve this repo's observed failure. The implemented mitigation is workflow-local and lower blast radius.

## Implemented mitigation

- Updated only `.github/workflows/ci-utils.yaml` for the pre-merge `danger-js` job.
- The job now retries `npx nx danger:ci` up to three attempts only when the captured output matches known transient GitHub metadata fetch/body stream failures: `ERR_STREAM_PREMATURE_CLOSE`, the exact GitHub API premature-close body-read shape, `Failed to fetch GitHub pull request files`, or `Failed to fetch pull request diff`.
- Non-transient Danger failures exit with the original status immediately. Final transient failure after the last attempt still fails the job.
- Did not modify media code. Did not suppress Danger globally. Did not change branch protection.

## Validation evidence

- `ruby -e require_yaml_load_file`: pass; `.github/workflows/ci-utils.yaml` loads as YAML.
- Extracted workflow bash block and ran `bash -n /tmp/danger-ci-retry-block.sh`: pass.
- Static checks on extracted block: contains `npx nx danger:ci`, `PIPESTATUS[0]`, transient pattern, and non-transient `exit "$status"`: pass.
- Regex classification fixture: matches files premature close and commits premature close; does not match a sample Danger rule failure or generic failure: pass.

## Review and additional validation

- `git diff --check` in task worktree: pass.
- `review.run --base origin/stream/ci`: yourIssues 0, mustFixTotal 0. Reported blockingIssues 3 and preExistingIssues 85 are pre-existing/global findings, not attributed to this workflow patch. Review output also showed unrelated failing suites in api, dialer, and twenty-server as pre-existing/global context.
- Direct task worktree status before push: modified `.github/workflows/ci-utils.yaml`; task metadata/workpad present under `.task/ci` and `.task/tasks/ci`.


## workspace-owned: test selection

- changed files: `.github/workflows/ci-utils.yaml`, `.task/ci/investigate-flaky-danger-js-github-api-fetch-failures/current.json`, `.task/ci/investigate-flaky-danger-js-github-api-fetch-failures/session.json`, `.task/ci/investigate-flaky-danger-js-github-api-fetch-failures/workpad.md`, `.task/tasks/ci/investigate-flaky-danger-js-github-api-fetch-failures.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Verify gate

- Initial full verify failed because unrelated global test suites failed and workflow-only changes selected zero test suites. Review still reported yourIssues 0 and mustFixTotal 0.
- Reran verify with supported review argument `--no-tests` after workflow-specific validation. Captured stdout reported review pass, db guard pass, and publish-valid stamp written.
- Verified stamp file directly: `.task/ci/investigate-flaky-danger-js-github-api-fetch-failures/verify.json` exists with `publishValid: true`, changedFiles [`.github/workflows/ci-utils.yaml`], review passed, db passed.

