# Trace Gateway Boundary Contracts

## Acceptance Criteria

- PR remains contract-only: no UI polish, no productization rewrite, no trace service implementation.
- Lock the product modes: `local-networked` default, `cloud-compute` same hosted Sites/gateway contract, `local-off-network` future installer/settings work unless a bridge exists.
- Treat Consuelo Gateway as the only public Sites boundary for trace read, live updates, ingest, and runner control.
- Sites must not read local trace DBs, local agents, cloud runners, raw trace files, or raw internal trace services directly.
- Encode Trace and Trace Burn as hosted Sites, not pages.
- Encode live behavior: snapshot first, SSE first, cursor polling fallback, WebSocket later, idempotent append-only deltas.
- Encode gateway duties from the research packet: auth/session scope, workspace routing, allow/deny, rate limits, service discovery, protocol translation, aggregate cache, circuit breaking, logs/metrics/analytics.
- Encode ingest/read guardrails: workspace identity, Site scope, source metadata, bounded payload/window, redaction, cursor, idempotency.
- Keep retention configurable by workspace policy and decoupled from commercial plans.

## Research Notes

- Transcript/research packet says default local is still in the Consuelo network: local compute, hosted Consuelo Sites, hosted trace API/analytics, relay/gateway path.
- Cloud compute changes where compute runs, not the Sites/read/gateway contract.
- Fully off-network local is real but out of scope for this PR except as a future bridge/installer/settings mode.
- API gateway packet reinforces the missing system-design layer: stable public entrypoint, auth, routing, service discovery, request/response transformation, caching, rate limits, circuit breaking, and observability.

## Test-First Contract

- Behavior under test: Trace/Trace Burn Sites gateway boundary and live trace semantics.
- Existing local pattern: Vitest contract tests in `packages/os/tests/trace-sites-gateway-contract.test.ts` import pure constants/helpers from `packages/os/scripts/lib/trace-sites-gateway-contract.ts`.
- New or changed tests: expand the contract test to require Trace and Trace Burn Site slugs, gateway duties, service discovery details, read-query guardrails, live snapshot/delta semantics, and stricter ingest source metadata.
- Focused red command: `cd packages/os && bun test tests/trace-sites-gateway-contract.test.ts`.
- Expected red failure: missing new exports/fields before the contract module is updated.

## Files Changed

- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/tests/trace-sites-gateway-contract.test.ts`

## Validation

- Pending red focused test.
- Pending green focused test.
- Pending typecheck/review/verify as appropriate.

## Follow-Up Notes

- PR2 should wire existing trace read paths behind this gateway contract.
- PR3 should implement live SSE/polling transport.
- PR4 should harden relay/cloud runner production behavior.

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/trace-sites-gateway-contract.test.ts`
- Research packet files under `/var/folders/.../consuelo-research/20260613T121804Z-youtu-be-6ULyxuHKxg8-si-Hs5rFQFhAdZZmF8L-a46319cb`
- Attached transcript/alignment notes in `/Users/kokayi/.codex/attachments/*/pasted-text.txt`

- 2026-06-13 12:58:22 write: `.task/sites/trace-gateway-boundary-contracts/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/tests/trace-sites-gateway-contract.test.ts`

## workspace-owned: activity log

- 2026-06-13 12:58:22 fs.write: `.task/sites/trace-gateway-boundary-contracts/workpad.md`
- 2026-06-13 12:59:33 write: `packages/os/tests/trace-sites-gateway-contract.test.ts`
- 2026-06-13 12:59:33 fs.write: `packages/os/tests/trace-sites-gateway-contract.test.ts`
- 2026-06-13 13:00:21 fs.write: `.task/sites/trace-gateway-boundary-contracts/workpad.md`
- 2026-06-13 13:01:34 fs.write: `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- 2026-06-13 13:03:05 fs.write: `.task/sites/trace-gateway-boundary-contracts/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-13 12:59:39 `bun --cwd packages/os test tests/trace-sites-gateway-contract.test.ts`: failed exit 1 trace: `trc_5b33dc245ee0`
  - output: → tmux: opensaas-sites-trace-gateway-boundary-contracts-ad40b988 error: tmux session not found for task: opensaas-sites-trace-gateway-boundary-contracts-ad40b988 error: script "task:exec" exited with code 1
- 2026-06-13 12:59:45 `bun --cwd packages/os test tests/trace-sites-gateway-contract.test.ts`: failed exit 1 trace: `trc_229b39542a3b`
  - output: → tmux: opensaas-sites-trace-gateway-boundary-contracts-ad40b988 error: tmux session not found for task: opensaas-sites-trace-gateway-boundary-contracts-ad40b988 error: script "task:exec" exited with code 1
