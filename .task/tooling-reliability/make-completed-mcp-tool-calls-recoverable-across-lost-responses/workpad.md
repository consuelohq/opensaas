# make completed MCP tool calls recoverable across lost responses

branch: `task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2602/make-completed-mcp-tool-calls-recoverable-across-lost-responses
github pr: https://github.com/consuelohq/opensaas/pull/2602
started: 2026-09-26

## acceptance criteria

- [x] Completed MCP responses are not held open by post-upstream affinity bookkeeping.
- [x] Each public MCP request is correlated with a stable request id across edge -> local OS.
- [x] Local MCP ingress records metadata-only received/response-ready/failed receipts before response handoff.
- [x] Runtime diagnostics expose recent MCP receipts without requiring the controller checkout.
- [x] Verify syntax gates cannot recurse into `bun --check` and hang when launched under Bun.
- [x] Focused selector coverage prevents these reliability changes from falling back to the broad OS package suite.

## plan

1. Reproduce the completion stall at the MCP/edge boundary and identify post-response work.
2. Make response handoff independent of affinity bookkeeping and add stable request correlation/receipts.
3. Add future-agent diagnostics through runtime `server logs`.
4. Reproduce and fix any additional blocking verify paths encountered during validation.
5. Prove focused selection, strict review, and publish-valid detached verify.

## current status

- Implementation complete. Strict review is clean and detached full verify is publish-valid. Ready to push and promote to the tooling-reliability stream.

## files changed

- MCP/Device Authority response proxy and runtime wiring.
- MCP request receipt persistence and runtime diagnostics.
- Server tool runtime routing and generated manifest/baseline.
- Bounded OS/workspace JavaScript syntax runners.
- Regression and selector coverage for response completion and syntax-runner stalls.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-26 19:30:31 fs.write: `.task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses/workpad.md`
- 2026-09-26 19:53:04 fs.write: `.task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses/workpad.md`
- 2026-09-27 16:30:53 fs.write: `.task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses/workpad.md`

## workspace-owned: validation evidence

- 2026-09-27 16:31:09 `review.run`: passed — OK
- 2026-09-27 16:32:09 `verify`: failed — COMMAND_FAILED

## key decisions

- Do not persist raw tool arguments or raw tool results in response receipts; keep diagnostics metadata-only.
- Return the upstream MCP response before best-effort affinity bookkeeping and attach bookkeeping to the Worker execution context.
- Treat agent-facing verify as a detached durable operation; use short polls/replay instead of holding the tool turn.
- Run syntax checks through explicit Node with a per-file timeout even when the wrapper itself is launched by Bun.

## notes for ko

- This task fixes two distinct stall sources we reproduced: post-upstream MCP bookkeeping and `bun --check` recursion inside verify.
- The durable receipt tells a future agent whether Consuelo actually produced the MCP response. If the receipt says `response_ready` but the client is still spinning, the failure is downstream of local OS execution.
- Direct source verify now returns `VERIFY_PENDING` in about half a second and later replays the completed publish-valid result.

## improvements noticed

- none yet

## issues and recovery

- The first typed verify attempt ran through the installed/stale runtime and stayed synchronous for ~51s. Source-worktree verify correctly returned `VERIFY_PENDING` in ~0.5s; this confirms the source behavior we want to ship.
- Full test selection initially failed because an existing selector regression expected the canonical `os-bounded-js-syntax-runner` rule name. Aligned the source rule and reran; full detached verify passed 23 selected suites.
- A validation run exposed `check-syntax.js` spawning `bun --check` via `process.execPath` under Bun. Both copies now delegate to Node with bounded child timeouts.

---

## publish checklist

```bash
bun run task:push -- --message "type(tooling-reliability): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- Every public MCP tool invocation gets a durable request identity before execution and records terminal completion before the HTTP/MCP response is handed back to the client.
- A retry/recovery lookup can distinguish `running`, `completed`, `failed`, and `unknown` even if the original response was lost after the side effect completed.
- Reusing the same request identity for a completed mutating call must replay the recorded terminal result instead of executing the mutation again.
- The public tool boundary must remain bounded: no new polling loop or long synchronous wait may be added to agent-facing calls.
- Diagnostics must expose enough metadata to tell `tool still running` from `tool completed but response likely lost`.

existing local pattern:
- Tool schemas already accept optional `requestId` in many commands, but there is no confirmed cross-tool durable request journal/replay surface at the MCP envelope.
- Facade results include `traceId` only after a response is received, which does not help when the response itself is lost.
- Durable operation managers exist for some long-running workflows (for example release/verify) and are the model for status/replay semantics.

new or changed tests:
- MCP gateway/request-ledger tests for start -> terminal record -> replay by requestId.
- A mutating fake executor test proving the same requestId executes the mutation exactly once and a second invocation replays the saved result.
- Recovery/status test proving a terminal ledger entry remains queryable independent of the original HTTP response.
- Selector coverage so changes to the request ledger/gateway run focused contracts.

focused red command:
`bun x vitest run packages/os/tests/mcp-gateway.test.ts packages/os/tests/facade/request-recovery.test.ts`

expected red failure:
- No envelope-level durable request journal/status/replay contract exists yet.

no-test waiver: not applicable.

- 2026-09-26 19:30:31 append: `.task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses/workpad.md`

## Additional stall reproduction: syntax gate

- While validating this task, `bun packages/os/scripts/check-syntax.js` reproduced the same user-visible failure class: the tool call timed out while its child continued running.
- Process inspection showed the syntax runner stuck on its very first file as `bun --check packages/os/scripts/wait.js` for more than two minutes.
- Root cause: `check-syntax.js` is launched by Bun but uses `process.execPath` as though it were Node, so every syntax check invokes `bun --check`; that command does not terminate as the script expects.
- Add a regression that requires an explicit Node executable plus a per-file timeout, then make the syntax gate bounded. This is directly relevant because several critical selector rules invoke this script during verify.

- 2026-09-26 19:53:04 append: `.task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses/workpad.md`

## Implemented response-boundary hardening

- Device Authority now forwards a stable `x-consuelo-request-id` to the local OS MCP server.
- Local `/mcp` records metadata-only durable receipts at `received` and terminal `response_ready` / `failed` phases before the response leaves the local server. Receipts include request id, JSON-RPC id, public/facade tool names, task/work session ids, HTTP status, and duration, but no tool arguments or result payloads.
- `server logs` runs from the installed runtime and includes recent MCP receipts, so a future agent can distinguish `tool still running` from `local OS produced the response and delivery stalled downstream`.
- Post-upstream task/work affinity bookkeeping is deferred with the Cloudflare execution context instead of holding the MCP response open. Regression proves the response returns while bookkeeping is intentionally blocked.
- Existing explicit caller request ids are preserved; transport request ids are injected only when the inner call has none.

## Additional verify stall fixed while validating this task

- `packages/os/scripts/check-syntax.js` was launched by Bun during some verify paths, then recursively used `process.execPath --check`; under Bun that became `bun --check`, which hung on the first file.
- Both OS/workspace syntax runners now delegate explicitly to Node when launched under Bun and bound every child syntax check with a timeout.
- Added a Bun-launched regression for both copies and a critical/exclusive selector rule so syntax-runner changes do not fall back to the broad `@consuelo/os package test`.
- Focused regression passed: both runners complete the `wait.js` syntax check in under the 3s test envelope.

- 2026-09-27 16:30:53 append: `.task/tooling-reliability/make-completed-mcp-tool-calls-recoverable-across-lost-responses/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
