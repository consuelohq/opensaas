# Implement Consuelo CI workflow phases

## Acceptance criteria

- Delete `.github/CI_ALIGNMENT.md`.
- Add Consuelo-owned CI workflow support for manual dispatch, pull requests, and merge groups.
- Replace inherited website CI so it builds `packages/consuelo-website` instead of `packages/twenty-website`.
- Add stable Consuelo job names for verify, workflow review, workspace contracts, OS contracts, dialer, Sites Gateway + Cloudflare, and website.
- Preserve inherited Twenty workflows unless this task replaces an incorrect Consuelo surface.

## Test-first contract

Behavior under test:
- Workflow YAML parses.
- Alignment markdown file is removed.
- Consuelo workflow has manual, pull_request, and merge_group triggers.
- Consuelo workflow exposes stable product-surface job names.
- Website workflow references `packages/consuelo-website` and does not reference `packages/twenty-website`.
- Workflow review script runs locally against the task diff.

Existing pattern:
- Existing workflows use checkout, `.github/actions/yarn-install`, minimal read permissions, concurrency, and status jobs.

Validation plan:
- Static workflow assertions.
- Ruby YAML parse for changed workflows.
- Local workflow review script execution.
- Website build when feasible.
- review.run and verify.

No-test waiver:
- GitHub Actions behavior cannot be fully executed locally here. Static workflow assertions plus local script/package validation replace a live Actions run.

## Implementation notes

Branch-protection required-status settings are repository settings, not normal PR code unless a checked-in branch-protection config exists. This PR implements stable check names that can be selected as required checks after the workflow lands.

## workspace-owned: validation evidence

- 2026-06-27 23:49:54 `review.run`: passed — OK


## Implementation summary

- Deleted `.github/CI_ALIGNMENT.md`.
- Added `.github/workflows/consuelo-ci.yaml` with manual dispatch, pull_request, and merge_group support.
- Added stable Consuelo check names:
  - `Consuelo / verify`
  - `Consuelo / workflow security`
  - `Consuelo / workspace contracts`
  - `Consuelo / OS contracts`
  - `Consuelo / dialer`
  - `Consuelo / Sites Gateway + Cloudflare`
- Replaced `.github/workflows/ci-website.yaml` so it validates `packages/consuelo-website` and no longer references `packages/twenty-website`.
- Added `packages/workspace/scripts/ci/check-github-workflows.cjs` for changed-workflow review in CI.

## Validation results

- Static workflow assertions passed:
  - alignment doc removed
  - Consuelo workflow has manual, pull_request, and merge_group triggers
  - stable Consuelo job names are present
  - workflow output references are expression-safe
  - website workflow targets `packages/consuelo-website` and does not mention `twenty-website`
  - website workflow uses standalone Bun package flow
- Ruby YAML parse passed for `.github/workflows/consuelo-ci.yaml` and `.github/workflows/ci-website.yaml`.
- `node --check` passed for `packages/workspace/scripts/ci/check-github-workflows.cjs`.
- Local changed-workflow review script passed against task changed files.
- `git diff --check` passed.
- `bun run --cwd packages/consuelo-website build` passed. Existing Astro/TypeScript warnings/hints were emitted, but there were 0 errors and the build completed successfully.
- Workspace review passed via `bun run review -- --base origin/stream/ci --summary-json --quiet --no-tests`: current-change issues 0, blocking issues 0.
- Verify script passed via `bun run verify -- --base origin/stream/ci --review-arg --no-tests`: review pass, DB guard pass, test-selection selected 0 suites and wrote a publish-valid stamp.

## Tooling note

The verify command was accidentally invoked through `code.call` in read mode. The script itself passed and wrote `.task/ci/implement-consuelo-ci-phases/verify.json`; the workspace wrapper reported the call as failed only because verify mutates the task stamp. The stamp is intentionally retained for publish.
