# make trace sites observability tests green

branch: `task/os/make-trace-sites-observability-tests-green`
stream: `stream/os`
source: `main`
taskSession: `tsk_bef3bcd7e8d5`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1101/make-trace-sites-observability-tests-green

## acceptance criteria

- Import the Trace Sites OS observability TDD contracts from PR #1093 if absent on main.
- Implement the OS-owned trace store, live stream, browser client, reporting, and smoke helper modules expected by those tests.
- Preserve gateway boundary ownership and browser-safe response shapes.
- Run focused TDD tests, OS guardrails, and typecheck.

## Test-first contract

Behavior under test:

- Observations normalize into canonical Trace Sites rows.
- Gateway SSE supports snapshots, deltas, keepalive, state transitions, cursor resume, dedupe, bridge-required state, and bounded backpressure.
- Browser client only uses gateway routes, merges live and recent data, dedupes, reports product states, and polls when EventSource is unavailable.
- Reporting returns deterministic gateway-safe JSON with redacted structured errors.
- Live smoke validates product-path trace visibility through gateway reads.

Focused red command:

- Run the five imported Trace Sites observability TDD tests before implementation.

Expected red failure:

- Missing exports or failing contracts for the new observability modules on main.

## evidence

- root status before task start: main even with origin/main; reload scripts clean; only root task evidence/explore metadata modified.
- stream context trace: trc_6aa40fb42ddf
- task start trace: trc_f22bccb8e4d9

## validation evidence

- pending

- 2026-06-17 03:25:33 write: `.task/os/make-trace-sites-observability-tests-green/workpad.md`

## files changed

- `packages/os/scripts/lib/trace-sites-browser-client.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- `packages/os/scripts/lib/trace-sites-reporting.ts`
- `packages/os/scripts/lib/trace-store.ts`
- `packages/os/tests/trace-sites-browser-client.test.ts`
- `packages/os/tests/trace-sites-gateway-live-stream.test.ts`
- `packages/os/tests/trace-sites-live-smoke-script.test.ts`
- `packages/os/tests/trace-sites-reporting.test.ts`
- `packages/os/tests/trace-sites-runtime-boundary.test.ts`
- `packages/os/tooling/script-parity-classifications.json`
- `packages/os/vitest.config.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/trace-sites-browser-client.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- `packages/os/scripts/lib/trace-sites-reporting.ts`
- `packages/os/scripts/lib/trace-store.ts`
- `packages/os/tests/trace-sites-browser-client.test.ts`
- `packages/os/tests/trace-sites-gateway-live-stream.test.ts`
- `packages/os/tests/trace-sites-live-smoke-script.test.ts`
- `packages/os/tests/trace-sites-reporting.test.ts`
- `packages/os/tests/trace-sites-runtime-boundary.test.ts`
- `packages/os/tooling/script-parity-classifications.json`
- `packages/os/vitest.config.ts`

## workspace-owned: activity log

- 2026-06-17 03:25:33 fs.write: `.task/os/make-trace-sites-observability-tests-green/workpad.md`
- 2026-06-17 03:45:58 write: `packages/os/tests/trace-sites-browser-client.test.ts`
- 2026-06-17 03:45:58 fs.write: `packages/os/tests/trace-sites-browser-client.test.ts`
- 2026-06-17 03:46:26 write: `packages/os/tests/trace-sites-gateway-live-stream.test.ts`
- 2026-06-17 03:46:26 fs.write: `packages/os/tests/trace-sites-gateway-live-stream.test.ts`
- 2026-06-17 03:46:55 write: `packages/os/tests/trace-sites-live-smoke-script.test.ts`
- 2026-06-17 03:46:55 fs.write: `packages/os/tests/trace-sites-live-smoke-script.test.ts`
- 2026-06-17 03:47:10 write: `packages/os/tests/trace-sites-reporting.test.ts`
- 2026-06-17 03:47:10 fs.write: `packages/os/tests/trace-sites-reporting.test.ts`
- 2026-06-17 03:47:16 write: `packages/os/tests/trace-sites-runtime-boundary.test.ts`
- 2026-06-17 03:47:16 fs.write: `packages/os/tests/trace-sites-runtime-boundary.test.ts`
- 2026-06-17 03:48:39 write: `packages/os/vitest.config.ts`
- 2026-06-17 03:48:39 fs.write: `packages/os/vitest.config.ts`
- 2026-06-17 03:51:23 write: `packages/os/scripts/lib/trace-store.ts`
- 2026-06-17 03:51:23 fs.write: `packages/os/scripts/lib/trace-store.ts`
- 2026-06-17 03:51:59 write: `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- 2026-06-17 03:51:59 fs.write: `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- 2026-06-17 03:52:36 write: `packages/os/scripts/lib/trace-sites-browser-client.ts`
- 2026-06-17 03:52:36 fs.write: `packages/os/scripts/lib/trace-sites-browser-client.ts`
- 2026-06-17 03:53:45 write: `packages/os/scripts/lib/trace-sites-reporting.ts`
- 2026-06-17 03:53:45 fs.write: `packages/os/scripts/lib/trace-sites-reporting.ts`
- 2026-06-17 03:53:54 write: `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- 2026-06-17 03:53:54 fs.write: `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- 2026-06-17 03:55:37 fs.write: `packages/os/tooling/script-parity-classifications.json`
- 2026-06-17 03:57:06 fs.write: `.task/os/make-trace-sites-observability-tests-green/workpad.md`
- 2026-06-17 03:58:57 fs.write: `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- 2026-06-17 03:59:09 fs.write: `packages/os/scripts/lib/trace-sites-reporting.ts`
- 2026-06-17 03:59:56 fs.write: `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- 2026-06-17 04:02:39 fs.write: `.task/os/make-trace-sites-observability-tests-green/workpad.md`

