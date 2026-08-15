# hotfix explicit cloud node targeting to main

branch: `task/os/hotfix-explicit-cloud-node-targeting-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1982/hotfix-explicit-cloud-node-targeting-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1982
started: 2026-08-15

## acceptance criteria

- [ ] Public ChatGPT `os.call` exposes optional top-level `nodeId` while the public tool surface remains exactly `get_steering` + `call`.
- [ ] Omitting `nodeId` preserves default-node routing.
- [ ] Explicit `nodeId` remains routing metadata and never enters the inner typed tool input.
- [ ] Existing Device Authority explicit/default/fail-closed routing semantics remain unchanged.
- [ ] Mainline hotfix passes focused tests, strict review, full verify, GitHub CI, merge, and fresh ChatGPT/cloud-1 smoke.

## plan

1. Reproduce the already-verified #1978 public-facade contract on current `main`: add the signature/no-leak tests first and run RED.
2. Apply only the proven `packages/workspace/server.py` boundary change from #1978; do not modify Device Authority routing logic or inner typed tool schemas.
3. Run focused GREEN, Python syntax, downstream routing contracts, strict review, and full verify against `origin/main`.
4. Push the isolated hotfix, create/merge a dedicated `main` PR rather than merging unrelated `stream/os` work, then refresh/publish the ChatGPT app action schema.
5. From a brand-new chat, explicitly target steering's canonical online cloud node and prove `routeSource=explicit`; repeat without `nodeId` to prove default routing.

## current status

- Implementation complete on the isolated main-based hotfix. Focused RED→GREEN, Python compilation, downstream Device Authority/node-routing regressions, strict review, and full verify are green/publish-valid. Push, dedicated-main PR retarget/merge, release, and fresh routing smoke remain.

## files changed

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 01:32:45 `review.run`: passed — OK
- 2026-08-15 01:32:45 `review.run`: passed — OK
- 2026-08-15 01:32:45 `review.run`: passed — OK
- 2026-08-15 01:34:22 `verify`: passed — OK
- 2026-08-15 01:34:22 `verify`: passed — OK
- 2026-08-15 01:34:36 `verify`: passed — OK
- 2026-08-15 01:36:17 `verify`: passed — OK
- 2026-08-15 01:36:17 `verify`: passed — OK

## key decisions

- Reuse #1978 exactly at the public FastMCP boundary. Device Authority already owns node selection and consumes `arguments.nodeId` before inner execution.
- Do not merge the broader `stream/os` PR to ship this hotfix; current stream includes unrelated files.
- Do not touch the separate `lifecycle.status` issue.

## Test-first contract

- Behavior under test: the public FastMCP `call` signature includes optional top-level `nodeId`, and the facade never forwards it into `_traced_call`, `_run_workspace_call`, or inner `tool_input`.
- Existing local pattern: #1978 added focused signature/no-leak coverage in `packages/workspace/tests/server_call_test.py`; Device Authority routing tests already cover explicit/default/fail-closed node selection.
- New/changed tests: reapply only the #1978 `inspect.signature` and no-inner-leak tests to current `main` first.
- Focused RED command: run the two named unittest methods after static destructive-literal preflight.
- Expected RED: public `call` parameter list is `tool,input,taskSession,timeout`; invoking with `nodeId` raises an unexpected-keyword error.
- No-test waiver: none.

## notes for ko

- This is the exact public-schema boundary missing from ChatGPT. Device Authority routing code is unchanged; lifecycle/status and one-click cloud provisioning remain out of scope.

## improvements noticed

- none yet

## issues and recovery

- RED reproduced on current `main`: `test_call_public_signature_exposes_optional_node_id` failed because the public parameter list is `tool,input,taskSession,timeout`; `test_call_keeps_node_id_out_of_inner_workspace_input` errored because `call()` rejects the unexpected `nodeId` keyword. Trace: `trc_f3622ef09a03`.
- `task.pr` normally targets `stream/os`, but this hotfix explicitly must not ship the stream's unrelated 33 commits. After the isolated branch was pushed and verified against `origin/main`, PR #1982 was retargeted from `stream/os` to `main`. The typed GitHub facade has no `pr.edit` operation, so the scoped `github.raw` fallback was used only for `gh pr edit 1982 --base main` (`trc_61d9eba97887`).

### RED evidence

- Command: Python unittest running only `WorkspaceCallServerTest.test_call_public_signature_exposes_optional_node_id` and `WorkspaceCallServerTest.test_call_keeps_node_id_out_of_inner_workspace_input`.
- Result: 2 tests, 1 failure + 1 error, exactly matching the test-first contract before production edits.

### GREEN evidence

- Exact two focused tests pass 2/2 after adding optional public `nodeId` and keeping it out of the inner call. Trace: `trc_61df705e3f8f`.
- `py_compile` passes for `packages/workspace/server.py` and `packages/workspace/tests/server_call_test.py`. Trace: `trc_716c96b671b1`.
- Downstream unchanged routing regressions pass: `workspace-node-registry-routing.test.ts` 40/40 and `os-device-authority-worker.test.ts` 29/29, total 69/69. Trace: `trc_b523f3b376af`.
- Destructive-literal preflight was clean for all three executed test sources.
- Working-tree diff contains only the two intended code/test files plus scoped task metadata.

### Final validation before publish

- Strict review against `origin/main`: 0 task issues / 0 blockers. Trace: `trc_603ca9aa5a7f`.
- Test-selection inspection: zero auto-selected suites; no broad workspace/OS suite is hidden behind the verifier. The behavior tests above were run explicitly.
- Full guarded `verify --base origin/main`: `publishValid: true`, 0 DB risks/findings, exactly the two intended product/test files covered. Trace: `trc_9ac214710932`.
- Remaining acceptance after publish: isolated GitHub CI/main merge, runtime/server delivery, ChatGPT Refresh/Publish, and explicit `cloud-1` + default-route smoke.
- Strict review against `origin/main`: 0 blockers / 0 task-attributed issues; reported lint/typecheck findings are pre-existing and outside this two-file hotfix (`trc_51c9a7729bfb`).
- Full verify against `origin/main`: `passed=true`, `publishValid=true`, changed product files exactly `packages/workspace/server.py` + `packages/workspace/tests/server_call_test.py` (`trc_4886883595ee`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/tests/server_call_test.py`

- 2026-08-15 01:34:31 apply-patch: `.task/os/hotfix-explicit-cloud-node-targeting-to-main/workpad.md`

- 2026-08-15 01:34:43 apply-patch: `.task/os/hotfix-explicit-cloud-node-targeting-to-main/workpad.md`

- 2026-08-15 01:35:08 apply-patch: `.task/os/hotfix-explicit-cloud-node-targeting-to-main/workpad.md`
