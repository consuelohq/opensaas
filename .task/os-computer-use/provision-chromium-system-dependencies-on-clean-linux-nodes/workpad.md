# Provision Chromium system dependencies on clean Linux nodes

branch: `task/os-computer-use/provision-chromium-system-dependencies-on-clean-linux-nodes`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2816
started: 2026-11-18

## acceptance criteria

- [x] Bootstrap Chromium with system libraries on Linux x64 and recover an identified pre-launch loader failure.
- [x] Preserve upstream noninteractive privilege checks and report admin action when needed.
- [x] Keep macOS/Windows and Linux ARM64 on their tested provider paths.

## plan

1. Verify pinned upstream behavior, reproduce Linux gaps with focused regressions, update provider routing, verify, publish and check the reviewed head.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- Three targeted Linux tests initially failed. The native Linux x64 installer now receives --with-deps, uses its package-manager privilege checks and returns an actionable approval requirement when unavailable. The new recovery matches only the prelaunch loader error.

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

behavior under test: provision Chromium with Linux system libraries on supported Linux x64 nodes and surface missing package-manager privileges without retrying navigation. Scope follow-up to GitHub finding #4621905235 on PR #2813.
existing local pattern: pinned Agent Browser native installer, readResult, bounded execution and node resource locks.
new or changed tests: computer-use.test.ts Linux installer arguments, pending administrator access, loaded browser with missing system libraries and provider failure handling.
focused red command: cd packages/os && bun x vitest run tests/computer-use.test.ts
expected red failure: Linux currently invokes plain install without the required system dependencies.
no-test waiver: not applicable.

- 2026-11-18 22:47:41 append: `.task/os-computer-use/provision-chromium-system-dependencies-on-clean-linux-nodes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 22:47:41 fs.write: `.task/os-computer-use/provision-chromium-system-dependencies-on-clean-linux-nodes/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 22:49:12 `review.run`: passed — OK
- 2026-11-18 22:50:12 `verify`: failed — COMMAND_FAILED
- 2026-11-18 22:50:43 `review.run`: passed — OK
- 2026-11-18 22:51:50 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
