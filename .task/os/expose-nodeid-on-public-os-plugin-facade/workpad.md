# expose nodeId on public os plugin facade

branch: `task/os/expose-nodeid-on-public-os-plugin-facade`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2004/expose-nodeid-on-public-os-plugin-facade
github pr: https://github.com/consuelohq/opensaas/pull/2004
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

- 2026-08-15 03:34:07 fs.write: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`
- 2026-08-15 03:39:59 fs.write: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`
- 2026-08-15 03:41:04 fs.write: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`
- 2026-08-15 03:47:39 fs.write: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 03:42:59 `verify`: failed — COMMAND_FAILED
- 2026-08-15 03:48:01 `verify`: passed — OK

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

behavior under test: the public ChatGPT Consuelo OS facade exposes optional top-level `nodeId` on `os.call`, forwards it as routing metadata to Device Authority before tool execution, omits it from the inner typed tool input, preserves default routing when omitted, and fails closed for invalid/offline targets.
existing local pattern: Device Authority already consumes `params.arguments.nodeId` and sets `routeSource=explicit`; the internal OS MCP gateway already documents optional `nodeId`. The missing boundary is the actual public OS facade that produced ChatGPT's current `{tool,input,taskSession,timeout}` schema. `packages/workspace/server.py` is explicitly out of scope/deprecated and must not be changed.
new or changed tests: add a focused contract around the authoritative public OS facade schema/dispatcher asserting exactly `get_steering` + `call`, optional `call.nodeId`, default routing on omission, explicit routing metadata forwarding, fail-closed invalid/offline selection, and no leakage into inner `input`.
focused red command: determine the owning OS facade test file, preflight it for destructive literals, then run only the new public-schema/routing assertions before production edits.
expected red failure: the authoritative public `os.call` schema currently lacks `nodeId` even though downstream routing supports it.
no-test waiver: not applicable.

- 2026-08-15 03:34:07 append: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`

## RED evidence

- Safety preflight found zero destructive-command literals in `packages/os/tests/mcp-gateway.test.ts` and `packages/os/tests/os-get-steering-trace.test.ts`.
- Focused RED command: `bun x vitest run tests/mcp-gateway.test.ts tests/os-get-steering-trace.test.ts` from `packages/os`.
- Result: 42 passed / 2 failed as intended.
- `mcp-gateway` failure proves `call.nodeId` exists but its published description does not identify it as the top-level selector.
- steering failure proves routing inventory is present but does not teach agents to pass `nodeId` at the top level of `os.call`, avoid searching node names as tools, or omit it for default routing.
- Live local OS `/mcp` probe independently returned exactly `get_steering` and `call`, with `call` properties `tool,input,taskSession,nodeId,timeout`; therefore the field is implemented and the remaining defect is agent-facing routing guidance/discoverability.

- 2026-08-15 03:39:59 append: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`

## GREEN evidence

- Focused RED→GREEN suite: `mcp-gateway.test.ts` + `os-get-steering-trace.test.ts`: 44/44 passed after production changes.
- Existing downstream routing regressions: `workspace-node-registry-routing.test.ts` + `os-device-authority-worker.test.ts`: 71/71 passed.
- OS package type/syntax check: `bun run typecheck` from `packages/os`: passed.
- Live local OS MCP probe after investigation: exactly two public tools (`get_steering`, `call`); `call` properties are `tool,input,taskSession,nodeId,timeout` with only `tool` required.

## acceptance criteria

- [x] Public OS `call` descriptor exposes optional top-level `nodeId` and identifies it as routing metadata.
- [x] Steering tells agents to use canonical `routing.availableNodes[].nodeId` at the top level of `os.call`.
- [x] Steering explicitly says nodes are routing targets, not tools, and forbids searching `tools.search` for a node name.
- [x] Omission semantics remain default routing.
- [x] Existing central routing remains fail-closed and `nodeId` is not leaked into inner typed tool input.
- [x] Exactly the two existing public MCP tools remain exposed.
- [ ] Strict review and guarded publish verification pass.
- [ ] Merge/release through the OS path and validate a brand-new ChatGPT session against `cloud-1`.

## files changed

- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`

## key decisions

- Do not touch deprecated `packages/workspace/server.py`; PR #1982 targeted the wrong boundary.
- Do not add a node-switch tool. Explicit node selection remains top-level MCP routing metadata consumed by Device Authority before tool execution.
- Fix discoverability in the canonical OS descriptor + guarded steering because the new-chat failure searched the inner tool catalog despite the routing machinery already being present.

- 2026-08-15 03:41:04 append: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`

## Selector/publish-gate evidence

- Added RED selector contract proving these four OS routing/steering files must not fall through to `@consuelo/os package test`.
- RED selector result: only the broad auto OS package rule matched.
- Added critical/exclusive `os-chatgpt-node-routing-facade` rule and regenerated the canonical test-selection registry.
- Corrected the facade-suite invocation to `bun run --cwd packages/os test ...` after proving root Vitest resolved the wrong dependency environment.
- Exact `test-selection check --base origin/main --run --json` is GREEN with seven bounded suites and zero failed suites:
  - workspace test-selection tests: 34 passed
  - OS ChatGPT node-routing facade contracts: 44 passed
  - OS ChatGPT node-routing authority contracts: 71 passed
  - OS node-routing syntax contract: passed
  - changed-server selector: 22 passed
  - GitHub workflow policy: 12 passed
  - TypeORM CLI compatibility: 2 passed
- An unrelated lifecycle facade snapshot generated during validation was restored to `origin/main`; it is absent from the final diff.

- 2026-08-15 03:47:39 append: `.task/os/expose-nodeid-on-public-os-plugin-facade/workpad.md`
