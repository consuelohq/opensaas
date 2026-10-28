# fix real swamp workflow schema smoke

branch: `task/swamp-tools/fix-real-swamp-workflow-schema-smoke`
stream: `stream/swamp-tools`
pr: https://github.com/consuelohq/opensaas/pull/2533
started: 2026-09-22

## acceptance criteria

- [x] Match the current real Swamp workflow discovery shape.
- [x] Normalize workflow input maps into object JSON Schema with required/default semantics.
- [x] Prove search, pre-execution validation, model execution, and workflow execution against a checksum-verified real Swamp release.
- [x] Preserve existing model-method behavior and keep the fix scoped to workflow input normalization.

## plan

1. Reproduce the provider contract using the latest released Swamp binary in an isolated work session.
2. Convert the observed mismatch into a focused red fixture test.
3. Make the smallest workflow-schema normalization fix.
4. Run deterministic regression coverage plus a real-provider Consuelo E2E smoke.
5. Review, verify, and promote the fix back into `stream/swamp-tools`.

## files changed

- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`

## key decisions

- Treat Swamp workflow `inputs` as an input-name → schema-fragment map, matching the current released CLI.
- Inputs without a `default` are required, matching Swamp's documented runtime semantics.
- Preserve compatibility with an already-rooted `{ type: 'object', properties: ... }` schema if Swamp exposes one in another context/version.
- Keep real-provider testing isolated: checksum-verified binary, local disposable repo, redirected `SWAMP_HOME`, and telemetry disabled.

## notes for ko

- The real-provider smoke found and fixed a bug that the original fake fixture missed; this is exactly why the external-provider smoke is useful.
- No global Swamp install or personal Swamp configuration was required.

## improvements noticed

- A scheduled/manual compatibility smoke against a pinned/latest Swamp release would catch future upstream CLI contract drift before users do; it should remain separate from deterministic unit CI so external availability does not make ordinary CI flaky.

## errors i ran into

- The first isolated real Swamp model creation attempted to bootstrap its runtime under `~/.swamp/deno`; the work-session sandbox blocked it. Redirecting `SWAMP_HOME` and XDG config into the disposable session made the test hermetic.
- The isolated Consuelo-through-Swamp harness emitted a read-only trace-persistence warning because the work-session sandbox cannot write the normal OS trace DB; provider assertions and subprocess execution all passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(swamp-tools): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`

## Acceptance criteria

- Normalize real Swamp workflow input maps from `workflow get --json` into a root object JSON Schema.
- Preserve required-input semantics: Swamp workflow inputs without defaults are required.
- `tools.search` must show actual workflow input fields/signatures from a real-shape fixture.
- `executeTool` must reject missing/invalid workflow inputs before spawning Swamp.
- Re-run an isolated live smoke against the current released Swamp binary through Consuelo discovery + execution, not only direct Swamp CLI calls.

## Plan

1. Update the fake Swamp fixture to mirror the real release JSON observed today.
2. Capture the expected red failure for workflow input discovery/validation.
3. Add the smallest workflow input-map -> JSON Schema normalizer.
4. Rerun focused/regression tests.
5. Run Consuelo `tools.search`/`executeTool` against the isolated real Swamp binary and repo, then review/verify and publish to `stream/swamp-tools`.

## Test-first contract

