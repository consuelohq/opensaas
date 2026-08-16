# expose explicit cloud node targeting in chatgpt os call

branch: `task/os/expose-explicit-cloud-node-targeting-in-chatgpt-os-call`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1978/expose-explicit-cloud-node-targeting-in-chatgpt-os-call
github pr: https://github.com/consuelohq/opensaas/pull/1978
started: 2026-08-15

## acceptance criteria

- [x] Public ChatGPT `os.call` exposes optional top-level `nodeId` while the public tool surface remains exactly `get_steering` + `call`.
- [x] Omitting `nodeId` preserves workspace-default routing.
- [x] Explicit `nodeId` is consumed as routing metadata, produces `routeSource=explicit`, and never leaks into the inner typed tool input.
- [x] Unknown/offline/invalid node targets fail closed without silently falling back to the default node.
- [x] Existing auth, scopes, task-session semantics, and inner typed tool contracts remain unchanged.
- [ ] Strict review, full verify, task promotion, release/deploy, and a fresh ChatGPT routing smoke complete.

## plan

1. Recreate the lost test-first patch at the public FastMCP boundary only.
2. Prove RED on the public signature/no-leak contracts, then implement the smallest `server.py` change and prove GREEN.
3. Re-run MCP gateway and Device Authority routing regressions, inspect the task diff, then run strict review and full verify.
4. Push #1978, promote it through `stream/os`, release/deploy, and smoke explicit `cloud-1` plus default routing.

## current status

- Recovered PR #1978 after the prior OS outage removed its temporary uncommitted worktree. The public-boundary patch has been recreated test-first; focused/downstream regressions, strict review, and full verify are green. Publish/promotion/release smoke remain.

## files changed

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 01:14:59 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-15 01:16:05 `review.run`: passed — OK
- 2026-08-15 01:16:24 `verify`: passed — OK
- 2026-08-15 01:17:29 `verify`: passed — OK

## key decisions

- Keep routing ownership in Device Authority. `server.py` exposes the optional top-level selector only; it does not forward `nodeId` into `_run_workspace_call` or the inner typed input.
- Do not change internal MCP/Device Authority routing code because existing tests already prove explicit/default routing, fail-closed invalid/offline behavior, and task-affinity conflicts.

## notes for ko

- Product change remains deliberately small: one optional FastMCP parameter plus explanatory boundary comment; no new switch-node tool or inner-tool schema change.

## improvements noticed

- none yet

## issues and recovery

- Prior OS transport failure removed the temporary uncommitted worktree before publish. `task.start --pr 1978` initially hit a stale Git worktree registration; `task.cleanup --preview` pruned that stale registration, the failed recovery directory was verified to contain only task metadata and removed, and `task.start --pr 1978` then recreated a valid worktree/session.
- `checkFiles` cannot validate Python here because it invokes Node syntax checking for `.py`; direct Python compilation passed instead.
- Failed worktree recreation left NUL-padded generated `evidence-log.json` / `read-log.json`; both were repaired by truncating the corrupt tail and restoring valid timestamp fields, then all task metadata JSON parsed successfully.

## Test-first contract

- Behavior under test: the public ChatGPT FastMCP `call` schema includes optional top-level `nodeId`; `nodeId` remains routing metadata and never enters the inner typed workspace input.
- Existing local pattern: `packages/workspace/server.py` defines the FastMCP public function signature; Device Authority already parses `params.arguments.nodeId`, routes explicitly/default, and fails closed.
- New or changed tests: focused signature and no-leak contracts in `packages/workspace/tests/server_call_test.py`; existing MCP gateway and workspace-node routing tests provide downstream proof.
- Focused red command: run only the two new `WorkspaceCallServerTest` methods through Python `unittest`.
- Expected red failure: `call()` rejects `nodeId` and the public signature omits the parameter.
- No-test waiver: none.
- RED: 2 selected tests failed as expected with signature mismatch and `TypeError: call() got an unexpected keyword argument 'nodeId'` (`trc_c8f4daa54355`).
- GREEN: 3 public-facade tests passed (`trc_10fde38462cf`).
- MCP gateway: 3 focused regressions passed, including exact two-tool exposure and no `nodeId` leakage (`trc_9569b45d0cb7`).
- Device Authority: 4 explicit/default/fail-closed/task-conflict routing regressions passed (`trc_5ed872418acc`).
- Static validation: direct Python compilation passed for both touched Python files (`trc_bbfab740adfe`); task metadata JSON parse passed (`trc_492e985b3f9e`).
- Strict review: zero blocking issues (`trc_eacdd55040fd`).
- Full verify: `passed=true`, `publishValid=true`, stamp written (`trc_8dcfbe067892`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

- 2026-08-15 01:14:33 apply-patch: `.task/os/expose-explicit-cloud-node-targeting-in-chatgpt-os-call/workpad.md`
- 2026-08-15 01:14:37 apply-patch: `packages/workspace/tests/server_call_test.py`
- 2026-08-15 01:14:43 apply-patch: `packages/workspace/server.py`

- 2026-08-15 01:15:39 apply-patch: `.task/os/expose-explicit-cloud-node-targeting-in-chatgpt-os-call/workpad.md`

- 2026-08-15 01:16:32 apply-patch: `.task/os/expose-explicit-cloud-node-targeting-in-chatgpt-os-call/workpad.md`
