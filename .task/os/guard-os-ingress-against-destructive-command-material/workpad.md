# guard OS ingress against destructive command material

branch: `task/os/guard-os-ingress-against-destructive-command-material`
stream: `stream/os`
taskSession: `tsk_82b31259580c`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1095/guard-os-ingress-against-destructive-command-material
github pr: https://github.com/consuelohq/opensaas/pull/1095
started: 2026-06-16

## acceptance criteria

- [ ] OS-only follow-up focused on preventing destructive command material from entering normal MCP/tool handling during migration.
- [ ] Identify current OS server ingress/router/facade path and why destructive literals can reach lower execution guards today.
- [ ] Define a canonical dangerous-material policy in OS security code.
- [ ] Enforce the policy first at OS Bun/MCP ingress before normal tool dispatch, tracing/persistence, batching, task-session resolution, or forwarding where the current code allows.
- [ ] Reuse the same policy at lower execution/facade boundaries where practical as defense in depth.
- [ ] Add tests that do not execute destructive-literal test files or real destructive commands; use pure policy tests and mocked/constructed ingress payloads only.
- [ ] Add steering/docs note so future agents do not run broad destructive-literal tests directly.
- [ ] Do not run `python3 packages/os/tests/server_call_test.py` or any broad destructive-literal test target during this task.
- [ ] Promote to `stream/os` and report the stream review PR.

## plan

1. Use context/explore to find OS MCP/Bun server ingress, router/facade execution guards, existing safety policy, and tests.
2. Write/update focused tests first: pure policy classification plus ingress admission rejection with no process execution.
3. Run focused red tests only, avoiding broad destructive-literal suites.
4. Implement smallest OS-only ingress guard and docs/steering rule.
5. Run focused green tests, static checks, review, and verify against `origin/stream/os`.
6. Push, promote to stream, and finish only after reviewable state is verified.

## test-first contract

Behavior under test:
- A request body/tool payload containing destructive command literals is rejected at OS server ingress before becoming a normal tool call.
- Nested batch/tool payloads are included in admission scanning.
- The policy returns a sanitized security event/reason and does not require persisting raw dangerous payloads.
- Non-command text and normal safe tool calls pass.
- Lower execution guard continues to use the same policy where practical.

Existing local pattern to follow:
- pending; will be filled after file discovery.

New or changed tests:
- pending; will be filled after file discovery.

Focused red command:
- pending; must not run broad destructive-literal Python or trace gateway suites.

Expected red failure:
- pending; likely ingress currently accepts decoded JSON with destructive command material until lower execution guard.

## current status

- Task created from `stream/os`.
- Stream context trace: `trc_ef32ad603a22`.
- Task start trace: `trc_8ba42b008bea`.
- Safety constraint: destructive-literal test files are not to be executed directly in this task.

## files changed

- `packages/os/scripts/lib/dangerous-material-policy.ts`
- `packages/os/tests/dangerous-material-policy.test.ts`

## key decisions

- Start from `stream` because this is a direct OS follow-up during migration.
- Use pure/mocked test strategy; do not rely on live guardrail execution as proof.

## notes for Ko

- The intended fix is OS-first. Workspace parity is out of scope unless discovery shows a generated/shared OS package boundary requires it.

## improvements noticed

- none yet

## issues and recovery

- `fs.write` with `force: true` failed against the bootstrap workpad; `fs.patch` is not a tool and deleting/recreating with `fs.apply_patch` + `fs.write` recovered the workpad.

---

## publish checklist

- Use `task.push`, `task.pr`, and `task.finish` through the workspace facade after validation.

- 2026-06-16 21:24:47 write: `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/dangerous-material-policy.ts`
- `packages/os/tests/dangerous-material-policy.test.ts`

## workspace-owned: activity log

- 2026-06-16 21:24:47 fs.write: `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`
- 2026-06-16 21:30:50 fs.write: `packages/os/tests/dangerous-material-policy.test.ts`
- 2026-06-16 21:32:08 fs.write: `packages/os/scripts/lib/dangerous-material-policy.ts`
- 2026-06-16 21:35:19 fs.write: `packages/os/tests/dangerous-material-policy.test.ts`
- 2026-06-16 21:39:54 fs.write: `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`
- 2026-06-16 21:41:11 fs.write: `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/local-guardrails.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/worker/runtime.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/dangerous-material-policy.test.ts`
- `packages/os/tests/security-gateway.test.ts`

