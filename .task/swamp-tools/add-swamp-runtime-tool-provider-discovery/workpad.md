# add swamp runtime tool provider discovery

branch: `task/swamp-tools/add-swamp-runtime-tool-provider-discovery`
stream: `stream/swamp-tools`
pr: https://github.com/consuelohq/opensaas/pull/2531
started: 2026-09-22

## acceptance criteria

- [x] Detect Swamp only when the current workspace is Swamp-configured; absent Swamp remains inert.
- [x] Discover Swamp model methods and workflows as stable `swamp.*` OS tools with JSON-Schema-backed inputs.
- [x] Feed the same effective runtime registry into `tools.search`, execution lookup, and scope authorization.
- [x] Keep unknown runtime tools fail-closed and default discovered Swamp tools to write-capable.
- [x] Cache discovery outside the bundled generated manifest and refresh automatically on cache expiry.
- [x] Prove discovery, cache reuse, validation, execution, and authorization with deterministic tests.

## plan

1. Map the manifest/search/executor/security boundaries and confirm Swamp's machine-readable CLI contracts.
2. Write a failing end-to-end provider test with a fake Swamp executable.
3. Add the runtime registry + Swamp provider, then route search/execution/auth through the effective registry.
4. Run focused and existing facade/search/security regressions.
5. Run review/verify and publish the task into `stream/swamp-tools`.

## files changed

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/runtime-tool-registry.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`

## key decisions

- Runtime provider tools are projected as ordinary `facade-tool` manifest entries rather than a second tool system.
- The bundled generated manifest remains immutable; runtime entries are merged into the effective full manifest only.
- Discovery requires a `.swamp.yaml` workspace and uses exact argv subprocess calls; no shell interpolation.
- Swamp input schemas are validated with Zod's native `fromJSONSchema`; execution uses `--input-file` to preserve structured values.
- Provider tools default to `mutating: true`, `readOnly: false`, and `safeToRetry: false` until provider metadata proves otherwise.
- Discovery cache is keyed by Swamp executable + repo and stored under the OS home with a 15-minute TTL.

## notes for ko

- This is federation, not native migration: Swamp remains the execution engine while Consuelo makes its tools searchable/callable through normal OS surfaces.
- Dynamic tools intentionally do not enter the small steering/core manifest; agents discover them through `tools.search` and invoke them through `os.call`.

## improvements noticed

- Explore's semantic index still contains deleted Twenty-era tool-registry code; it should be reindexed separately so future tool-runtime research does not start from stale hypotheses.
- A dedicated explicit runtime-provider refresh tool can be added later if we want manual invalidation in addition to TTL refresh.

## errors i ran into

- The first focused-test invocation passed shell syntax as Bun source; reran via `Bun.spawnSync` and recorded only the meaningful red result.
- One initial `fs.write` transport failed on nested template literals before writing anything; rewrote the target strings without nested backticks and continued.

---

## publish checklist

```bash
bun run task:push -- --message "type(swamp-tools): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `package.json`
- `packages/consuelo-core/src/registry/types.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/workspace-project-cwd.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/streams/swamp-tools/AGENTS.md`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`
- `packages/os/tests/tools-search-v3.test.ts`
- `packages/os/tools/package.ts`
- `packages/os/tools/tool-discovery/handler.ts`
- `packages/os/tools/tool-discovery/schema.ts`
- `packages/workspace/streams/swamp-tools/AGENTS.md`

## Task definition

Acceptance criteria:
- Swamp can be detected as an optional local runtime provider without making OS install/startup depend on Swamp.
- Discovered Swamp model methods and workflows are normalized into OS-searchable tool entries with stable names, descriptions, provenance, and JSON-schema-backed inputs.
- The same effective runtime registry is used by `tools.search`, `os.call` execution, and tool-scope authorization so discovered tools cannot be searchable-but-uncallable.
- Unknown/untrusted runtime tools remain fail-closed; Swamp provider entries default to write-capable unless explicitly proven read-only.
- Discovery is cached locally and refreshable without mutating the bundled generated manifest.
- Focused tests prove provider discovery, search visibility, execution routing, cache behavior, and authorization.

Plan:
1. Map the current manifest/search/executor/security boundaries and nearby provider patterns.
2. Write focused failing tests for a fixture Swamp CLI and runtime registry.
3. Add the smallest shared runtime-registry/provider abstraction and Swamp adapter.
4. Route search, execution, and authorization through the shared effective registry.
5. Run focused tests, broader OS tests/review/verify, then publish into `stream/swamp-tools`.

## Test-first contract

behavior under test: optional Swamp CLI discovery produces callable/searchable/authorized runtime tools from machine-readable schemas, while absent/invalid Swamp stays inert and unknown tools stay fail-closed.
existing local pattern: generated canonical tool manifest + manifest overlay + facade executor + central security-gateway scope classification; exact files to follow pending research.
new or changed tests: runtime tool registry/provider tests plus focused facade/search/security integration coverage using a deterministic fake Swamp executable.
focused red command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts`.
expected red failure: discovered tool is absent from search, authorization returns `UNKNOWN_TOOL_SCOPE`, and execution returns `NOT_FOUND`.
no-test waiver: not applicable.

