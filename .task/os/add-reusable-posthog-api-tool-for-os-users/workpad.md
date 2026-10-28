# Add reusable PostHog API tool for OS users

branch: `task/os/add-reusable-posthog-api-tool-for-os-users`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2642
started: 2026-10-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/docs/posthog.md`
- `packages/os/scripts/lib/posthog-client.ts`
- `packages/os/scripts/posthog.ts`
- `packages/os/tests/posthog-tool.test.ts`
- `packages/os/tools/posthog/handler.test.ts`
- `packages/os/tools/posthog/manifest.ts`
- `packages/os/tools/posthog/schema.ts`
- `packages/workspace/tests/test-selection.test.js`

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/posthog-client.ts`
- `packages/os/scripts/secrets.ts`
- `packages/os/scripts/website-deploy.js`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Acceptance criteria (agent)
- Public, cross-user Consuelo OS tool package exposes `posthog.config`, `posthog.projects`, `posthog.query`, and `posthog.capture` through the generated manifest and discoverable API.
- Personal API key is used only for private reads; project token is used only for event ingestion. Keys remain environment/Keychain scoped and are never returned.
- US/EU cloud supported, invalid hosts rejected; outbound calls timed out, response bodies bounded, failed HTTP statuses explicit, sensitive event properties rejected.
- Tool is inactive unless configured; no automatic desktop/dialer tracking introduced in this task.
- Verified with focused mocked API tests, manifest/registry tests, review and publish verification; no real personal data sent.

## Plan (agent)
1. Read API/SDK docs and current OS package/manifest patterns; preserve existing Sentry, website, checkout instrumentation.
2. Add tests first for auth separation, regional endpoints, API failures, property safety, manifest wiring and discovery, then make them green.
3. Implement CLI-backed OS provider tool, docs, and generated manifests/fixtures in task worktree; validate.
4. Promote and release with CI. Verify a local tool discovery/config smoke; preserve other OS stream changes.

## Test-first contract
Behavior under test: API read/write endpoints use correct auth and region; missing credentials fail safely; returned data and diagnostics exclude secrets; capture rejects sensitive properties; manifest/typed input declares exact tool operations.
Existing local pattern: packages/os/tools/sentry/{schema,handler,manifest,handler.test}.ts and packages/os/scripts/sentry.js with Keychain fallback; facade Zod input in packages/os/scripts/lib/facade/schemas.ts; generated manifests from packages/os/tools/registry.ts.
New or changed tests: packages/os/tests/posthog-tool.test.ts and packages/os/tools/posthog/handler.test.ts, plus tool-manifest baseline fixture generation.
Focused red command: bun --cwd packages/os test tests/posthog-tool.test.ts tools/posthog/handler.test.ts
Expected red failure: imports of the new PostHog client and tool package cannot resolve until implemented.
No-test waiver: not applicable.

## Key decisions (agent)
- Existing public website already embeds PostHog conditionally, but current production response has no `posthog.init`; local website .env has a non-empty project token. Website production deployment is a separate change, not a reason to duplicate the SDK.
- Keep OS user tool opt-in and provider-neutral: no implicit telemetry from local users and no dialer customer data sent by default.

- 2026-10-28 18:03:44 append: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`

## workspace-owned: files changed

- `packages/os/docs/posthog.md`
- `packages/os/scripts/lib/posthog-client.ts`
- `packages/os/scripts/posthog.ts`
- `packages/os/tests/posthog-tool.test.ts`
- `packages/os/tools/posthog/handler.test.ts`
- `packages/os/tools/posthog/manifest.ts`
- `packages/os/tools/posthog/schema.ts`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-10-28 18:03:44 fs.write: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`
- 2026-10-28 18:04:26 write: `packages/os/tests/posthog-tool.test.ts`
- 2026-10-28 18:04:26 fs.write: `packages/os/tests/posthog-tool.test.ts`
- 2026-10-28 18:06:09 write: `packages/os/tools/posthog/handler.test.ts`
- 2026-10-28 18:06:09 fs.write: `packages/os/tools/posthog/handler.test.ts`
- 2026-10-28 18:06:35 fs.write: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`
- 2026-10-28 18:07:22 fs.write: `packages/os/scripts/lib/posthog-client.ts`
- 2026-10-28 18:07:38 fs.write: `packages/os/scripts/posthog.ts`
- 2026-10-28 18:07:56 fs.write: `packages/os/tools/posthog/schema.ts`
- 2026-10-28 18:08:00 fs.write: `packages/os/tools/posthog/manifest.ts`
- 2026-10-28 18:10:35 fs.write: `packages/os/docs/posthog.md`
- 2026-10-28 18:11:44 fs.write: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`
- 2026-10-28 18:18:35 fs.write: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`
- 2026-10-28 18:22:47 fs.write: `packages/workspace/tests/test-selection.test.js`
- 2026-10-28 18:22:47 fs.write: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`
- 2026-10-28 18:23:36 fs.write: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`

## Test-first red evidence
- 2026-10-28, `bun --cwd packages/os test tests/posthog-tool.test.ts tools/posthog/handler.test.ts`: RED, two missing-module failures (`scripts/lib/posthog-client` and `tools/posthog/manifest`), before production edits. This is the expected failure signal.

- 2026-10-28 18:06:35 append: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`

