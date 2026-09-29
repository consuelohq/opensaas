# fix MCP diagnostics and boundedness review findings

branch: `task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2605/fix-mcp-diagnostics-and-boundedness-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2605
started: 2026-09-27

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

- 2026-09-27 16:55:48 fs.write: `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/workpad.md`
- 2026-09-27 17:00:25 fs.write: `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/workpad.md`
- 2026-09-27 17:03:35 fs.write: `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-09-27 17:00:14 `review.run`: passed — OK
- 2026-09-27 17:02:41 `review.run`: passed — OK

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
bun run task:push -- --message "type(tooling-reliability): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- MCP receipt middleware rejects oversized POST bodies before any `clone().text()` / JSON metadata inspection and bounds every receipt metadata field before logging or disk persistence.
- Terminal receipt phase derives from the actual response status: successful responses record `response_ready`; 5xx responses record `failed` even when Hono converts downstream exceptions into a response.
- Device Authority supplies deferred bookkeeping only when the Worker runtime provides `waitUntil`; without it, the proxy falls back to awaited bookkeeping so work is not abandoned.
- `server logs` resolves the same Consuelo home shapes as the receipt writer and reads only bounded tails of potentially large log files.
- Both JavaScript syntax runners validate `CONSUELO_SYNTAX_CHECK_TIMEOUT_MS` as a positive integer; invalid values fall back to the safe default instead of crashing or hanging verification.

existing local pattern:
- Stream already contains request receipts, runtime `server logs`, bounded Node-based syntax checks, response deferral, creation-affinity ordering, and explicit requestId replay.
- Current PR review identified boundedness/correctness gaps in those surfaces. Fix the concrete gaps without weakening the existing nonblocking response/replay contracts.

new or changed tests:
- MCP route test proving oversized bodies are rejected before receipt inspection and 500 responses emit `failed` receipt phase; metadata truncation/length bounds are asserted without storing raw payloads.
- Device Authority Worker/proxy test proving missing `waitUntil` does not install `defer` and therefore awaits bookkeeping.
- Diagnostics test with legacy/current Consuelo home variants and a large log fixture proving only a bounded tail is read/surfaced.
- Syntax-runner tests for invalid/non-integer/non-positive timeout configuration in both OS/workspace copies.

focused red command:
`bun x vitest run packages/os/tests/mcp-openai-session-receipt.test.ts packages/os/tests/mcp-response-diagnostics.test.ts packages/os/tests/os-device-authority-worker.test.ts packages/os/tests/check-syntax-runner.test.ts`

expected red failure:
- Oversized bodies are currently read before admission; 500 responses can be mislabeled `response_ready`; defer is supplied even without `waitUntil`; log commands read whole files / path handling can diverge; malformed syntax timeout env can reach `spawnSync`.

no-test waiver: not applicable.

- 2026-09-27 16:55:48 append: `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/workpad.md`

## RED evidence

- Focused RED produced seven expected failures across all reviewed gaps: invalid syntax timeout overrides, unbounded/full-file diagnostics, unconditional Worker defer fallback, oversized MCP body admission, unbounded receipt metadata, and 5xx receipt misclassification.

## GREEN implementation

- MCP receipt middleware now bounds HTTP POST bodies to 4 MiB before receipt metadata inspection. Declared oversized bodies are rejected immediately; chunked/undeclared bodies are read through a bounded stream reader and rejected once the byte ceiling is crossed. Oversized requests return 413 without writing a receipt derived from the body.
- Receipt metadata strings are capped to 256 characters before server logging or durable receipt persistence.
- Terminal receipt phase now derives from actual response status as well as thrown middleware errors, so HTTP 5xx is recorded/logged as `failed` instead of `response_ready`.
- Device Authority only supplies `defer` when Durable Object `waitUntil` exists. Environments without `waitUntil` fall back to the proxy's awaited bookkeeping path instead of launching untracked work.
- Both OS/workspace `server logs` paths now normalize `CONSUELO_HOME` / `CONSUELO_OS_HOME`, legacy `.consuelo/os`, and leading `~` consistently. Log output reads only a 256 KiB tail window and emits the last 50 lines rather than loading arbitrarily large files.
- Both OS/workspace JavaScript syntax runners now accept only safe integer timeout overrides from 1s through 60s; malformed, fractional, non-positive, or excessive values fall back to the 10s default.

## Validation

- Focused review-finding tests: 71/71 green.
- Broader relevant regression pass: MCP gateway/recovery/receipt/diagnostics + Worker/lifecycle/syntax = 110/110; workspace node routing = 73/73; test-selection = 89/89.
- `node --check` on both reload scripts and `git diff --check` passed.
- Test selection remains fully focused/critical via existing MCP admission, MCP response completion, bounded syntax-runner, lifecycle, and Device Authority rules; no broad `@consuelo/os package test` fallback.
- Strict review is clean with zero blockers; only a nonblocking public MCP documentation opportunity remains.

## Decisions

- Reuse the existing 4 MiB MCP stdio body ceiling for HTTP ingress so transports have one bounded request-size expectation.
- Keep receipt logs metadata-only; body/result payloads are not added to the diagnostic receipt path.
- Do not use `Promise.catch` as a fake Worker lifetime extension when `waitUntil` is unavailable; awaiting is slower but correct and bounded to the actual bookkeeping operation.

- 2026-09-27 17:00:25 append: `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/workpad.md`

## Final gate

- The first detached full verify surfaced one mechanical review blocker in the newly touched MCP middleware: an awaited bounded-body read without a nearby catch. Added fail-closed `MCP_BODY_READ_FAILED` handling (400) and reran focused MCP contracts: 37/37 green.
- Strict review rerun: zero blockers / zero related-pre-existing findings.
- Detached full verify run `f87915d21d5cd2e40e2d78663e210ef808e3d9517648e747d3d368d4faa8b3d0` completed successfully. All 15 selected critical suites passed, DB guard passed with zero risks/findings, and `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/verify.json` is publish-valid.

- 2026-09-27 17:03:35 append: `.task/tooling-reliability/fix-mcp-diagnostics-and-boundedness-review-findings/workpad.md`
