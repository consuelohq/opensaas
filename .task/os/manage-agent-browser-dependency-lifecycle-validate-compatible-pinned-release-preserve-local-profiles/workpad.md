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

- `packages/os/scripts/lib/managed-agent-browser.ts`
- `packages/os/tests/managed-agent-browser.test.ts`
- `packages/workspace/scripts/lib/browser/managed-cli.ts`

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

- `packages/os/scripts/lib/managed-agent-browser.ts`
- `packages/os/tests/managed-agent-browser.test.ts`
- `packages/workspace/scripts/lib/browser/managed-cli.ts`

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
