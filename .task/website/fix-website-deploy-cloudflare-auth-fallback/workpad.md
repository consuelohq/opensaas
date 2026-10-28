# fix website deploy cloudflare auth fallback

branch: `task/website/fix-website-deploy-cloudflare-auth-fallback`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1297/fix-website-deploy-cloudflare-auth-fallback
github pr: https://github.com/consuelohq/opensaas/pull/1297
started: 2026-06-30

## acceptance criteria

- [x] Local `bun run website:deploy` can deploy with an existing Wrangler login when `CLOUDFLARE_API_TOKEN` is absent, matching `os:release` behavior.
- [x] CI keeps requiring explicit Cloudflare token auth and emits a useful error if no supported secret is configured.
- [x] GitHub Actions deploy workflow accepts the existing canonical secret names and common fallback names without code changes.
- [x] Focused regression tests cover local-tokenless fallback, CI missing-token failure, and workflow fallback secret names.
- [x] Build/static validation proves the website deploy script and workflow syntax remain usable.

## test-first contract

Behavior under test:
- In local/non-CI mode, missing `CLOUDFLARE_API_TOKEN` should not abort before Wrangler runs.
- In CI/GitHub Actions mode, missing `CLOUDFLARE_API_TOKEN` should abort before deploy with an explicit secret message.
- Workflow env should pass canonical Cloudflare secret names plus fallback names into the deploy step.

Existing pattern to follow:
- Workspace tests use Vitest under `packages/workspace/tests` and spawn real scripts for CLI behavior where useful.
- Existing OS release scripts rely on Wrangler's own auth resolution instead of prechecking tokens.

New tests:
- Add `packages/workspace/tests/website-deploy.test.js` with a fake `bunx` on PATH and `--skip-build --json` so no real Cloudflare deploy occurs.

Focused red command:
- `cd packages/workspace && bun test tests/website-deploy.test.js`

Expected red failure before implementation:
- Local tokenless deploy test exits 1 with `CLOUDFLARE_API_TOKEN is required...` before fake `bunx` is invoked.

## plan

1. Add the focused regression tests first and run them red.
2. Patch `website-deploy.js` to distinguish local Wrangler-auth fallback from CI token requirement.
3. Patch the GitHub workflow env to use canonical secrets plus fallbacks.
4. Run focused tests, script help/build-only smoke, workflow parse smoke, review, and verify.

## current status

- Fix implemented. Validation passed against `origin/main`. The website stream is stale, so this task should be reviewed/merged against `main` rather than promoted through `stream/website`.

## files changed

- `.github/workflows/consuelo-website-deploy.yaml`
- `packages/workspace/scripts/website-deploy.js`
- `packages/workspace/tests/website-deploy.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Read current deploy script and workflow.
- Confirmed current deploy script aborts before Wrangler when token is absent.

## workspace-owned: validation evidence

- RED: `cd packages/workspace && bun test tests/website-deploy.test.js` failed before implementation: local tokenless deploy exited 1 before fake `bunx`; CI error was generic.
- GREEN: `cd packages/workspace && bun test tests/website-deploy.test.js` passed: 3 tests, 8 assertions.
- Script smoke: `bun packages/workspace/scripts/website-deploy.js --help` passed.
- Script smoke: `bun packages/workspace/scripts/website-deploy.js --skip-build --build-only` passed.
- Workflow env expression check passed by grep because `actionlint` is not installed locally.
- `git diff --check` passed.
- `cd packages/consuelo-website && bun run build` passed with existing Astro hints.
- `review.run --scope owned --base origin/main --noTests` passed with 0 findings.
- `verify --base origin/main --no-stamp` passed; publishValid true.
- 2026-06-30 21:44:12 `review.run`: passed — OK
- 2026-06-30 21:44:12 `review.run`: passed — OK
- 2026-06-30 21:47:58 `review.run`: passed — OK
- 2026-06-30 21:48:11 `verify`: passed — OK

## key decisions

- Do not remove CI token enforcement. Local ergonomics and CI security should differ intentionally.
- Let Wrangler own local auth resolution, as the OS release scripts already do.
- Add fallback GitHub secret names: `CF_ACCOUNT_ID`, `CLOUDFLARE_PAGES_API_TOKEN`, and `CF_API_TOKEN`.
- Use `origin/main` as review/verify base. `stream/website` is stale and lacks the current deploy workflow, so reviewing against it produces unrelated historical findings.

## notes for ko

- This should make local website deploy behave like the OS release scripts while keeping GitHub deterministic.

## improvements noticed

- `on.push.paths` includes `packages/os/scripts/website-deploy.js`, which does not appear to exist. Left out of initial scope unless validation flags it.

## issues and recovery

- Python workflow parse check failed because `yaml` is not installed. Recovered with static grep checks for the exact workflow expressions.
- Initial `review.run` against `origin/stream/website` produced a huge unrelated delta because the task branch starts from `origin/main` and the website stream is stale. Re-ran review/verify against `origin/main`, which is the actual deploy workflow base.

---

## publish checklist

```bash
bun run task:push -- --message "fix(website): support local cloudflare deploy auth fallback" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-website-deploy.yaml`, `.task/tasks/website/fix-website-deploy-cloudflare-auth-fallback.json`, `.task/website/fix-website-deploy-cloudflare-auth-fallback/current.json`, `.task/website/fix-website-deploy-cloudflare-auth-fallback/session.json`, `.task/website/fix-website-deploy-cloudflare-auth-fallback/workpad.md`, `packages/workspace/scripts/website-deploy.js`, `packages/workspace/tests/website-deploy.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## wait plan: PR checks

Wait reason: GitHub checks for PR #1297 started after retargeting the PR to `main`.
Duration: poll every 20s for up to 3 attempts.
Resume action: run `github pr.checks` for PR #1297 immediately after each wait.
Expected signal: pending count reaches 0 and failed count remains 0.
Fallback: report pending/failed checks explicitly and do not merge blindly.

## PR check follow-up

- PR #1297 was retargeted from stale `stream/website` to `main` because the deploy workflow being fixed exists on `main`.
- Initial PR checks finished with `danger-js` failed and no other failures. Danger log showed transient GitHub API metadata fetch failures: `ERR_STREAM_PREMATURE_CLOSE` while fetching PR files/commits.
- Reran failed jobs for run `28478148766`.
- Post-rerun check observed `danger-js` in progress, with 0 failed and 1 pending. A longer polling command hit the workspace wrapper timeout after the first attempt; direct check after that still showed `danger-js` in progress.
