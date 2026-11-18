# Fix computer use review findings

branch: `task/os-computer-use/fix-computer-use-review-findings`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2814
started: 2026-11-18

## acceptance criteria

- [x] Provision missing Chromium on its first open, serialize installation and preserve normal navigation errors.
- [x] Share one monotonic timeout across lock acquisition, startup, retries and requested actions.
- [x] Preserve foreground choice, trace privacy and existing source documentation.

## plan

1. Reproduce the provider failures, update the runner and docs, re-run focused and full checks, and promote the fixes to #2813.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- Addressed Codex findings #4621717189 and #4621717208. The 3 new red tests failed as expected before implementation and all 15 focused tests now pass. The pinned upstream diagnostic was verified from Vercel source. A first download can use timeout: 300000. No navigation is replayed after a general navigation error.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: a clean Chromium node can provision the actual browser, the native runner shares one elapsed wall-clock budget across profile locking, Dia setup and requested action, and actionable PR feedback is addressed.
existing local pattern: typed filesystem and node resource lock, Effect provider process with bounded timeouts and the canonical runtime installer.
new or changed tests: focused provider execution tests for preparation, deadlines and any additional reviewer findings.
focused red command: bun run --cwd packages/os test -- tests/computer-use.test.ts
expected red failure: missing browser preparation and each provider invocation receives the full initial budget.
no-test waiver: not applicable.

- 2026-11-18 22:27:50 append: `.task/os-computer-use/fix-computer-use-review-findings/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 22:27:50 fs.write: `.task/os-computer-use/fix-computer-use-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 22:32:05 `review.run`: passed — OK
- 2026-11-18 22:32:28 `review.run`: passed — OK
- 2026-11-18 22:33:03 `review.run`: passed — OK
- 2026-11-18 22:35:10 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
