# add OS source envelopes

branch: `task/os/add-os-source-envelopes`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1069/add-os-source-envelopes
github pr: https://github.com/consuelohq/opensaas/pull/1069
started: 2026-06-15

## objective

Add a central OS source-envelope layer so `os.call` results and OS steering execution records can carry compact, citeable source metadata for ChatGPT and other clients.

## acceptance criteria

- [x] Implement source envelope generation in OS, not Workspace.
- [x] Keep existing raw `ToolResult` and `CallOutput` data shapes backward-compatible.
- [x] Add `sources?: SourceEnvelope[]` metadata to typed OS result envelopes.
- [x] Wrap facade `executeTool` at the central boundary instead of adding custom per-tool code.
- [x] Wrap OS `executeCall` at the public call boundary.
- [x] Record citeable source metadata for `get_steering` execution output without changing the returned steering string.
- [x] Prefer generic classifications for file/search/trace/review/verify/PR/commit/tool source types.
- [x] Regenerate OS docs/types that describe the new optional `sources` envelope.

## test-first contract

Behavior under test:

- `createSteeringSourceEnvelope()` builds a line-addressable steering source without mutating the steering body.
- `wrapToolResultWithSources()` decorates a raw facade result with `sources[]` while preserving the original `data` object reference.
- The facade executor adds sources centrally for tool calls.
- `executeGetSteering()` records source metadata in the execution output.
- `executeCall()` returns a `sources[]` envelope from the OS public call boundary.

Focused red evidence:

- `bun test packages/os/tests/source-envelope.test.ts` failed before implementation because `../scripts/lib/source-envelope` did not exist.
- Integration tests for get-steering/facade source metadata failed before the OS and facade wrappers were wired.

## implementation

- Added `packages/os/scripts/lib/source-envelope.ts` with source-envelope generation and wrappers.
- Added `SourceEnvelope` and optional `sources` fields to OS call/facade result types.
- Wrapped facade `executeTool()` return paths with `wrapToolResultWithSources()`.
- Wrapped `executeCall()` with `wrapCallOutputWithSources()`.
- Added `createSteeringSourceEnvelope()` to `finishSteeringExecution()` output records while preserving `executeGetSteering()` string return behavior.
- Updated generated type stubs and docs generator output to mention optional `sources`.

## files changed

- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/source-envelope.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/os.ts`
- `packages/os/src/generated/tool-client.ts`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/source-envelope.test.ts`
- `packages/os/TOOLS.md`

## validation evidence

- Red: `bun test packages/os/tests/source-envelope.test.ts` failed before implementation because the source-envelope module did not exist.
- `bun run --cwd packages/os generate-types` passed.
- `bun run --cwd packages/os generate-docs` passed.
- `checkFiles` passed for all changed source/test/generated files.
- `bun test packages/os/tests/source-envelope.test.ts packages/os/tests/os-get-steering-trace.test.ts` passed: 8 tests, 40 assertions.
- `bun test packages/os/tests/facade/facade.test.ts -t "adds source envelopes at the facade boundary|passes request ids through the envelope|validates input for fs.read"` passed: 3 tests.
- E2E smoke via OS CLI passed: `bun packages/os/scripts/os.ts call '{"name":"get_raw_steering"}'` returned a `sources[]` envelope.

## current status

Ready for review, verify, push, and PR refresh.

## notes for ko

This is a platform foundation. It gives OS responses structured, compact source metadata. Whether the ChatGPT Sources drawer renders those cards directly still depends on the connector/tool protocol honoring the `sources[]` metadata, but OS now emits the right normalized evidence from the central boundaries.

## issues and recovery

- Reverted accidental facade snapshot churn from a broad test run.
- Avoided bloating generated `TOOLS.md` examples by documenting `sources` in the result-envelope section instead of adding a source object to every tool example.

- 2026-06-15 08:21:52 write: `.task/os/add-os-source-envelopes/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/source-envelope.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/os.ts`
- `packages/os/src/generated/tool-client.ts`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/source-envelope.test.ts`
- `packages/os/TOOLS.md`

## workspace-owned: activity log

- 2026-06-15 08:21:52 fs.write: `.task/os/add-os-source-envelopes/workpad.md`
- 2026-06-15 08:23:49 fs.write: `.task/os/add-os-source-envelopes/workpad.md`

## workspace-owned: validation evidence

- Red: `bun test packages/os/tests/source-envelope.test.ts` failed before implementation because the source-envelope module did not exist.
- `bun run --cwd packages/os generate-types` passed.
- `bun run --cwd packages/os generate-docs` passed.
- `checkFiles` passed for all changed source/test/generated files.
- `bun test packages/os/tests/source-envelope.test.ts packages/os/tests/os-get-steering-trace.test.ts` passed: 8 tests, 40 assertions.
- `bun test packages/os/tests/facade/facade.test.ts -t "adds source envelopes at the facade boundary|passes request ids through the envelope|validates input for fs.read"` passed: 3 tests.
- E2E smoke via OS CLI passed: `bun packages/os/scripts/os.ts call '{"name":"get_raw_steering"}'` returned a `sources[]` envelope.
- 2026-06-15 08:23:21 `review.run`: passed — OK
- 2026-06-15 08:23:32 `verify`: passed — OK
- 2026-06-15 08:24:02 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/add-os-source-envelopes/current.json`, `.task/os/add-os-source-envelopes/evidence-log.json`, `.task/os/add-os-source-envelopes/read-log.json`, `.task/os/add-os-source-envelopes/session.json`, `.task/os/add-os-source-envelopes/verify.json`, `.task/os/add-os-source-envelopes/workpad.md`, `.task/tasks/os/add-os-source-envelopes.json`, `packages/os/TOOLS.md`, `packages/os/scripts/generate-docs.ts`, `packages/os/scripts/generate-types.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/types.ts`, `packages/os/scripts/lib/source-envelope.ts`, `packages/os/scripts/lib/types.ts`, `packages/os/scripts/os.ts`, `packages/os/src/generated/tool-client.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/os-get-steering-trace.test.ts`, `packages/os/tests/source-envelope.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final gate evidence

- `review.run --no-tests` passed: 12 OS files, 0 issues in this change, 1 pre-existing `ERROR_HANDLING` finding in `packages/os/scripts/os.ts`.
- `verify` passed and wrote publish-valid stamp at `.task/os/add-os-source-envelopes/verify.json`.

- 2026-06-15 08:23:49 append: `.task/os/add-os-source-envelopes/workpad.md`