- 2026-06-16 21:34:33 apply-patch: `packages/os/tests/dangerous-material-policy.test.ts`
- 2026-06-16 21:34:56 apply-patch: `packages/os/tests/dangerous-material-policy.test.ts`
- 2026-06-16 21:35:19 write: `packages/os/tests/dangerous-material-policy.test.ts`

- 2026-06-16 21:37:20 apply-patch: `packages/os/steering/system_prompt.md`
## discovery evidence

- `packages/os/scripts/server.ts` is the Bun server ingress. Before this change, `/call` read the body, authenticated/scope-checked it, parsed it into `CallInput`, and forwarded it to `executeCall` without semantic dangerous-material admission.
- `packages/os/scripts/os.ts` `executeCall` recorded `callInput.input` through `recordExecutionStarted` before dispatch, so dangerous command-shaped material could enter normal trace/persistence flow before lower execution guards.
- Existing lower safety logic existed in worker/runtime and local shell guardrails, but not at Bun server ingress.

## implementation

- Added `packages/os/scripts/lib/dangerous-material-policy.ts` as the canonical OS dangerous-material policy with sanitized security events and recursive decoded payload scanning.
- Wired `packages/os/scripts/server.ts` to check raw `/call` bodies before JSON parsing/auth and decoded call input before auth/dispatch.
- Wired `packages/os/scripts/os.ts` to use the same policy before `recordExecutionStarted` as a backup net.
- Added steering rule in `packages/os/steering/system_prompt.md`: broad destructive-literal test files must not be executed; use static, pure policy, mocked/trapped executor, or explicit sandbox harness.
- Added `packages/os/tests/dangerous-material-policy.test.ts`; tests construct dangerous command-shaped strings from pieces and never invoke them as commands.

## validation evidence

- Red: `bun --cwd packages/os test tests/dangerous-material-policy.test.ts` failed before implementation because `scripts/lib/dangerous-material-policy` did not exist; trace `trc_d18423873148`.
- Green focused: `bun --cwd packages/os test tests/dangerous-material-policy.test.ts` passed 4 tests; trace `trc_ae347183dfdb`.
- Static syntax: `cd packages/os && bun run typecheck` passed with `workspace script syntax checks passed`; trace `trc_0ec36ca5bd12`.
- Diff inspection: `git.diff` working tree showed OS-only runtime/test/steering/task metadata changes; trace `trc_98577c768798`.

## validation intentionally not run

- Did not run `python3 packages/os/tests/server_call_test.py`.
- Did not run broad destructive-literal test files.
- `review.run` was attempted with `noTests: true` but was blocked by the transport wrapper before execution; not retried with a broader command because this task is explicitly safety-sensitive.

- 2026-06-16 21:39:54 append: `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`

## workspace-owned: validation evidence

- Red: `bun --cwd packages/os test tests/dangerous-material-policy.test.ts` failed before implementation because `scripts/lib/dangerous-material-policy` did not exist; trace `trc_d18423873148`.
- Green focused: `bun --cwd packages/os test tests/dangerous-material-policy.test.ts` passed 4 tests; trace `trc_ae347183dfdb`.
- Static syntax: `cd packages/os && bun run typecheck` passed with `workspace script syntax checks passed`; trace `trc_0ec36ca5bd12`.
- Diff inspection: `git.diff` working tree showed OS-only runtime/test/steering/task metadata changes; trace `trc_98577c768798`.
- 2026-06-16 21:40:49 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/guard-os-ingress-against-destructive-command-material/current.json`, `.task/os/guard-os-ingress-against-destructive-command-material/evidence-log.json`, `.task/os/guard-os-ingress-against-destructive-command-material/read-log.json`, `.task/os/guard-os-ingress-against-destructive-command-material/session.json`, `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`, `.task/tasks/os/guard-os-ingress-against-destructive-command-material.json`, `packages/os/scripts/lib/dangerous-material-policy.ts`, `packages/os/scripts/os.ts`, `packages/os/scripts/server.ts`, `packages/os/steering/system_prompt.md`, `packages/os/tests/dangerous-material-policy.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## verify evidence

- Workspace verify against `origin/stream/os` passed and wrote publish-valid stamp; trace `trc_d8dc0a0bad9a`.
- Verify review/static/typecheck/spec/db checks passed. Verify selected zero test suites, so the explicit focused test trace `trc_ae347183dfdb` remains behavior proof.
- Review reported two pre-existing error-handling findings in `packages/os/scripts/os.ts` and `packages/os/scripts/server.ts`; no own blocking findings.

- 2026-06-16 21:41:11 append: `.task/os/guard-os-ingress-against-destructive-command-material/workpad.md`