- 2026-06-13 12:59:55 `bun --cwd packages/os test tests/trace-sites-gateway-contract.test.ts`: failed exit 1 trace: `trc_33d81a234086`
  - output: [36m [2m❯[22m tests/trace-sites-gateway-contract.test.ts:[2m257:23[22m[39m [90m255| [39m [90m256| [39m it('applies live deltas after the snapshot cursor without double-cou… [90m257| [39m [35mconst[39m liveState [33m=[39m [34mapplyTraceSitesLiveDeltas[39m({ [90m | [39m [31m^[39m [90m258| [39m cursor[33m:[39m [32m'00000002'[39m[33m,[39m [90m259| [39m events[33m:[39m [ [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/9]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## Red Evidence

- Command: `cd packages/os && bun test tests/trace-sites-gateway-contract.test.ts` via `task.call`.
- Result: expected red failure, 20 tests run, 9 failed and 11 passed.
- Failure signal: missing/undefined `TRACE_SITES`, `TRACE_GATEWAY_BOUNDARY_RESPONSIBILITIES`, `DEFAULT_TRACE_READ_POLICY`, `TRACE_SITES_LIVE_UPDATE_CONTRACT`, `applyTraceSitesLiveDeltas`; discovery objects lacked gateway service-discovery metadata; ingest validation lacked required source metadata errors.
- Tooling note: recovered task metadata lacked its tmux session, so `task.call` initially failed; repaired by creating the exact recorded tmux session before rerunning validation.

- 2026-06-13 13:00:21 append: `.task/sites/trace-gateway-boundary-contracts/workpad.md`

- 2026-06-13 13:01:34 write: `packages/os/scripts/lib/trace-sites-gateway-contract.ts`

## workspace-owned: TDD green evidence

- 2026-06-13 13:01:39 `bun --cwd packages/os test tests/trace-sites-gateway-contract.test.ts`: passed exit 0 trace: `trc_d2d6a26d4ff3`
  - output: → tmux: opensaas-sites-trace-gateway-boundary-contracts-ad40b988 $ vitest run tests/trace-sites-gateway-contract.test.ts

## workspace-owned: TDD post evidence

- 2026-06-13 13:01:43 `bun --cwd packages/os run typecheck`: passed exit 0 trace: `trc_cacb816f67c9`
  - output: → tmux: opensaas-sites-trace-gateway-boundary-contracts-ad40b988
- 2026-06-13 13:01:51 `bash -lc cd packages/os && bun run typecheck`: passed exit 0 trace: `trc_073d2c678535`
  - output: → tmux: opensaas-sites-trace-gateway-boundary-contracts-ad40b988 $ node ./scripts/check-syntax.js

## workspace-owned: validation evidence

- 2026-06-13 13:02:35 `review.run`: passed — OK
- 2026-06-13 13:02:41 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/sites/trace-gateway-boundary-contracts/current.json`, `.task/sites/trace-gateway-boundary-contracts/evidence-log.json`, `.task/sites/trace-gateway-boundary-contracts/read-log.json`, `.task/sites/trace-gateway-boundary-contracts/session.json`, `.task/sites/trace-gateway-boundary-contracts/workpad.md`, `.task/tasks/sites/trace-gateway-boundary-contracts.json`, `packages/os/scripts/lib/trace-sites-gateway-contract.ts`, `packages/os/tests/trace-sites-gateway-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Green Evidence

- Focused command: `cd packages/os && bun test tests/trace-sites-gateway-contract.test.ts` via `task.call`.
- Result: green, 1 test file passed, 20 tests passed, 0 failed.
- Typecheck command: `cd packages/os && bun run typecheck` via `task.call`.
- Result: `workspace script syntax checks passed`.
- Review command: `review.run --base origin/stream/sites --noTests`.
- Result: passed static rules, eslint, typecheck, and spec compliance; 0 blocking issues.
- Verify command: `verify --base origin/stream/sites --noDb --noReview`.
- Result: publish-valid; review passed; DB guard passed; verify stamp written.

## Files Changed

- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
  - Added Trace/Trace Burn Site slugs.
  - Added gateway responsibility contract.
  - Added read-query guardrails and live update contract.
  - Added source metadata validation for ingest.
  - Added richer gateway discovery metadata and live delta reducer.
- `packages/os/tests/trace-sites-gateway-contract.test.ts`
  - Expanded PR1 contract coverage from 16 to 20 tests.
  - Added assertions for hosted Sites, gateway duties, live transport semantics, cursor/idempotency behavior, scoped read queries, and stricter ingest metadata.
- `.task/sites/trace-gateway-boundary-contracts/workpad.md`
  - Recorded acceptance criteria, test-first contract, red/green evidence, validation, and follow-up notes.

## Scope Review

- No UI code changed.
- No trace service implementation added.
- No broad script sync, productization rewrite, pricing/plans, or off-network installer behavior added.
- PR remains a contract/test boundary lock for follow-up implementation PRs.

- 2026-06-13 13:03:05 append: `.task/sites/trace-gateway-boundary-contracts/workpad.md`