- 2026-09-22 01:41:50 append: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/runtime-tool-registry.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`

## workspace-owned: activity log

- 2026-09-22 01:41:50 fs.write: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`
- 2026-09-22 01:45:40 fs.write: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`
- 2026-09-22 01:46:10 fs.write: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 01:47:33 fs.write: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`
- 2026-09-22 01:49:25 fs.write: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- 2026-09-22 01:49:53 fs.write: `packages/os/scripts/lib/runtime-tool-registry.ts`
- 2026-09-22 02:00:56 fs.write: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`
- 2026-09-22 02:01:39 fs.write: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`

## Research decision

- Explore's semantic index surfaced deleted Twenty code and an unrelated consuelo-core registry; both were verified as irrelevant. Current source evidence is the OS generated/effective manifest, `tools-search.ts`, facade executor/types/schemas, and `security-gateway.ts`.
- Swamp's current CLI contract provides full JSON Schema in `swamp model search --json`; workflow search provides identity/description and `workflow get --json` exposes the full workflow including its `inputs` schema. Model/workflow execution supports `--input-file`, which preserves structured values without shell interpolation.
- Zod 4.3.6 in `@consuelo/os` exposes `z.fromJSONSchema`, so no new JSON Schema dependency is needed.

Focused red command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts`
Expected red failure: imports for the runtime registry/Swamp provider do not exist and effective search/execution/scope resolution cannot recognize `swamp.*` tools.

- 2026-09-22 01:45:40 append: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`

- 2026-09-22 01:46:10 write: `packages/os/tests/runtime-tool-providers-swamp.test.ts`

- 2026-09-22 01:47:15 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
## Focused red evidence

- Command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts` (invoked through Bun.spawnSync in code.call).
- Result: 3 failed / 1 passed as expected.
- Failure signal: search had no `swamp.model.cache-warmer.run`; `resolveToolScope` returned `UNKNOWN_TOOL_SCOPE`; `executeTool` returned `NOT_FOUND` instead of schema validation. The absent-Swamp test already passed.
- A prior runner attempt incorrectly supplied shell syntax as Bun source; it was a tooling-shape error and is not counted as TDD evidence.

- 2026-09-22 01:47:33 append: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`

- 2026-09-22 01:48:35 apply-patch: `packages/os/scripts/lib/facade/types.ts`
- 2026-09-22 01:49:25 write: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`

- 2026-09-22 01:49:53 write: `packages/os/scripts/lib/runtime-tool-registry.ts`

- 2026-09-22 01:50:04 apply-patch: `packages/os/scripts/lib/manifest.ts`
- 2026-09-22 01:50:15 apply-patch: `packages/os/scripts/lib/runtime-tool-registry.ts`
- 2026-09-22 01:50:26 apply-patch: `packages/os/scripts/tools-search.ts`

- 2026-09-22 01:50:50 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-09-22 01:50:57 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-09-22 01:51:14 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-09-22 01:51:21 apply-patch: `packages/os/scripts/lib/security-gateway.ts`

## workspace-owned: validation evidence

- 2026-09-22 01:52:00 `checkFiles`: passed — OK
- 2026-09-22 01:52:40 apply-patch: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`
- 2026-09-22 01:52:59 `review.run`: passed — OK
- 2026-09-22 01:53:19 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 01:53:35 `review.run`: passed — OK
- 2026-09-22 01:55:26 `verify`: failed — COMMAND_FAILED
- 2026-09-22 01:56:33 `verify`: failed — COMMAND_FAILED
- 2026-09-22 01:59:03 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-09-22 02:00:59 `verify`: passed — OK
- 2026-09-22 02:02:05 `verify`: passed — OK

## Verify wait recovery

Wait reason: the canonical `verify` subprocess is still completing after the MCP/Code Mode caller stopped waiting.
Duration: 20s bounded wait.
Resume action: query recent `verify` traces for taskSession `tsk_0dc700aadc04`, then inspect the newest trace raw if present.
Expected signal: a completed verify trace with `passed: true` and `publishValid: true`.
Fallback: if no completed trace exists, poll once more; if it completed failed, inspect the exact failing phase before any retry.

- 2026-09-22 02:00:56 append: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`

## Final validation and verify recovery

- Focused Swamp provider suite: 4/4 passed.
- Existing regression selection: 5 files / 737 tests passed (`facade`, `tools-search-v3`, `tool-scope-authorization`, `manifest-overlay`, Swamp provider).
- `checkFiles`: all changed TypeScript/test files passed syntax checks.
- Strict `review.run`: 0 blocking issues after replacing `console.*` in the embedded fake CLI fixture.
- First full `verify` failure was traced to `tests/audit/script-parity-audit.test.ts`: the two new OS-only runtime-provider scripts were missing from the script-parity classification fixture. Added explicit `os-only-intentional` classifications; focused parity audit then passed 1/1.
- Verify wait recovery started after the caller stopped waiting. Waited 20s using the typed `wait` tool, then immediately inspected the newest verify trace.
- Final canonical verify trace: `trc_e9a587be808b`; duration 102436ms; `passed: true`, `publishValid: true`, review passed, DB guard passed, verification stamp written at `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/verify.json`.
- The completed automatic test-selection run also showed all critical targeted suites passed; the earlier package-wide failure was exactly the now-fixed script-parity classification drift.

- 2026-09-22 02:01:39 append: `.task/swamp-tools/add-swamp-runtime-tool-provider-discovery/workpad.md`