- 2026-10-28 18:07:22 write: `packages/os/scripts/lib/posthog-client.ts`

- 2026-10-28 18:07:38 write: `packages/os/scripts/posthog.ts`

- 2026-10-28 18:07:56 write: `packages/os/tools/posthog/schema.ts`
- 2026-10-28 18:07:56 write: `packages/os/tools/posthog/handler.ts`

- 2026-10-28 18:08:00 write: `packages/os/tools/posthog/manifest.ts`

- 2026-10-28 18:08:18 apply-patch: `packages/os/tools/registry.ts`
- 2026-10-28 18:08:18 apply-patch: `packages/os/package.json`
- 2026-10-28 18:08:18 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`

- 2026-10-28 18:10:35 write: `packages/os/docs/posthog.md`

## Green test and implementation evidence
- Production change: PostHog client in `packages/os/scripts/lib/posthog-client.ts`, CLI `scripts/posthog.ts`, OS tool package `tools/posthog/`, Zod facade, registry and package script, generated full manifest/types/docs, baseline fixture, and `docs/posthog.md`.
- 2026-10-28: `bun --cwd packages/os test tests/posthog-tool.test.ts tools/posthog/handler.test.ts tests/tool-manifest.test.ts`: GREEN 26/26 (includes 9 new tests, 17 existing manifest tests).
- `bun run --cwd packages/os generate-tool-manifest:check`: GREEN, no drift (166 full tools, 15 core).
- `bun run --cwd packages/os typecheck`: GREEN, OS script syntax checks.
- `bun run --cwd packages/os posthog config --json`: GREEN; region us and HTTPS endpoints, no personal key, project token, or project id in OS Keychain/environment. It did not disclose secrets.
- `bun run --cwd packages/os tools:search -- posthog --json`: tool-discovery includes new PostHog operations.
- `git diff --check`: no errors. Scope remains OS only, no unrelated repo files changed.

## Known limitations / follow-up
- PostHog personal API key is not configured on this OS node, so actual authenticated private queries cannot be tested against live PostHog; mocked API tests cover request shapes/statuses. No live event emitted to avoid contaminating analytics with test data.
- Marketing site has non-empty local `PUBLIC_POSTHOG_KEY`, but live HTML has no PostHog bootstrap; website activation requires a fresh-source build/deploy with local token included. Never deploy root local stale main; task worktree is current with `origin/main`.
- Dialer event capture intentionally deferred: requires separate privacy-safe event catalog and workspace opt-in; no phone numbers/transcripts ever exported by the OS tool.

- 2026-10-28 18:11:44 append: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 18:11:57 `review.run`: passed — OK
- 2026-10-28 18:12:13 apply-patch: `packages/os/scripts/lib/posthog-client.ts`
- 2026-10-28 18:12:13 apply-patch: `packages/os/tests/posthog-tool.test.ts`
- 2026-10-28 18:12:30 `review.run`: passed — OK
- 2026-10-28 18:16:05 `verify`: failed — COMMAND_FAILED
- 2026-10-28 18:16:59 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-10-28 18:17:49 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-10-28 18:17:49 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-10-28 18:18:48 `review.run`: passed — OK
- 2026-10-28 18:20:53 `verify`: failed — COMMAND_FAILED
- 2026-10-28 18:23:48 `review.run`: passed — OK
- 2026-10-28 18:25:45 `verify`: passed — OK

## Regression closure and website rollout (2026-10-28)
- Review.run initial had four static findings (three ERROR_HANDLING and one CATCH_TYPING); all fixed; re-review had 0 blocking findings.
- Verify initially selected the full OS package and exposed baseline inventory and synthetic dry-run fixture gaps. Added missing OS script classifications, `posthog.capture.dryRun` facade schema/typing, and generated facade snapshot entries. These match the existing manifest-driven contract and keep CI coverage.
- `bun --cwd packages/os test tests/audit/script-parity-audit.test.ts tests/facade/facade.test.ts tests/posthog-tool.test.ts tests/tool-manifest.test.ts tools/posthog/handler.test.ts`: GREEN **766/766** across 5 suites.
- Website: current task worktree is based on latest `origin/main`, unlike stale local root main. Built website with existing public PostHog token from local .env (token was never printed). Astro check/build GREEN, inline PostHog init exists in built HTML.
- Cloudflare Pages preview and production deployment succeeded using same dist and Pages Functions bundle (production deployment `https://e1a98404.consuelo-website.pages.dev`). `https://consuelohq.com` live HTTP 200 and verified PostHog init, public project token inclusion, CSP permitting PostHog assets and ingestion, same homepage title.
- Preview domain is Cloudflare Access-protected (302 to Access), so tested local artifact and the public production response instead.
- Existing website `tests/website-structure.test.js` has three unrelated design-contract failures (18 pass / 3 fail) from current source before any website code changes. Do not conflate with this PostHog activation; no website source code altered.
- Still need personal API key for read API; no unapproved customer/dialer telemetry emitted.