## workspace-owned: files read

- `packages/os/tests/audit/script-parity-audit.test.ts`

- 2026-06-17 03:55:37 write: `packages/os/tooling/script-parity-classifications.json`

## implementation

- Imported the five TDD contract files from PR #1093 and intentionally skipped #1093 task metadata.
- Added `packages/os/vitest.config.ts` to alias `bun:test` to `vitest` so the exact imported contract files run under the existing `bun --cwd packages/os test ...` package command.
- Added OS-owned modules:
  - `packages/os/scripts/lib/trace-store.ts`
  - `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
  - `packages/os/scripts/lib/trace-sites-browser-client.ts`
  - `packages/os/scripts/lib/trace-sites-reporting.ts`
  - `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- Updated `packages/os/tooling/script-parity-classifications.json` for the five new OS-only library files.

## red evidence

- Initial red after importing tests failed because Vitest could not resolve `bun:test`; trace `trc_1aca7c6ccd0c`.
- Added Vitest alias without changing imported #1093 test files.
- Contract red after harness alias failed for missing modules: `trace-store`, `trace-sites-gateway-live-stream`, `trace-sites-browser-client`, `trace-sites-reporting`, and `trace-sites-live-smoke`; trace `trc_b7062d973a19`.

## green evidence

- Focused TDD contracts passed: `bun --cwd packages/os test` for all five Trace Sites observability files, 19 tests total; trace `trc_9bb7ca56febc`.
- Guardrails passed except script parity on first run; script parity failed only because the five new OS library files needed classification; trace `trc_7543ee336332`.
- Script parity passed after adding classifications; typecheck passed; trace `trc_24e98f8332d6`.
- Earlier guardrail run passed `facade.test.ts`, `tool-manifest.test.ts`, `trace-sites-gateway-contract.test.ts`, `trace-sites-gateway-read-layer.test.ts`, `workspace-edge-sites-gateway-integration.test.ts`, and typecheck; trace `trc_7543ee336332`.

## notes

- `github pr.diff` typed operation currently shells out with unsupported `--stat`; used typed `github` raw fallback for PR diff evidence. Trace `trc_52939fb8cf97` shows the bug; trace `trc_9e588232e912` is the raw fallback.
- `code.call` edit mode is still gated in this live OS runtime; repo writes used typed `fs.write` with temp-file transport.

- 2026-06-17 03:57:06 append: `.task/os/make-trace-sites-observability-tests-green/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-06-17 03:25:33 write: `.task/os/make-trace-sites-observability-tests-green/workpad.md`
- 2026-06-17 03:57:46 `review.run`: passed — OK
- 2026-06-17 03:58:57 write: `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- 2026-06-17 03:59:09 write: `packages/os/scripts/lib/trace-sites-reporting.ts`
- 2026-06-17 03:59:56 write: `packages/os/scripts/lib/trace-sites-live-smoke.ts`
- 2026-06-17 04:00:40 `review.run`: passed — OK
- 2026-06-17 04:02:09 `verify`: passed — OK
- 2026-06-17 04:03:04 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/make-trace-sites-observability-tests-green/current.json`, `.task/os/make-trace-sites-observability-tests-green/evidence-log.json`, `.task/os/make-trace-sites-observability-tests-green/read-log.json`, `.task/os/make-trace-sites-observability-tests-green/session.json`, `.task/os/make-trace-sites-observability-tests-green/verify.json`, `.task/os/make-trace-sites-observability-tests-green/workpad.md`, `.task/tasks/os/make-trace-sites-observability-tests-green.json`, `packages/os/scripts/lib/trace-sites-browser-client.ts`, `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`, `packages/os/scripts/lib/trace-sites-live-smoke.ts`, `packages/os/scripts/lib/trace-sites-reporting.ts`, `packages/os/scripts/lib/trace-store.ts`, `packages/os/tests/trace-sites-browser-client.test.ts`, `packages/os/tests/trace-sites-gateway-live-stream.test.ts`, `packages/os/tests/trace-sites-live-smoke-script.test.ts`, `packages/os/tests/trace-sites-reporting.test.ts`, `packages/os/tests/trace-sites-runtime-boundary.test.ts`, `packages/os/tooling/script-parity-classifications.json`, `packages/os/vitest.config.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation evidence

- Fixed review error-handling findings in live stream, reporting, and smoke helpers.
- Focused TDD contracts plus OS typecheck passed after review fixes; trace `trc_69a49dc0bdc5`.
- Complete handoff validation list passed, including five TDD tests, facade, tool manifest, script parity, Trace Sites gateway contract, read layer, workspace-edge integration with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`, and typecheck; trace `trc_12d406de8dcf`.
- Review against `origin/main` passed with zero own issues and zero blocking issues; trace `trc_75352ad69be8`.
- Verify against `origin/main` passed and wrote publish-valid stamp; trace `trc_e0acb0084c7e`.

## deferred

- Full live product path beyond the contract smoke helper remains deferred: this task adds the OS-owned contracts and deterministic helper modules, but does not wire the hosted Trace Site UI to a real deployed gateway session.

- 2026-06-17 04:02:39 append: `.task/os/make-trace-sites-observability-tests-green/workpad.md`
