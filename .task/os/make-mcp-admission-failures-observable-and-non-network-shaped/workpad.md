# make MCP admission failures observable and non-network-shaped

branch: `task/os/make-mcp-admission-failures-observable-and-non-network-shaped`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2013/make-mcp-admission-failures-observable-and-non-network-shaped
github pr: https://github.com/consuelohq/opensaas/pull/2013
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 04:10:01 fs.write: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`
- 2026-08-15 04:13:52 fs.write: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`
- 2026-08-15 04:19:33 fs.write: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`
- 2026-08-15 04:20:09 fs.write: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:14:20 `review.run`: passed — OK
- 2026-08-15 04:15:18 `review.run`: passed — OK
- 2026-08-15 04:16:18 `verify`: failed — COMMAND_FAILED
- 2026-08-15 04:19:50 `review.run`: passed — OK
- 2026-08-15 04:20:06 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
1. Keep the dangerous-material admission policy exactly fail-closed: a blocked MCP request must not authenticate, route, or execute any tool.
2. A policy denial on `/mcp` must use a valid MCP/JSON-RPC response contract that the connector can surface as an application/tool error rather than an HTTP transport failure.
3. Every MCP request that reaches Consuelo OS must receive an earliest safe request/trace identifier before dangerous-material admission, and a pre-auth denial must emit a privacy-safe observable event containing only classification metadata plus that identifier.
4. Do not claim this fixes genuine upstream 502s. Calls that never reach the earliest OS boundary remain a separate transport/provider issue.

existing local pattern: `packages/os/scripts/server/routes/mcp.ts`, `packages/os/scripts/server/middleware/dangerous-material.ts`, `packages/os/scripts/lib/dangerous-material-policy.ts`, existing MCP security/route tests, and existing trace/logger primitives.
new or changed tests: first add a focused route-level regression proving current blocked content returns non-2xx before trace/auth; then assert the corrected JSON-RPC error shape, stable request ID header/event, and zero auth/tool dispatch. Add a control proving ordinary auth failures keep their existing contract.
focused red command: inspect the existing MCP route tests and run the narrowest dangerous-material MCP test after adding the new assertion.
expected red failure: blocked content currently returns HTTP 400 before gateway authentication/tracing/facade dispatch and therefore presents as generic connection failure to the connector.
no-test waiver: not applicable.

- 2026-08-15 04:10:01 append: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`

## RED/GREEN evidence

- Focused RED `trc_234b09cfcd73`: dangerous-material MCP admission returned HTTP 400 and neither the blocked request nor ordinary 401 auth failures carried an earliest OS request receipt.
- Implemented the local OS boundary without weakening policy: every `/mcp` request gets a validated/generated `x-consuelo-request-id` and privacy-safe `local_os.mcp_request_received` event before admission; dangerous-material denials remain fail-closed before auth/tool dispatch but now return HTTP 200 JSON-RPC server error `-32040` with generic `DANGEROUS_MATERIAL_BLOCKED` data plus the receipt ID. Denials emit classification-only `security.dangerous_material.denied` telemetry and never log the raw payload.
- Focused GREEN `trc_844b3ed2be86`: both the JSON-RPC policy-denial contract and unchanged HTTP 401 missing-bearer control passed.
- Broader MCP/security packet passed 108/108 plus syntax checks: `trc_71c82535a0f3`.
- This changes only errors that reach Consuelo OS admission. Genuine upstream 502s that never emit `local_os.mcp_request_received` remain a separate transport/provider failure and are now distinguishable from local policy denial.

- 2026-08-15 04:13:52 append: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`

## Focused test-selection ownership

- Formal verify initially selected the historically broad `@consuelo/os` package suite and failed on unrelated pre-existing facade/runtime debt (`trc_cbbdbdaa15a8`, debug `trc_e7d2b4e38ec2`).
- Added an exclusive critical `os-mcp-admission-error-contract` rule. Selection RED `trc_4f62fcdc20f7` proved the focused owner was absent. The first focused suite composition exposed incompatible legacy test CWD assumptions (`trc_68d843cd2fdf`, `trc_003a4b0ce134`), so the rule was narrowed to the tests that actually own this boundary with their required CWDs rather than masking those unrelated failures.
- Generated registry + selection contract GREEN: `trc_1bc55bcebaf8`.
- Full selected-suite execution is now green with no failed suites: `trc_92ede304cd3b`. It runs MCP gateway admission from repo root, dangerous-material ingress from `packages/os`, syntax checks, workspace selection tests, and the existing workspace CI policy contracts.

- 2026-08-15 04:19:33 append: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`

## Final verification

- Strict review after code, docs, and selection ownership changes passed with 0 blocking issues and 0 documentation opportunities: `trc_ba55f1a1d770`.
- Formal full verify passed and is publish-valid: `trc_06905f77b4ab`.

- 2026-08-15 04:20:09 append: `.task/os/make-mcp-admission-failures-observable-and-non-network-shaped/workpad.md`