behavior under test: real Swamp `workflow get --json` returns `inputs` as a map of input-name -> schema fragment, and Consuelo must turn that into `{type:'object', properties, required, additionalProperties:false}` before search/validation/execution.
existing local pattern: `runtime-tool-providers-swamp.test.ts` uses a deterministic fake Swamp executable to exercise the real subprocess/discovery/executor path.
new or changed tests: make workflow search/get fixture match the real release shape; assert workflow signature contains `environment`; assert missing workflow input is `VALIDATION_ERROR`; keep successful structured `--input-file` execution.
focused red command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts`.
expected red failure: workflow signature loses `environment` and missing workflow input is not rejected because the current code treats the input map itself as a root JSON Schema.
no-test waiver: not applicable.

## Live-provider evidence before edit

- Downloaded the latest `swamp-club/swamp` macOS arm64 release into an isolated Consuelo work session and verified it with the published SHA-256 checksums.
- Release tested: `swamp 20260922.011324.0-sha.2e949db5`.
- Redirected `SWAMP_HOME` and XDG config into the disposable session; the first attempt usefully proved Swamp otherwise writes a global runtime cache under `~/.swamp/deno`.
- Real `model search --json` matches our model-method assumption exactly.
- Real `workflow search --json` returns `{query, results}` and real `workflow get --json` returns workflow inputs as `{ message: { type: 'string', ... } }`, not as a root JSON Schema.
- The exact execution argv used by our adapter succeeded directly against real Swamp for both `model method run ... --input-file ...` and `workflow run ... --input-file ...`.

- 2026-09-22 02:15:28 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`

## workspace-owned: activity log

- 2026-09-22 02:15:28 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:16:05 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 02:16:48 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:20:04 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:21:08 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:25:00 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:29:39 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:33:10 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:38:11 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
- 2026-09-22 02:39:48 fs.write: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## Focused red evidence

