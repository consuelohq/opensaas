# bust cached trace inspector asset and ship canary

branch: `task/os-trace-hotfix/bust-cached-trace-inspector-asset-and-ship-canary`
stream: `stream/os-trace-hotfix`
pr: https://github.com/consuelohq/opensaas/pull/2571
started: 2026-09-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(os-trace-hotfix): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/trace-site.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/routes/traces.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/traces-hono-routes.test.ts`

## Acceptance criteria

- [ ] Refresh the currently materialized local Tracing site from the active fixed runtime and prove the stale `≈` code is gone from `~/.consuelo/sites/traces/index.html`.
- [ ] Fix lifecycle updates so a health-accepted runtime update refreshes managed Sites from the newly activated release rather than leaving old generated HTML behind.
- [ ] Add regression coverage proving the post-update site refresh runs against the accepted release path and remains non-fatal if site refresh itself fails.
- [ ] Ship the lifecycle fix to canary and update this node from canary.

## Root cause

The active runtime is already 0.1.131 and contains the corrected inspector source, but `~/.consuelo/sites/traces/index.html` was generated before that update and still embeds `totalTokensEstimated ? '≈' : ''`. The observability Tracing page inlines the inspector bundle into generated HTML, so updating the immutable runtime alone does not rewrite an already-materialized Sites page. Lifecycle update reconciles visible managed user content after health acceptance, but does not refresh hidden managed Sites.

## Test-first contract

behavior under test: after a lifecycle release is health-accepted, managed Sites are refreshed from the newly accepted release so generated pages cannot continue serving browser runtime from the previous release.
existing local pattern: `activateAndAccept()` performs post-health, non-fatal reconciliation through `reconcileAcceptedReleaseUserState(nextReleasePath)`; install/provision and `os sites refresh` already use `materializeSites()` to regenerate `sites/traces/index.html`.
new or changed tests: lifecycle engine regression test injects a post-accept sites reconciler and asserts it receives `home` plus `nextReleasePath`; a thrown reconciliation error must not fail an otherwise accepted update.
focused red command: run the lifecycle engine test file containing accepted-release reconciliation assertions.
expected red failure: current engine has no managed-sites reconciliation dependency/call, so the injected site reconciler is never invoked.
no-test waiver: not applicable.

- 2026-09-23 22:53:48 append: `.task/os-trace-hotfix/bust-cached-trace-inspector-asset-and-ship-canary/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 22:53:48 fs.write: `.task/os-trace-hotfix/bust-cached-trace-inspector-asset-and-ship-canary/workpad.md`
- 2026-09-23 22:59:54 apply-patch: `packages/os/tests/lifecycle-engine.test.ts`
- 2026-09-23 23:01:23 apply-patch: `packages/os/scripts/lib/lifecycle/engine.ts`
- 2026-09-23 23:01:23 apply-patch: `packages/os/scripts/lifecycle.ts`
- 2026-09-23 23:03:11 apply-patch: `packages/os/scripts/lifecycle.ts`
- 2026-09-23 23:03:11 apply-patch: `packages/os/tests/lifecycle-engine.test.ts`
- 2026-09-23 23:04:26 fs.write: `.task/os-trace-hotfix/bust-cached-trace-inspector-asset-and-ship-canary/workpad.md`

## Diagnosis and implementation

- Confirmed the installed immutable runtime was already the fixed 0.1.131 bundle, but `~/.consuelo/sites/traces/index.html` still contained `totalTokensEstimated ? '≈' : ''` from an older materialization.
- Confirmed the Tracing site inlines `observability-traces-v38/inspector.js` into generated HTML, so a runtime update alone cannot change an already-written `sites/traces/index.html`.
- Refreshed local Sites immediately from the active 0.1.131 runtime. Post-refresh checks report `approx=absent` and `estimated=absent` in the local Tracing HTML.
- Added a lifecycle-managed Sites reconciler. After health + connector acceptance, lifecycle now refreshes Sites from the **accepted immutable release path**, not from the updater's older source tree.
- Same-version updates also run this Sites reconciliation, so `consuelo update` repairs stale generated HTML even when the binary bundle is already current.
- Site refresh remains best-effort after runtime acceptance; a generated-page failure does not roll back a healthy release.

## Test evidence

- RED: lifecycle engine focused suite failed 2 tests because managed Sites reconciliation was never invoked.
- GREEN: focused lifecycle engine suite passed 69/69 after implementation.
- Broader lifecycle + managed-user-content suite passed 12 files / 166 tests.
- OS typecheck/syntax gate passed.
- Direct production-path regression verifies the Sites module is dynamically loaded from `<accepted release>/scripts/lib/sites.ts` and receives the correct Consuelo home and trace DB path.

## Local repair evidence

- `bun ~/.consuelo/runtime/current/scripts/os.ts sites refresh --json` completed successfully.
- `~/.consuelo/sites/traces/index.html`: `≈` absent; `totalTokensEstimated` absent.

- 2026-09-23 23:04:26 append: `.task/os-trace-hotfix/bust-cached-trace-inspector-asset-and-ship-canary/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 23:04:42 `review.run`: passed — OK
- 2026-09-23 23:05:35 apply-patch: `packages/os/scripts/lib/lifecycle/engine.ts`
- 2026-09-23 23:05:35 apply-patch: `packages/os/scripts/lifecycle.ts`
- 2026-09-23 23:06:06 `review.run`: passed — OK
- 2026-09-23 23:06:56 `verify`: passed — OK
