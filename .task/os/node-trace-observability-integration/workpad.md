# Node trace observability integration

branch: `task/os/node-trace-observability-integration`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1891/node-trace-observability-integration
github pr: https://github.com/consuelohq/opensaas/pull/1891
started: 2026-08-12

## acceptance criteria

- [x] Persist node-routing metadata as first-class trace fields without exposing provider machine types.
- [x] Propagate MCP node-routing context into facade traces without adding routing data to nested facade tool input.
- [x] Show a user-facing `Node` column in the canonical Traces table, with routing source as secondary context.
- [x] Add node and routing-source filters plus Node/Route facts in trace details.
- [x] Preserve existing trace redaction, authentication visibility rules, visual-shell asset hashes, and fail-open persistence behavior.
- [x] Keep Branch 10 isolated from task affinity, Nodes launcher/default-node UI, cloud pricing/provisioning, and deployment work.
- [x] Pass focused persistence, MCP routing, trace inspector, canonical site, security/regression, review, and verify gates.

## plan

1. Add focused tests for the visible Node column, node/routing filtering, and MCP routing propagation, then confirm the expected red failures.
2. Add request-scoped trace routing context and persist additive nullable routing columns in `tool_traces`.
3. Attach Branch 8 MCP routing context to facade execution while keeping `nodeId` outside nested facade input.
4. Surface node/routing fields through the existing local trace read backend and inherit them into batch child rows.
5. Extend the OS-owned trace inspector with Node table cells, node/route facets, search, and detail facts.
6. Patch the generated canonical v38 surface at build time for the extra Node column, rebuild the OS-owned browser runtime, and keep copied visual-shell assets unchanged.
7. Run focused tests, typecheck, strict review, verify, inspect the final diff, and publish only this task branch.

## Test-first contract

- Behavior under test: an MCP-routed facade call records the resolved node and route source; the Traces UI displays that node, can filter/search by node and routing source, and does not expose provider machine type.
- Existing local pattern: `trace-persistence.ts` -> local trace read backend -> trace inspector formatters/runtime -> `observability-traces-site.ts` canonical page builder.
- New/changed tests: `observability-traces-site.test.ts`, `trace-site-inspector-os-owned.test.ts`, `mcp-gateway.test.ts`, and persistence coverage after the request-context seam exists.
- Focused red command: `bunx vitest run tests/observability-traces-site.test.ts tests/trace-site-inspector-os-owned.test.ts tests/mcp-gateway.test.ts` from `packages/os`.
- Expected red failure: Node header/formatters/filters and the third routing-context execution argument do not exist yet on the Branch 8 stream baseline.

## current status

- Implementation complete on the Branch 8 `stream/os` base. Node routing now propagates into facade traces, persists as indexed nullable trace fields, is returned by the existing local trace backend, and appears in the canonical Traces table/filter/detail surfaces. Ready to publish after the final verification stamp.

## files changed

- Trace request context/persistence: `trace-routing-context.ts`, facade logger, MCP route/call service, trace persistence, local trace read backend.
- Trace presentation: inspector model/formatters/browser/virtual list, canonical Traces site builder, rebuilt inspector runtime.
- Tests: MCP routing, persistence/migration/read-backend, trace inspector filtering/inheritance, canonical Traces table.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- RED: focused TDD run produced the expected 3 failures before production edits (Node header, node format/filter behavior, MCP routing execution context).
- GREEN: focused Branch 10 suite passed 61/61 tests across persistence, canonical Traces site, inspector, interactions, and MCP routing.
- GREEN: adjacent trace/security regression suite passed 32/32 tests across trace gateway reads/routes and MCP scope authorization.
- GREEN: `bun run typecheck` / workspace syntax checks passed.
- 2026-08-12 14:37:35 `review.run`: passed — OK
- 2026-08-12 14:37:50 `verify`: passed — OK
- 2026-08-12 14:38:33 `verify`: passed — OK

## key decisions

- User-facing table shows `Node`, never provider machine type.
- Routing source is secondary node context plus a filter/detail field, not a separate primary table column.
- Use request-scoped async context so nested facade/batch traces inherit routing without polluting facade inputs.
- Add nullable trace DB columns with in-place migration; trace availability must never affect tool correctness.
- Keep copied v38 visual-shell assets byte-identical; rebuild the OS-owned browser runtime from source after inspector changes.
- Public MCP wire semantics are unchanged; the MCP route edit only attaches already-trusted Branch 8 routing metadata to tracing, so no MCP reference-doc change is required in this branch. The visible Traces UI behavior is covered by the existing product surface/tests.

## notes for ko

- Branch 10 owns trace observability only. Branches 9/11 and cloud work remain parallel and out of scope.

## improvements noticed

- none yet

## issues and recovery

- Initial task PR #1889 was created from `main` by the task-start default. Before any commit/publish, strict review exposed the divergent `stream/os` base and unrelated files. Work was rematerialized safely as PR #1891 from `stream/os`; the old task remains unmerged/unpublished and is not being deleted without separate cleanup approval.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-08-12 14:38:25 apply-patch: `.task/os/node-trace-observability-integration/workpad.md`
