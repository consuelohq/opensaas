# avoid ambient task selection in code.run

branch: `task/workspace-agents/avoid-ambient-task-selection-in-code-run`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/543/avoid-ambient-task-selection-in-code-run
github pr: https://github.com/consuelohq/opensaas/pull/543
started: 2026-05-23

## acceptance criteria

- [x] Reproduce post-restart no-session `code.run` failure.
- [x] Prevent no-session `code.run` from ambient task/worktree resolution.
- [x] Preserve explicit taskSession behavior through code-run argument injection.
- [x] Validate focused facade and codemode paths.

## plan

1. Confirm live no-session smoke result after server restart.
2. Patch only the `code.run` manifest routing mode.
3. Validate exact code.run facade tests and codemode CLI tests.
4. Verify and promote.

## current status

- Implemented and validated. Ready to push/promote.

## files changed

- `packages/workspace/tooling/tool-manifest.json`

## validation evidence

- 2026-05-23 `code.run` no-session smoke after first restart failed with `AMBIGUOUS_TASK_SELECTION`, proving the second blocker.
- 2026-05-23 changed `code.run` command `branchMode` from `optional` to `none`.
- 2026-05-23 `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern code.run`: passed, 5 tests.
- 2026-05-23 `bun test packages/workspace/tests/codemode.test.ts`: passed, 7 tests.
- 2026-05-23 `verify --base origin/main --no-review --no-db`: passed.

## key decisions

- `code.run` should not resolve ambient branch/worktree by manifest branch mode. It composes nested typed tools, and those nested tools decide whether task context is needed.
- Explicit top-level `taskSession` still gets injected into code-run input by the MCP wrapper before manifest command execution.
- No-session `code.run` should run from the main workspace context and only fail when nested helpers require task context.

## issues and recovery

- Broad facade test touched unrelated snapshots for `design.refresh`; reverted the snapshot file and kept the focused code.run test evidence.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace-agents): avoid ambient task selection in code run" --changed
bun run task:pr
bun run task:finish
```
