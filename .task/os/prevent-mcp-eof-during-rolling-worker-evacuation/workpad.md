# Prevent MCP EOF during rolling worker evacuation

branch: `task/os/prevent-mcp-eof-during-rolling-worker-evacuation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2132/prevent-mcp-eof-during-rolling-worker-evacuation
github pr: https://github.com/consuelohq/opensaas/pull/2132
started: 2026-08-16

## acceptance criteria

- [x] Preserve in-flight MCP responses through worker drain and exit.
- [x] Keep a bounded force-close fallback for stuck work.
- [ ] Pass critical validation and live same-version update acceptance after shipping.

## plan

1. Reproduce the worker EOF boundary.
2. Reorder drain so handler completion and response flush precede listener stop.
3. Validate, ship, promote, and repeat live same-version update acceptance.

## current status

- Focused implementation is green; critical validation and release acceptance remain.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/server/main.ts`
- `packages/os/tests/health-readiness.test.ts`

## workspace-owned: files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/server/main.ts`
- `packages/os/tests/health-readiness.test.ts`

## workspace-owned: activity log

- 2026-08-16 05:17:58 fs.write: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`
- 2026-08-16 05:59:52 fs.write: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`
- 2026-08-16 06:03:36 fs.write: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:02:31 `review.run`: passed — OK
- 2026-08-16 06:02:56 `verify`: failed — COMMAND_FAILED
- 2026-08-16 06:04:55 `review.run`: passed — OK
- 2026-08-16 06:05:11 `verify`: passed — OK

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

behavior under test: rolling replacement must preserve MCP responses and stop sending new work to a worker before its listener is retired.
existing local pattern: each worker exposes readiness; the supervisor transitions one worker at a time and Caddy uses readiness for upstream selection.
new or changed tests: add focused worker-drain coverage for a request spanning the drain transition and for readiness propagation before listener retirement.
focused red command: pending source audit.
expected red failure: the current worker can retire before Caddy has fully evacuated it.
no-test waiver: none.

- 2026-08-16 05:17:58 append: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/worker-runtime-state.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.rules.json`

## Agent update 2026-08-16

Root cause: 0.1.59 removed the no-op Caddy reload, but live same-version update still produced MCP EOF while a worker retired. Bun graceful server stop was starting before the active handler finished; worker exit could then truncate proxy-facing response bytes.

Implementation: drain now marks readiness unavailable, waits for Caddy propagation, stops new app work, waits for active handlers, waits one bounded response-flush interval, then closes the listener gracefully. The existing force-close path remains for drain timeout.

Focused evidence: the real child-Bun 2 MB response regression passed five consecutive runs (`trc_152856ab8ff2`); the full health-readiness file is 8/8 green (`trc_69707c61715e`).

Changed files: `packages/os/scripts/server/main.ts`, `packages/os/tests/health-readiness.test.ts`, `packages/os/SCRIPTS.md`.

Remaining: critical lifecycle gate, strict review, formal verify, task/stream/main merge, signed runtime publication, canary promotion, and same-version live update acceptance with no MCP EOF/502.

- 2026-08-16 05:59:52 append: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`

- 2026-08-16 05:59:58 apply-patch: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`

Validation update: critical lifecycle coverage is 204/204 green (`trc_e2d871d1816a`, `trc_fed517adeca0`); test-selection integrity is 39/39 (`trc_900022c03086`); syntax checks passed (`trc_3ce25f8108fa`). Formal verify is currently blocked only by a mechanical related-pre-existing async error-boundary finding in `server/main.ts`.

- 2026-08-16 06:03:36 append: `.task/os/prevent-mcp-eof-during-rolling-worker-evacuation/workpad.md`

- 2026-08-16 06:03:49 apply-patch: `packages/os/scripts/server/main.ts`
- 2026-08-16 06:03:56 apply-patch: `packages/os/scripts/server/main.ts`

- 2026-08-16 06:04:29 apply-patch: `packages/os/scripts/server/main.ts`
