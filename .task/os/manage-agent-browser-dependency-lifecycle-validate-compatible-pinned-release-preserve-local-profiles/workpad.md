# Manage agent-browser dependency lifecycle, validate compatible pinned release, preserve local profiles

branch: `task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2749
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/doctor.js`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/browser/managed-cli.ts`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/managed-agent-browser.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/managed-agent-browser.test.ts`
- `packages/workspace/scripts/doctor.js`
- `packages/workspace/scripts/lib/browser/managed-cli.ts`
- `packages/workspace/scripts/lib/browser/process.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
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

## Test-first contract — 2026-10-31

behavior under test: Consuelo installer provisions an isolated, pinned agent-browser CLI and its browser runtime for fresh installs; lifecycle update repairs missing/stale managed CLI without touching active browsers or profiles; OS browser wrapper launches managed binary first with safe fallback; doctor emits actionable version/health status; users' existing profiles and external PATH installs remain untouched. Validate the pinned upstream binary with a disposable session/profile on this Mac.
existing local pattern: installer packages/os/scripts/install.ts, provisionLocalOs in scripts/lib/install-state.ts, lifecycle updater scripts/lib/lifecycle, browser/process.ts, tests in packages/os/tests and mirrored workspace scripts. Keep OS/workspace parity.
new or changed tests: focused managed agent-browser dependency tests (version, install/upgrade/repair, download boundary, profile preservation, managed binary selection) plus install/doctor/lifecycle/browser-service tests and script parity where applicable.
focused red command: bun test packages/os/tests/managed-agent-browser.test.ts (or appropriate scoped test path after discovery).
expected red failure: missing managed dependency installer/version/health API and integration; must fail before production implementation.
no-test waiver: none; red->green required.
publication: new isolated task worktree on stream/os, formal review and verify, task.push/task.pr, no main merge/deploy/restart of active browser.

- 2026-10-31 06:57:09 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

## workspace-owned: files changed

- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/doctor.js`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/browser/managed-cli.ts`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/managed-agent-browser.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/managed-agent-browser.test.ts`
- `packages/workspace/scripts/doctor.js`
- `packages/workspace/scripts/lib/browser/managed-cli.ts`
- `packages/workspace/scripts/lib/browser/process.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-10-31 06:57:09 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 06:59:42 write: `packages/os/tests/managed-agent-browser.test.ts`
- 2026-10-31 06:59:42 fs.write: `packages/os/tests/managed-agent-browser.test.ts`
- 2026-10-31 07:00:24 write: `packages/os/scripts/lib/managed-agent-browser.ts`
- 2026-10-31 07:00:24 fs.write: `packages/os/scripts/lib/managed-agent-browser.ts`
- 2026-10-31 07:00:41 write: `packages/workspace/scripts/lib/browser/managed-cli.ts`
- 2026-10-31 07:00:41 write: `packages/os/scripts/lib/browser/ma
- 2026-10-31 07:00:41 fs.write: `packages/workspace/scripts/lib/browser/managed-cli.ts`
- 2026-10-31 07:09:18 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:31:12 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:31:36 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:32:00 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:32:29 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:32:54 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:33:20 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:35:51 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:40:57 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:41:34 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:42:16 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
- 2026-10-31 07:42:48 fs.write: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

## Implementation and evidence

- Upstream agent-browser v0.40.0 native GitHub release assets verified via published SHA-256 digests (darwin arm64/x64, Linux glibc/musl x64/arm64, Windows x64/ARM64 via x64 emulation); exact arm64 macOS release executable downloaded and ran in task-scoped fixture.
- Isolated real Chrome test: AGENT_BROWSER_NAMESPACE=consuelo-pr2749-isolated; AGENT_BROWSER_SESSION=consuelo-pr2749-test; AGENT_BROWSER_PROFILE and Chrome path point to disposable task probe. v0.40.0 open about:blank/get title/get url succeeded; closed ONLY that test session. No user persistent profile/session touched. Existing global Homebrew CLI remained agent-browser v0.25.3.
- Isolated real managed install: in disposable isolated HOME, XDG_CACHE_HOME and CONSUELO_HOME, ensureManagedAgentBrowser downloaded checksum-verified native binary, ran agent-browser install successfully, manifest status ready, OS browser process resolved managed v0.40.0. Probe files removed after testing, no changes to live runtime/global CLI/user browser.
- OS first-install path attempts managed CLI with deferred nonfatal fallback. Lifecycle accepted update and same-version update reconcile missing/stale dependency; supervisor on first new-runtime boot reconciles for users upgrading from older lifecycle updater. OS doctor and developer doctor report versions/repair guidance. OS/workspace browser runner parity retained.
- Tests: first red due to missing module (0 tests, expected), green managed dependency 6/6; packages/os installer/browser/lifecycle focused suite 129/129; package distribution+installer+script parity suite 123/123; post-integrity focused suite 85/85; workspace selection and browser suite 124/124. No main merge, no deploy, no live browser restart.
- Scope-specific CI selection added as os-browser-managed-dependency critical nonexclusive rule to retain existing Google-install and lifecycle coverage; registry regenerated; added selection regression after removing initial exclusive overlap that suppressed legacy rule; selection tests green.

