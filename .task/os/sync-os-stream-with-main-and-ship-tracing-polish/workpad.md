# Sync OS stream with main and ship tracing polish

branch: `task/os/sync-os-stream-with-main-and-ship-tracing-polish`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2042/sync-os-stream-with-main-and-ship-tracing-polish
github pr: https://github.com/consuelohq/opensaas/pull/2042
started: 2026-08-15

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Reproduce the stream/main merge in a clean task worktree and inventory every conflict.
2. Resolve product conflicts from evidence: retain the newer activated-runtime lifecycle handoff from main, retain the stream's gateway-sidecar restart and Overview/shared-shell contracts, and preserve PR #2041 exactly.
3. Regenerate derived test-selection state and run the owning lifecycle, workspace-shell, documentation, and Trace Burn suites plus mobile browser geometry.
4. Run strict review and formal verify, publish the resolution through the task workflow, record main ancestry, promote to `stream/os`, then merge PR #1972 to `main`.

## current status

- Merge conflict resolution is complete in the task worktree and the merge state was converted to an ordinary task diff after validation. Focused lifecycle, shell, documentation, selector, Trace Burn, and mobile browser checks are green. Awaiting strict review/formal verify and publication.

## files changed

- `packages/dialer-server/README.md`
- `packages/dialer-server/package.json`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/BrowseMenu.astro`
- `packages/documentation/src/components/DocsMenuTrigger.astro`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/content/docs/connect/agents/create-your-own.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/create-your-own.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/index.mdx`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/secure/hosted-mcp-ingress.mdx`
- `packages/documentation/src/content/docs/secure/security-model.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/connect.test.ts`
- `packages/documentation/tests/foundation.test.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/native-lifecycle-endpoint.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/website-deploy.test.js`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`


## workspace-owned: files changed

- Same reconciliation set as `files changed`; all task-local conflict resolution occurred inside this task worktree.

## workspace-owned: activity log

- 2026-08-15 07:33:09 fs.write: `.task/os/sync-os-stream-with-main-and-ship-tracing-polish/workpad.md`

## workspace-owned: validation evidence

- Clean `origin/main` merge reproduced 19 real code/docs/test conflicts (`trc_f64c825ce819`; conflict audit `trc_cec8d8b5c4bb`).
- Resolved lifecycle model combines main's activated-runtime Caddy reconciliation/reload path with stream's completed macOS gateway-sidecar restart behavior. Owning lifecycle/native/Caddy/Linux tests: 4 files / 34 tests passed and syntax passed (`trc_c91af07618db`).
- Workspace root/shell reconciliation: 6 files / 56 tests passed; the local-agent test covering the conflicted Overview root assertion passed independently (`trc_384b34983cc4`).
- Test-selection registry regenerated from the merged rules: 2,632 tests, 2,549 mapped, 83 unmapped, 59 rules (`trc_70b9a60c0ff6`). Selector unit tests pass 38/38 (`trc_fd3fd4e494ad`).
- Trace Burn owning contracts pass 7 files / 48 tests plus runtime-boundary 3/3 (`trc_741c87d6cfcd`).
- Post-sync mobile browser proof at 402px: no document horizontal overflow; shell is 402px wide; shell rows are only `38px 836px`; header is one 34px row; Cost is fully reachable; route menu center is exactly 201px and includes Overview/Guides plus `Inspect live traces and tool execution.` (`trc_74751eeaca35`).
- Post-sync selected-trace mobile proof: body remains one 402px column; rail right edge 402px, inspector right edge 391px, close button right edge 381px, Cost remains fully reachable (`trc_04b6479933bb`).
- Documentation source tests pass 27/27 (`trc_cfc0369ad82d`).
- Strict review against `origin/stream/os`: 0 issues / 0 blockers; one non-blocking MCP documentation opportunity inherited from current main (`trc_b4e2d3cee712`).
- Formal verification against `origin/stream/os` passed with `publishValid=true`, DB guard clean (`trc_c0b2d7379c68`).
- 2026-08-15 07:42:58 `review.run`: passed — OK
- 2026-08-15 07:43:48 `verify`: passed — OK
- 2026-08-15 07:45:08 `verify`: passed — OK
- 2026-08-15 07:46:43 `verify`: passed — OK

