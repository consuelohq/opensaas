# Preserve MCP response streams during worker drain

branch: `task/os/preserve-mcp-response-streams-during-worker-drain`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2143/preserve-mcp-response-streams-during-worker-drain
github pr: https://github.com/consuelohq/opensaas/pull/2143
started: 2026-08-16

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

- 2026-08-16 06:59:44 fs.write: `.task/os/preserve-mcp-response-streams-during-worker-drain/workpad.md`
- 2026-08-16 07:07:55 fs.write: `.task/os/preserve-mcp-response-streams-during-worker-drain/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 07:08:25 `review.run`: passed — OK
- 2026-08-16 07:08:49 `verify`: passed — OK

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

behavior under test: worker request accounting must remain active until the HTTP response body is consumed or canceled, not merely until Hono returns the `Response`; drain must therefore wait for response streaming/backpressure before allowing worker exit.
existing local pattern: `createLocalOsApp` calls `workerState.beginRequest()` before non-probe routes and currently calls `endRequest()` in a `finally` immediately after `await next()`. `drainWorkerServer` now waits `workerState.waitForIdle()` before its bounded flush/listener-stop sequence.
new or changed tests: add deterministic app middleware coverage proving an unconsumed response keeps `activeRequests=1`, consuming the body releases it to 0, and cancel/error paths release exactly once. Keep the existing real child-Bun drain regression.
focused red command: run the new app response-lifecycle test before production edit.
expected red failure: current middleware reports `activeRequests=0` as soon as Hono returns an unconsumed response.
no-test waiver: none.

## Live evidence

0.1.62 same-version update operation succeeded and watchdog/Caddy/Cloudflared stayed loaded. A controlled 8-second MCP tool call survived. Caddy nevertheless logged three `/mcp` EOF/502 responses whose proxy durations show they began at 06:56:19.881, 06:56:21.837, and 06:56:23.143—before the 06:56:31 acceptance baseline and the 06:56:35 update. Local OS receipts confirm all three had entered `/mcp`. They were cut when the first worker exited around 06:56:38, demonstrating handler-level idle is earlier than network response completion for concurrent requests (`trc_813a6cbfc05d`, `trc_046fcda7cb48`, `trc_fcc2b8b24b48`).

- 2026-08-16 06:59:44 append: `.task/os/preserve-mcp-response-streams-during-worker-drain/workpad.md`

## workspace-owned: files read

- `packages/documentation/src/content/docs/reference/configuration.mdx`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-16 07:06:30 apply-patch: `packages/os/tests/health-readiness.test.ts`
- 2026-08-16 07:07:04 apply-patch: `packages/os/SCRIPTS.md`
- 2026-08-16 07:07:04 apply-patch: `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- 2026-08-16 07:07:04 apply-patch: `packages/documentation/src/content/docs/reference/configuration.mdx`
## Validation update

- Deterministic RED: `activeRequests` was already 0 before an unconsumed response body was read (`trc_8bc8931ac119`).
- Response completion implementation: local OS middleware now keeps the worker request active until the response body finishes or is canceled; handler errors release immediately and release is idempotent.
- Focused deterministic completion test passed (`trc_ee9f217da986`).
- Focused health-readiness now includes normal completion, cancellation, the prior drain contract, the existing child-Bun response test, and a new real Bun `createLocalOsApp` slow-stream drain test; 11/11 passed (`trc_7eb3f99f5843`).
- `server/app.ts` is now an explicit source for the exclusive critical `os-lifecycle-update-handoff` rule; registry regenerated from rules (`trc_4417ad7f7230`) and selector coverage is 44/44 (`trc_4df8661c322a`).
- Final critical lifecycle gate: 19 files / 208 tests passed; final selector gate 44/44 passed (`trc_743c8cfdd0ad`).
- Documentation validation, 19/19 foundation tests, and OS syntax passed (`trc_7889d9e2196c`).
- Extra local app architecture/product contract tests passed. The signed edge E2E trace subroute failed only because its Node-based Vitest environment cannot import `bun:sqlite`; the failure occurred in trace DB initialization before response tracking (`trc_a05d73c01a60`).
- Product/docs/CI diff is eight files: response middleware, health regressions, lifecycle docs/public docs, explicit selection rule, generated selection registry, and selection test.

Remaining: strict review, formal verify, direct-main hotfix merge, signed runtime publication/promotion, then clean live same-version acceptance with no post-baseline MCP EOF/502.

- 2026-08-16 07:07:55 append: `.task/os/preserve-mcp-response-streams-during-worker-drain/workpad.md`