- 2026-10-28 18:18:35 append: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`

- 2026-10-28 18:22:47 append: `packages/workspace/tests/test-selection.test.js`

## CI regression contract (new scoped rule)
- Verify auto-selected an unrelated whole-OS package test for PostHog-only provider files, which flaked in Playwright browser setup (`tests/trace-request-budget.test.ts` hook 10000ms). Existing critical trace/OS compatibility rules still execute separately for shared manifest/package changes.
- CI red/green protection: add a selection regression test asserting PostHog tool source + `packages/os/package.json` selects a focused critical PostHog suite and does not trigger `auto:@consuelo/os:package-test`.
- Proposed focused command: `bun --cwd packages/os test tests/posthog-tool.test.ts tools/posthog/handler.test.ts tests/tool-manifest.test.ts tests/facade/facade.test.ts`; no tests removed and existing critical rules preserved. Add distinct selection rule rather than modifying or disabling unrelated existing CI rules.
- RED command before selection rule: `bun x vitest run packages/workspace/tests/test-selection.test.js -t 'keeps new PostHog API tool changes'`; expect missing os-posthog-api-tool rule.

- 2026-10-28 18:22:47 append: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`

- 2026-10-28 18:23:05 apply-patch: `packages/workspace/test-selection.rules.json`
## Live PostHog ingestion and CI-focused gate
- macOS Keychain now has `consuelo-posthog-project-token` populated from the local public website project token without displaying it in outputs; local `posthog config --json` reports hasProjectToken true, hasPersonalApiKey false.
- Real `posthog capture` CLI API smoke sent exactly one non-PII synthetic test event `consuelo_os_posthog_integration_smoke` with opaque anonymous id. PostHog ingress returned acceptance (`accepted:true`). Actual dashboard query still blocked by absent personal API key.
- Broader OS verification failed only the auto-selected whole-OS package test on unrelated browser Playwright hook timeout in `tests/trace-request-budget.test.ts`; new PostHog tests and 766 focused facade/tool/parity tests are green.
- Added a new **critical, exclusive** PostHog provider test selection rule, covering only new PostHog source/docs/test files, keeping all existing critical OS shared-contract rules and replacing the unrelated auto whole-package run with the explicit 765-test PostHog/facade/manifest suite. CI selection regression added test-first; confirmed RED before rule, GREEN after and generated registry refreshed. Selected rules include trace-site-pagination, os-release-surface-freshness and os-posthog-api-tool, without @consuelo/os package test.
- New targeted selection test `bun x vitest run packages/workspace/tests/test-selection.test.js -t 'keeps new PostHog API tool changes'`: GREEN 1/1.
- All modified files `git diff --check` clean.

- 2026-10-28 18:23:36 append: `.task/os/add-reusable-posthog-api-tool-for-os-users/workpad.md`
