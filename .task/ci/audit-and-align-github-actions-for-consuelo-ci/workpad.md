# Audit and align GitHub Actions for Consuelo CI

## Acceptance criteria

- Inventory every GitHub Actions workflow and job.
- Identify inherited Twenty checks that are misleading, obsolete, or not Consuelo-relevant.
- Identify missing Consuelo-specific gates for OS, dialer, Sites Gateway, Cloudflare/security, workspace tooling, and deploys.
- Map local validation commands to CI equivalents.
- Propose PR-blocking, merge/main, deploy, and scheduled/manual check lanes.
- Recommend which checks should become required status checks.
- Do not remove inherited workflows until replacements exist.
- Implement only the safest additive first step, or stop with an alignment doc if the blast radius is too high.

## Evidence gathered

- Counted 26 GitHub Actions workflow files under `.github/workflows`.
- Parsed workflow names, triggers, jobs, permissions, reusable actions, run commands, and path filters.
- Reviewed root package scripts and package scripts for Consuelo-specific local validation.
- Reviewed `packages/workspace/scripts/verify.js` and `packages/workspace/test-selection.rules.json`.
- Reviewed changed-file filters and permission posture for high-risk workflows.

## Key findings

- The inherited workflow set is useful but package-oriented around Twenty package names.
- Consuelo OS, workspace/task/verify gates, dialer, Sites Gateway, Cloudflare route/worker contracts, and workflow security are not first-class GitHub Actions lanes.
- `verify` is the strongest existing template for Consuelo-native CI. It combines review, affected test-selection, and DB/API guardrails.
- `packages/workspace/test-selection.rules.json` already contains explicit critical rules for workspace facade, publish gate, task session, test selection, dialer package, API package, and server changes.
- `.github/workflows/ci-website.yaml` appears misaligned: it filters/builds `packages/twenty-website`, while the current Consuelo website package is `packages/consuelo-website`.
- `pull_request_target` workflows are legitimate risk hot spots and should be kept narrow.

## Change made

Created `.github/CI_ALIGNMENT.md` as the durable alignment map and rollout plan.

No workflow behavior was changed in this task. This is intentional: the safest first step is alignment evidence, then a manual-only Consuelo verify workflow in a follow-up PR.

## Validation plan

- Markdown/documentation review.
- `git diff --check`.
- Workspace review/verify with docs-only/no-tests path if available.

## workspace-owned: validation evidence

- 2026-06-27 23:22:21 `verify`: failed — COMMAND_FAILED
- 2026-06-27 23:22:21 `verify`: failed — COMMAND_FAILED
- 2026-06-27 23:25:17 `verify`: failed — COMMAND_FAILED
- 2026-06-27 23:25:17 `verify`: failed — COMMAND_FAILED
- 2026-06-27 23:28:12 `review.run`: passed — OK

## workspace-owned: test selection

- changed files: `.github/CI_ALIGNMENT.md`, `.task/ci/audit-and-align-github-actions-for-consuelo-ci/current.json`, `.task/ci/audit-and-align-github-actions-for-consuelo-ci/session.json`, `.task/ci/audit-and-align-github-actions-for-consuelo-ci/verify.json`, `.task/ci/audit-and-align-github-actions-for-consuelo-ci/workpad.md`, `.task/tasks/ci/audit-and-align-github-actions-for-consuelo-ci.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata

## Validation evidence

- Alignment document coverage check passed: all 26 workflow files under `.github/workflows` are represented in `.github/CI_ALIGNMENT.md`.
- Key Consuelo CI lane terms are present: `Consuelo / verify`, `Consuelo / OS contracts`, `Consuelo / dialer`, `Consuelo / Sites Gateway + Cloudflare`, `Consuelo / website`, workflow security, `pull_request_target`, `packages/consuelo-website`, and `packages/twenty-website`.
- `git diff --check` passed.
- `verify` with full tests could not produce a publish-valid stamp because the typed verify facade does not expose the `--no-tests` review path and therefore ran unrelated pre-existing API, dialer, and server suites. The failures were outside this docs-only change.
- The failed full verify still produced useful evidence for this change: current-change review issues were 0, `mustFixTotal` was 0, DB guard passed with 0 risks/findings, and test-selection passed with zero suites because the changed files are docs/task metadata.
- Explicit `review.run` with `noTests: true` against `origin/stream/ci` passed for the docs-only change with `yourIssues=0`, `failedTestSuites=0`, `blockingIssues=0`, and `mustFixTotal=0`.

## Publish note

This task uses the approved push path because the docs-only alignment change is validated, but the full verify stamp is blocked by pre-existing unrelated suites that the typed verify facade cannot skip. The next CI tooling follow-up should expose a safe docs-only/no-tests verify mode or make the typed verify facade forward review arguments explicitly.