- Command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts`.
- Result: 2 failed / 2 passed as expected.
- Search failure: real-shape workflow input map rendered as `{  }` instead of containing `environment`.
- Validation failure: an empty workflow input returned `OK` instead of `VALIDATION_ERROR`.
- Trace: `trc_6c6a4cf48b5f`.

- 2026-09-22 02:16:48 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

- 2026-09-22 02:18:08 apply-patch: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
## Green and live-provider evidence

- Focused fixture suite after normalization fix: 4/4 passed; trace `trc_e810d56de03c`.
- Real provider E2E used the checksum-verified current Swamp release `20260922.011324.0-sha.2e949db5` in isolated work session `wrk_c96d31d838fa40f4`.
- Consuelo `runToolSearch` discovered `swamp.model.echoer.execute` with `{ run: string; ... }` and `swamp.workflow.smoke-flow.run` with `{ message: string }` from the real Swamp repo.
- Consuelo `executeTool` rejected an empty real workflow payload with `VALIDATION_ERROR` before spawning Swamp.
- Consuelo `executeTool` successfully ran the real `echoer.execute` model method through Swamp (`status: succeeded`).
- Consuelo `executeTool` successfully ran the real `smoke-flow` workflow through Swamp (`status: succeeded`); job `main` and step `echo` both succeeded.
- Live smoke trace: `trc_ae59fe2313b1`.
- The isolated work-session harness emitted one non-outcome warning because imported OS trace persistence could not write its normal SQLite DB from the read-contained work-session sandbox (`TRACE_PERSISTENCE_FAILED: readonly database`). Provider discovery/execution itself exited 0 and all assertions passed; normal installed-OS tracing is covered separately by existing OS tests.

- 2026-09-22 02:20:04 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 02:20:28 `checkFiles`: passed — OK
- 2026-09-22 02:22:32 `review.run`: passed — OK
- 2026-09-22 02:23:55 `verify`: failed — COMMAND_FAILED
- 2026-09-22 02:25:23 `verify`: failed — COMMAND_FAILED
- 2026-09-22 02:30:39 `verify`: failed — COMMAND_FAILED
- 2026-09-22 02:34:40 `checkFiles`: passed — OK
- 2026-09-22 02:36:19 `review.run`: passed — OK
- 2026-09-22 02:37:28 `verify`: passed — OK
- 2026-09-22 02:38:26 `verify`: failed — COMMAND_FAILED

## Regression evidence

- `checkFiles` passed for the provider implementation and provider test; trace `trc_36c9fc0a4c19`.
- Focused regression set passed 4 files / 735 tests: Swamp provider, tools search v3, tool-scope authorization, and full facade suite; trace `trc_6f67b436032d`.

- 2026-09-22 02:21:08 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

- 2026-09-22 02:22:13 apply-patch: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## Verify wait recovery

Wait reason: canonical `verify` is still completing after the MCP/Code Mode caller stopped waiting.
Duration: 20s bounded wait.
Resume action: inspect the newest `verify` trace for task session `tsk_191c9598828e` and read its raw result.
Expected signal: completed verify with `passed: true` and `publishValid: true`.
Fallback: if no completed trace exists, poll once more; if failed, inspect the exact failing phase before retrying anything.

- 2026-09-22 02:25:00 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## Verify failure isolation

- Canonical verify review and DB guard both passed, but automatic test selection failed because it selects the package-wide `@consuelo/os` test for these provider files.
- Direct package run reproduced one load-sensitive failure: `tool-scope-authorization.test.ts` exceeded its 5s per-test timeout while the rest of the OS suite was running in parallel. The same authorization test had already passed in the focused regression set.
- Per failure policy, reran the exact package suite once without code changes; it passed cleanly in 54.3s, trace `trc_55eea4674da5`.
- Treating the first package-wide timeout as a load-sensitive flake unless the canonical verify repeat demonstrates otherwise; no timeout inflation or unrelated test change was made.

- 2026-09-22 02:29:39 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## Verification performance follow-up contract

behavior under test: bundled tool scope resolution must not rebuild/read the full effective manifest and runtime-provider registry once per built-in tool; dynamic provider tools must still resolve through the effective registry, and disabled bundled tools must remain fail-closed.
existing local pattern: `resolveToolScope` currently calls `activeToolManifestForScope()` for every lookup; `tool-scope-authorization.test.ts` iterates the entire generated manifest and is the exact test timing out under package-wide load.
red evidence: canonical verify/package suite timed out the existing `authorizes every known OS tool...` test at its 5s limit; direct focused regression passed it in ~2.2s, exposing avoidable per-lookup manifest work.
new or changed tests: add an overlay guard proving a disabled bundled tool is still rejected after introducing the bundled fast path; existing all-tools and runtime-provider authorization tests cover bundled and dynamic success paths.
focused command after edit: `bun --cwd packages/os vitest run tests/tool-scope-authorization.test.ts tests/runtime-tool-providers-swamp.test.ts tests/manifest-overlay.test.ts`.
expected result: authorization suite stays semantically green and completes materially below its package-load timeout; dynamic Swamp tool authorization stays green.

- 2026-09-22 02:33:10 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

- 2026-09-22 02:33:33 apply-patch: `packages/os/tests/tool-scope-authorization.test.ts`
- 2026-09-22 02:34:13 apply-patch: `packages/os/scripts/lib/security-gateway.ts`

- 2026-09-22 02:35:57 apply-patch: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## Final verify wait cycle

Wait reason: final canonical `verify` exceeded the MCP caller wait window after the scope-resolution performance fix.
Duration: 20s bounded wait.
Resume action: inspect the newest `verify` trace for `tsk_191c9598828e` immediately after wake.
Expected signal: `passed: true`, `publishValid: true`, stamp written.
Fallback: if the completed trace failed, inspect the test-selection failure before any further mutation.

- 2026-09-22 02:38:11 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`

## Final verification

- Final canonical verify trace: `trc_bf5fee8736da`.
- Result: `passed: true`, `publishValid: true`, mode `full`; review passed, DB guard passed, and verification stamp was written.
- Package-wide `@consuelo/os` suite passed after the bundled-tool scope fast path; trace `trc_4a89c01489c6`.
- Authorization focused runtime improved from ~2.2s before the fast path to 36ms while preserving disabled-tool and dynamic-provider fail-closed semantics.
- Strict review after all code changes: 0 blocking issues; trace `trc_5f35e132f7e5`.

- 2026-09-22 02:39:48 append: `.task/swamp-tools/fix-real-swamp-workflow-schema-smoke/workpad.md`
