# release workflow

branch: `task/security/release-workflow`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1386/release-workflow
github pr: https://github.com/consuelohq/opensaas/pull/1386
started: 2026-07-10

## acceptance criteria

- [x] Every push to `main` runs one production release workflow without path filtering.
- [x] The workflow deploys the website first and then runs `bun run os:release`.
- [x] Manual dispatch supports `all`, `website`, and `os` targets while push-to-main always releases both.
- [x] Both release jobs use the existing `consuelo / production` GitHub environment.
- [x] `CLOUDFLARE_ACCOUNT_ID` is read from GitHub Actions variables, not secrets.
- [x] Website deployment maps only `CLOUDFLARE_PAGES_API_TOKEN` into the process-local `CLOUDFLARE_API_TOKEN` variable.
- [x] OS deployment maps only `CLOUDFLARE_OS_RELEASE_API_TOKEN` into the process-local `CLOUDFLARE_API_TOKEN` variable.
- [x] The runtime Worker token is not copied into GitHub and no legacy Cloudflare secret aliases remain in the release workflow.
- [x] No PAT or user-managed `GITHUB_TOKEN` secret is required; workflow permissions remain `contents: read`.
- [x] Wrangler is installed at a pinned version before the OS operator invokes it.
- [x] Existing local commands and their post-deploy verification behavior remain unchanged.
- [x] Workflow contract tests, release-script tests, syntax checks, review, and full verify pass.

## plan

1. Replace the website-only workflow with a production workflow that calls the existing website and OS release operators.
2. Extend the existing workflow contract test first and confirm it fails against the old workflow.
3. Use separate jobs and step-local token mappings so the Pages and OS deployment credentials never coexist in one process.
4. Preserve the existing OS operator's remote-secret preflight and live readiness checks.
5. Run focused workflow/release tests, YAML parsing, syntax checks, review, and verify.
6. Push and promote the task to `stream/security`.

## test-first contract

- Behavior under test: GitHub must release both production surfaces from `main` using dedicated credential names and the protected production environment.
- Existing local pattern: `packages/workspace/tests/website-deploy.test.js` reads workflow source and asserts exact credential mappings.
- Changed tests: assert the new workflow path, push/manual triggers, environment, target gating, ordered jobs, pinned Wrangler install, existing operator commands, variable usage, dedicated token mappings, and absence of legacy aliases/runtime-token coupling.
- Focused red command: `cd packages/workspace && bun vitest run tests/website-deploy.test.js`.
- Expected red failure: the new production workflow does not exist and the old workflow still references fallback secret aliases and secret-based account ID storage.

## current status

- Production release workflow and contract tests implemented.
- Strict review and full verify passed with a publish-valid stamp.
- Ready to push and promote to `stream/security`.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `.github/workflows/consuelo-website-deploy.yaml` (removed)
- `packages/workspace/tests/website-deploy.test.js`
- `.task/security/release-workflow/workpad.md`

## workspace-owned: files changed

- `.task/security/release-workflow/workpad.md`

## workspace-owned: activity log

- 2026-07-10 22:48:13 fs.write: `.task/security/release-workflow/workpad.md`

## workspace-owned: validation evidence

- 2026-07-10 22:52:34 `review.run`: passed — OK
- 2026-07-10 22:52:56 `verify`: passed — OK

## key decisions

- Keep release behavior in `bun run website:deploy` and `bun run os:release`; GitHub only orchestrates them.
- Run the OS release after the website release on push-to-main, while allowing either target manually.
- Use `vars.CLOUDFLARE_ACCOUNT_ID`, `secrets.CLOUDFLARE_PAGES_API_TOKEN`, and `secrets.CLOUDFLARE_OS_RELEASE_API_TOKEN` only.
- Map each dedicated token to Wrangler's expected `CLOUDFLARE_API_TOKEN` name at the individual deploy step.
- Pin the CI Wrangler installation to the version currently locked by the website package: `4.105.0`.
- Do not add GitHub release/tag behavior or a personal access token.

## notes for ko

- Secret values were not read, printed, logged, or committed. Only exact secret and variable names are used.
- The OS operator already fails unless the deployed Worker's runtime secret exists and `/health` reports connector provisioning ready.
- Red evidence: after fixing the existing test harness to use `node:child_process`, the workflow contract failed because the legacy workflow still existed.
- Green evidence: workflow contract 3/3; OS release contract 7/7; YAML parse/semantic checks passed; changed-workflow security policy passed; OS syntax checks passed.
- `actionlint` is not installed in the local toolchain; YAML parsing and the repository's workflow-security checker provide static workflow validation.
- Strict review reported zero issues; full verify passed and recognized the added workflow, removed legacy workflow, and updated contract test.
- Verify's registry selector reported zero mapped suites; the explicit 10 focused tests supply behavioral evidence.

## improvements noticed

- Legacy CI removal remains a separate approved task after this workflow is promoted.

## issues and recovery

- The first contract-test edit contained an unescaped `/` in a regular expression; corrected it before accepting red evidence.
- Existing tests used `Bun.spawnSync` under Node-hosted Vitest and failed with `Bun is not defined`; replaced it with `node:child_process.spawnSync` without changing tested behavior.
- The workflow-security script normally inspects committed `base...HEAD`; for the uncommitted task diff it was run with explicit `CHANGED_FILES` containing the added and removed workflows.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-10 22:48:13 write: `.task/security/release-workflow/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/tests/website-deploy.test.js`

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-production-release.yaml`, `.github/workflows/consuelo-website-deploy.yaml`, `.task/security/release-workflow/current.json`, `.task/security/release-workflow/evidence-log.json`, `.task/security/release-workflow/read-log.json`, `.task/security/release-workflow/session.json`, `.task/security/release-workflow/workpad.md`, `.task/tasks/security/release-workflow.json`, `packages/workspace/tests/website-deploy.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