- 2026-10-31 07:09:18 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:21:22 `review.run`: passed — OK
- 2026-10-31 07:22:05 `review.run`: passed — OK
- 2026-10-31 07:25:23 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:26:16 `review.run`: passed — OK
- 2026-10-31 07:28:45 `verify`: passed — OK
- 2026-10-31 07:36:22 `review.run`: passed — OK
- 2026-10-31 07:39:39 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:43:08 `verify`: passed — OK

## CI wait checkpoint

Wait reason: PR #2749 cross-platform and repository GitHub Actions remain pending after a publish-valid OS verification stamp.
Duration: 12 seconds, bounded polling.
Resume action: read exact-head PR #2749 check conclusions and mergeability through GitHub, then determine whether safe stream promotion is permitted.
Expected signal: all required checks have success or expected skipped states, mergeable, exact head f4bb73a6b0afc2149f4f5e901b6004d73e95df95.
Fallback: if pending, poll again; if failure, inspect and address attributable failures without changing main/deploy/browser.

- 2026-10-31 07:31:12 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

CI wait checkpoint 1 observed: 15 passed, zero failed; native macos-intel, native windows, Consuelo / verify still pending. Next bounded wait: 14s. Resume: GitHub PR #2749 exact-head check inspection. Fallback: continue monitoring without merging if pending; diagnose failed checks.

- 2026-10-31 07:31:36 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

CI wait checkpoint 2 observed: 15 passed, zero failed; native macos-intel, native windows and Consuelo / verify still in progress. Wait reason: pending GitHub check completion. Duration: 14s. Resume: exact-head PR CI check summary. Expected: completed successful checks; fallback: inspect failures or continue bounded polling.

- 2026-10-31 07:32:00 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

CI wait checkpoint 3: 15 passed/0 failed/3 pending. Wait 14s for GitHub completion; resume gh pr view 2749 check rollup. Expected all passed; fallback inspect pending jobs or failures; no merge while unknown.

- 2026-10-31 07:32:29 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

CI wait checkpoint 4: native Windows passed, 16 green/0 failed; Intel macOS and Consuelo / verify pending. Wait 14s; resume exact-head PR #2749 status. Expected pass; fallback diagnose failures or continue without merge.

- 2026-10-31 07:32:54 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

CI wait checkpoint 5: all native platforms, docs, OCI, distribution checks green (17 passed/0 failed). Only Consuelo / verify pending. Wait 14s, then inspect exact-head PR #2749. Expected GitHub verify success; fallback inspect verify logs without stream merge.

- 2026-10-31 07:33:20 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

## PR #2749 cross-stream CI repair (2026-10-31)

- GitHub CI merge-context verify failed only in the OS script-parity inventory test: task branch had been based before stream/os introduced review-changed-lines.js and review-typecheck-errors.js, and DEV-1665 subsequently introduced OS search/explore-failure.js.
- Preserved all parallel stream work via a normal non-force merge of origin/stream/os (2752c01fbab7a75f893a8581a16303bd3b208fa0) into the isolated task branch; no changes to main.
- Red: on fully synchronized tree the existing packages/os/tests/audit/script-parity-audit.test.ts failed with exactly three inventory keys missing (2 workspace reviewer helpers, 1 OS explore helper).
- Green: appended explicit parity entries with truthful ownership and reason for all three; 38/38 targeted script-parity, managed-agent-browser, review modernization and explore contract tests passed. Regenerated test-selection registry and confirmed it remains clean after merged stream changes.
- Safe publication plan: rerun strict review and full verification on stream-synchronized tree, commit fixture plus updated workpad/verify stamp, and fast-forward GitHub task PR using normal git push to preserve merge ancestry (task.push API cannot encode a two-parent merge commit). Confirm all checks before task.pr promotion to stream/os. No main merge/deploy/global CLI or live browser changes.

- 2026-10-31 07:35:51 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

- Subsequent synchronized full verify passed review and 21/22 selected suites but failed only the pre-existing 25ms stale-lease timing assertion (`tests/release-promotion-dispatch-lock.test.ts`, 'supports explicit owner renewal when synchronous work would starve the timer heartbeat') in OS release freshness, while 78/78 browser+parity suite and 60/60 browser CDP suite passed.
- Reproduced in isolation: the same lock test passed 7/7; exact 13-file OS release freshness suite passed 103/103 on local rerun. This is a pre-existing load-sensitive timing race in unrelated release promotion code. Do not change release lock behavior or weaken test coverage. Rerun formal full gate for publish-valid stamp; no main/deploy/browser effects.

- 2026-10-31 07:40:57 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

Full gate retry checkpoint: waiting for selected suites after isolated release-lock 7/7 and full release-freshness 103/103 green. Wait reason: formal verify worker 50625 still executing. Duration: 18s. Resume action: verify same taskSession/base. Expected: completed pass/publishValid stamp; fallback: inspect any failed suite, preserve changes and do not publish.

- 2026-10-31 07:41:34 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

Verification retry wait 2: worker 50625 active, browser-service suites reached. Wait 18s; resume verify same task/base, require publishValid. Fallback inspect failure without bypassing gate.

- 2026-10-31 07:42:16 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`

Verification retry wait 3: worker active in Google/runtime tests; 18s bounded delay, then verify status via OS. Success requires publish-valid stamp; failure requires diagnosis, not bypass.

- 2026-10-31 07:42:48 append: `.task/os/manage-agent-browser-dependency-lifecycle-validate-compatible-pinned-release-preserve-local-profiles/workpad.md`
