# Fix Consuelo website main release workflow

## Acceptance criteria

- Main pushes no longer use inherited Twenty release dispatch wiring.
- The repo no longer contains the production/tag workflows that dispatch to `twentyhq/twenty-infra` using `TWENTY_INFRA_TOKEN`.
- The repo no longer contains inherited Twenty preview-environment dispatch/keepalive workflows.
- Main website release uses the repo-owned `website:deploy` script for `packages/consuelo-website` and Cloudflare Pages credentials.
- Validation proves the workflow parses and the deploy script builds in build-only mode.

## Test-first contract

Behavior under test: release workflows should express Consuelo-owned website deployment, not inherited Twenty repository dispatch. Since this is release orchestration, validation is static workflow inspection plus build-only deploy-script execution rather than a unit test.

Validation plan:

- Static search for blocked inherited release patterns.
- Node syntax checks for duplicated `website-deploy.js` scripts.
- YAML parse for the new workflow.
- `git diff --check`.
- `bun run website:deploy -- --build-only --json`.
- `bun test packages/consuelo-website/tests/website-structure.test.js`.

## Implementation notes

- Deleted inherited external release dispatch workflows for main and tags.
- Deleted inherited Twenty preview environment dispatch/keepalive workflows.
- Added `.github/workflows/consuelo-website-deploy.yaml`, which uses `website:deploy` and Cloudflare Pages env.
- Hardened both workspace and OS copies of `website-deploy.js` to build with Bun, deploy with `bunx wrangler`, and fail clearly when `CLOUDFLARE_API_TOKEN` is missing.

## workspace-owned: validation evidence

- 2026-06-28 05:14:49 `review.run`: passed — OK
- 2026-06-28 05:15:57 `verify`: passed — OK

## Validation results

- Static inherited release pattern check passed for workflows and deploy scripts.
- `node --check packages/workspace/scripts/website-deploy.js` passed.
- `node --check packages/os/scripts/website-deploy.js` passed.
- `ruby -e 'require "yaml"; YAML.load_file(...)' .github/workflows/consuelo-website-deploy.yaml` passed.
- `git diff --check` passed.
- `bun run website:deploy -- --build-only --json` passed.
- `bun test packages/consuelo-website/tests/website-structure.test.js` passed: 14 tests, 271 assertions.
- `review.run --no-tests` passed: 0 blocking issues.

## Notes for Ko

This intentionally removes the inherited third-party repository dispatch and Twenty preview workflows instead of restoring their secrets. If Cloudflare credentials are absent, the new release path fails with a direct Consuelo/Cloudflare secret error, not a misleading Twenty infra auth error.

## workspace-owned: test selection

- changed files: `.github/workflows/cd-deploy-main.yaml`, `.github/workflows/cd-deploy-tag.yaml`, `.github/workflows/consuelo-website-deploy.yaml`, `.github/workflows/preview-env-dispatch.yaml`, `.github/workflows/preview-env-keepalive.yaml`, `.task/release/fix-consuelo-website-main-release-workflow/current.json`, `.task/release/fix-consuelo-website-main-release-workflow/session.json`, `.task/release/fix-consuelo-website-main-release-workflow/workpad.md`, `.task/tasks/release/fix-consuelo-website-main-release-workflow.json`, `packages/os/scripts/website-deploy.js`, `packages/workspace/scripts/website-deploy.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
