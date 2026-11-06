# Release only DEV-1676 dialer UI polish to GHL and verify exact build

branch: `task/dialer/release-only-dev-1676-dialer-ui-polish-to-ghl-and-verify-exact-build`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2772
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/workflows/consuelo-production-release.yaml`

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Scope and release gates (approved 2026-11-05)

Goal: release exclusively DEV-1676 user-approved Dialer embedded UI polish (source PR #2771, merged to stream/dialer) to production GHL. No unrelated stream backlog, no Railway backend, billing, live calls, number purchasing, credential rotation, or interruption of existing sessions/parallel agents.

Test-first contract: Copy-only controlled extraction of previously TDD-verified UI patch into a fresh main-based isolated task. **No-test waiver** for the mechanical port only; must run original 5 red-to-green UI regressions, 248 LeadConnector tests, typecheck, build and exact diff classification on the actual main baseline. If adapting UI behavior due to main drift, add/execute focused red test before altering production code. Tests must prove single inbound endpoint, compact breadcrumb navigation, pinned options and style, and no inadvertent backend/shared code. Verify release workflow triggers only the intended Cloudflare frontend, not Railway. Preflight authenticated GHL/Marketplace capabilities and access without logging secrets; no sign-in automation.

Approved release sequence: source SHA / PR file diff audit -> main port with exact allowlist -> focused tests + full verification, independent strict review + GitHub CI exact SHA -> merge **only** main-based scoped release PR to main (not stream), verify Railway job skipped -> build/publish exact Cloudflare Worker bundle (signed-in credentials retained securely) -> validate deployment shell, cache-busted assets and /admin /overlay, safe API health -> update ONLY existing GHL Marketplace Custom JS + CSS as required, save/publish and read back persisted records -> read-only verify actual GHL overlay in authenticated session. Record release artifact, SHA, build marker, Worker deployment ID and GHL record hashes in DEV-1676, without exposing secrets.

Stop conditions: fail-closed if exact source differs, authentication blocked, safety gate wants unrelated deployment or deploy contract cannot be validated. Never claim UI visible merely because CI passes or Worker updated. No direct calls. Use existing authenticated desktop browser only for GHL visual verification; do not alter profiles or sessions.

Initial task: tsk_9e4c5a52ecac; task branch task/dialer/release-only-dev-1676-dialer-ui-polish-to-ghl-and-verify-exact-build; PR #2772 based on main.

- 2026-11-06 03:05:10 append: `.task/dialer/release-only-dev-1676-dialer-ui-polish-to-ghl-and-verify-exact-build/workpad.md`

## workspace-owned: files changed

- `.github/workflows/consuelo-production-release.yaml`

## workspace-owned: activity log

- 2026-11-06 03:05:10 fs.write: `.task/dialer/release-only-dev-1676-dialer-ui-polish-to-ghl-and-verify-exact-build/workpad.md`
- 2026-11-06 03:06:27 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-06 03:06:49 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-06 03:07:16 append: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-06 03:07:16 fs.write: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-06 03:07:30 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-06 03:08:18 fs.write: `.task/dialer/release-only-dev-1676-dialer-ui-polish-to-ghl-and-verify-exact-build/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 03:07:57 `review.run`: passed — OK
- 2026-11-06 03:08:31 `verify`: passed — OK

## Implementation and prepublication evidence (2026-11-05)

- The source PR #2771 implementation commit is 1533e23abc8d1865c9c8bc441afb9650cb4c6998. Ported only the six modified embed files and one new UI test to this main-based worktree; no controller, telephony runtime or unrelated stream files. Every one of the **seven** embed files is byte-for-byte identical to that approved source commit.
- Test-first UI release: extracted compact-workspace-polish.test.ts before implementation and observed 0/5 tests pass against unmodified main. After port, all UI tests green.
- Existing production release YAML would deploy Railway+Worker for any LeadConnector change; added strict DEV-1676-only classification to skip Railway and route to independent Cloudflare Worker UI job. Mixed backend or dependency changes still take full dialer release, manual workflow dispatch still behaves as before, QA-only remains no-deploy. Regression classifier fixture initially red (release=true) then green. Regression tests run actual extracted Bash against disposable Git fixtures, and use .git path for fixture artifacts to avoid polluting sample commits.
- Cloudflare-only GitHub job: exact GITHUB_SHA checkout, LeadConnector tests/typecheck/build, preflight existing Cloudflare token and approved stable GHL bootstrap SHA, Wrangler Worker deploy, Worker version capture, /, /admin, /overlay, /health/launcher asset verification, compare public main.js and main.css bytes against exact source compiled artifacts, upload immutable JSON release evidence. No Railway token, Railway deploy, edge-secret rotation, billing, or carrier call.
- Prepublication validation: 245/245 LeadConnector tests passed (1906 assertions), typecheck, production embed build, git diff --check clean. Workflow YAML parses with seven jobs; six release-workflow contract tests pass (99 assertions). Formal strict review.run base origin/main mine=true: 0 blocking, 0 failed suites.
- Existing GHL OS browser tab at app.gohighlevel.com login screen (signed out). Do not attempt password/MFA or claim in-app visual acceptance. Public Worker exact-byte verification can proceed and GHL confirmation must be marked pending if user does not sign in. Stable marketplace launcher .js/.css source remains unchanged; reupload must be avoided if persisted same.
- Next gates: formal verify, task.push, scoped task-only main PR #2772, exact PR file/CI/source SHA inspection and exact-head merge. Post-main workflow must show release-dialer skipped, release-dialer-ui successful; capture Worker version+hashes, verify /admin and /overlay. Record results on DEV-1676 and preserve other sessions.

- 2026-11-06 03:08:18 append: `.task/dialer/release-only-dev-1676-dialer-ui-polish-to-ghl-and-verify-exact-build/workpad.md`