## key decisions

- `main`'s activated-runtime lifecycle reconciliation is authoritative for Caddy migration/reload; stream's gateway-sidecar restart is additive after the active reload completes. The obsolete direct `reconcileCaddyWorkerPoolConfig` lifecycle path is not restored.
- Overview remains `/`, first/unsectioned, with Guides/Documentation last; main's older Nodes-root and `/configuration` picker variants are intentionally not restored.
- PR #2041's tracing integration layer and compact inspector runtime are preserved byte-for-byte relative to the stream task HEAD; browser behavior was re-proved after the merge resolution.
- Test-selection syntax commands can be de-duplicated across overlapping critical rules. Assertions require equivalent syntax coverage rather than a fragile exact suite list when multiple explicit rules own the same changed file.

## notes for ko

- This task exists only because the normal `stream.sync` worktree was already left dirty by an earlier failed code conflict. Resolution was performed in a clean task based on remote `stream/os`, not by overwriting that stale sync worktree.

## improvements noticed

- A reconciled content commit alone is insufficient to make `stream/os -> main` conflict-free because Git needs `main` recorded as ancestry. After the normal task publish, record `origin/main` as a second parent without changing the already-validated tree before promoting the task to the stream.

## issues and recovery

- The first documentation test attempt incorrectly used Vitest against `bun:test` sources (`trc_56b615d35445`) and a second attempt used a nonexistent package script (`trc_c987e6f74f8c`). The canonical root `bun test` invocation passed 27/27 (`trc_cfc0369ad82d`).
- Initial merged selector assertions were too exact after main added overlapping critical rules; product selection was correct but suite de-duplication changed names/order. Assertions were tightened to require the owning critical suites plus equivalent syntax coverage; 38/38 now pass (`trc_fd3fd4e494ad`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: reconcile current `main` into the clean remote `stream/os` without dropping either side's intentional OS changes, preserve the just-landed tracing chrome/responsive-table fix from PR #2041, and leave the stream review PR mergeable and validated before shipping to `main`.
existing local pattern: stream sync normally merges `main` into `stream/os`; when code/test conflicts require judgment, resolve them on a task branch with file-level evidence, focused tests for the conflicting surface, strict review, and formal verify.
new or changed tests: no new product behavior is introduced by this reconciliation. Run the owning native lifecycle tests for any real code/test conflict plus the Trace Burn/browser contracts that must survive the merge.
focused red command: not applicable; the merge conflict itself is the failing integration state (`stream/os` PR #1972 is DIRTY and the existing stream worktree has a `native-lifecycle-endpoint.test.ts` conflict).
expected red failure: not applicable beyond the Git merge conflict.
no-test waiver: approved for pre-merge RED because this task is conflict reconciliation only, not a behavior change. Post-resolution focused tests, review, and verify are mandatory.

## Acceptance criteria

- [x] Merge current `origin/main` into a clean task based on remote `stream/os` and identify every real conflict.
- [x] Resolve conflicts by preserving the current intended behavior from both main and stream; do not overwrite unrelated work.
- [x] Preserve PR #2041 tracing chrome/responsive-table changes exactly through the sync.
- [x] Run owning focused tests for each resolved code/test conflict and the Trace Burn contracts.
- [x] Strict review and formal verify pass against the appropriate post-sync base.
- [ ] Promote the reconciliation task into `stream/os`; PR #1972 becomes mergeable.
- [ ] Merge PR #1972 to `main`, verify merged state, then clean up the task.

- 2026-08-15 07:33:09 append: `.task/os/sync-os-stream-with-main-and-ship-tracing-polish/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 07:42:24 apply-patch: `.task/os/sync-os-stream-with-main-and-ship-tracing-polish/workpad.md`

- 2026-08-15 07:44:09 apply-patch: `.task/os/sync-os-stream-with-main-and-ship-tracing-polish/workpad.md`
