# fix workspace edge contract runner

branch: `task/os/fix-workspace-edge-contract-runner`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2526
started: 2026-09-21

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Workspace test selection must run the OS Workspace Edge contract suite in a runtime that can resolve the Vitest bun:sqlite compatibility alias through Node 24's node:sqlite implementation.
existing local pattern: packages/os package tests are launched through the package test script (bun run --cwd packages/os test), which invokes Vitest in its supported Node runtime; critical selection rules should preserve required environment flags without bypassing that package runner.
new or changed tests: tighten packages/workspace test-selection contract coverage so the Workspace Edge rollout rule uses the package test entrypoint rather than invoking vitest.mjs directly under Bun.
focused red command: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os ../../node_modules/vitest/vitest.mjs run tests/workspace-edge-route-seed-contract.test.ts
expected red failure: ResolveMessage: No such built-in module: node:sqlite.
no-test waiver: not applicable.

## Context

PR #2525 is blocked in Consuelo / verify because the critical Workspace Edge selector invokes Vitest directly under Bun 1.3.14. The same exact command reproduces locally. Node 24 is installed in CI and the normal package test path resolves node:sqlite correctly, so this is test-runner plumbing rather than a product regression.

- 2026-09-21 19:56:42 append: `.task/os/fix-workspace-edge-contract-runner/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 19:56:42 fs.write: `.task/os/fix-workspace-edge-contract-runner/workpad.md`
- 2026-09-21 19:58:02 fs.write: `.task/os/fix-workspace-edge-contract-runner/workpad.md`
- 2026-09-21 19:58:30 fs.write: `.task/os/fix-workspace-edge-contract-runner/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/tests/helpers/bun-sqlite-vitest.ts`
- `packages/os/tests/test-environment-contract.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Discovery correction

The existing selector contract intentionally requires these focused OS suites to run with Bun, OS cwd, and the root Vitest entrypoint. That behavior is covered explicitly in packages/workspace/tests/test-selection.test.js and should not be weakened.

The regression was introduced by today's portable-CI change a6577c8c33, which unconditionally aliased bun:sqlite to a Node-only helper importing node:sqlite. That alias is correct when Vitest runs under Node, but incorrect when the intentional Bun contract runner is used.

Revised smallest fix: keep the Bun selector unchanged and make the bun:sqlite Vitest alias runtime-aware: Node gets the node:sqlite compatibility helper; Bun uses its native bun:sqlite module. The exact failing contract command remains the end-to-end RED/GREEN regression.

- 2026-09-21 19:58:02 append: `.task/os/fix-workspace-edge-contract-runner/workpad.md`

- 2026-09-21 19:58:09 apply-patch: `packages/os/vitest.config.ts`
## Acceptance criteria

- The exact Workspace Edge critical contract command that failed CI under Bun passes locally with CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1.
- The intentional Bun + OS cwd + root Vitest selector contract remains unchanged.
- Node-launched OS Vitest still aliases bun:sqlite to the node:sqlite compatibility helper.
- Focused Workspace Edge, test-environment, gateway-proxy, and test-selection suites pass.
- PR #2525 returns to green so the Diffs cache fix can merge and release.

## Implementation

- packages/os/vitest.config.ts now applies the bun:sqlite compatibility alias only outside Bun. Bun Vitest uses native bun:sqlite; Node Vitest keeps the portability shim.
- No selector broadening and no production gateway behavior changed in this CI-fix task.

## Validation

- RED reproduced before edit: exact critical contract command failed with ResolveMessage: No such built-in module: node:sqlite.
- GREEN after edit: Workspace Edge route seed + Sites gateway integration = 26/26 passed under the exact Bun critical runner.
- Node/package Vitest path: test-environment + workspace gateway proxy = 12/12 passed.

- 2026-09-21 19:58:30 append: `.task/os/fix-workspace-edge-contract-runner/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 19:59:06 `review.run`: passed — OK
- 2026-09-21 20:01:01 `verify`: passed — OK
