# finalize stream os main merge and canary acceptance

branch: `task/os/finalize-stream-os-main-merge-and-canary-acceptance`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2260
started: 2026-08-29

## acceptance criteria

- [x] Confirm `stream/os` is fully synchronized with current `main` and does not carry unresolved merge conflicts.
- [x] Re-run current stream review evidence and classify the remaining GitHub review comments against the current head; fix only reproducible, task-relevant defects.
- [x] Run focused validation plus strict review and full verify before promoting the stream.
- [ ] Merge stream review PR #2255 to `main` only after required checks/review state is acceptable.
- [ ] Release the merged OS to canary, update Ko's local installed runtime, and verify the installed runtime reports the released build.
- [ ] Re-run the live task/work-session acceptance path on the installed canary runtime: task session construction, work-session read/list/search/write/patch/trash context, Code Call Bash/Python/Bun routing, and top-level OS-call timeout separation for `session.start`.
- [ ] Do not promote the canary release to production in this task.

## plan

1. Inspect current `stream/os`, PR #2255 checks/reviews, and the source/test lines behind any actionable review comment.
2. Run strict review and focused current-head tests. If an actionable defect reproduces, freeze a focused test-first contract, run it red, then implement the smallest correction and rerun green.
3. Run full verify against `origin/stream/os`, push/promote any integration fix into the stream, and wait for deterministic stream checks/reviews needed for merge.
4. Merge PR #2255 to `main`, verify the merge SHA, then use the canonical OS release/lifecycle surface to publish to canary and update the local installation.
5. Execute the exact live task/work-session acceptance checks through the newly installed runtime and record trace evidence. Stop before production promotion.

## files changed

- none yet

## key decisions

- This integration task starts from `stream/os`; review/verify base is therefore `origin/stream/os` until promotion.
- Stream context at task start reports `ahead=0`, `behind=0`, so the previously planned main sync has already converged. Do not create another merge merely for ceremony.
- Current local runtime still has the pre-#2258 timeout-envelope defect: `session.start` failed when the outer `os.call.timeout` was supplied (`trc_b1191d257b80`) and succeeded immediately when that outer timeout was omitted (`trc_d5a0b82fc99e`). This is expected to be the key post-canary live acceptance assertion.

## Test-first contract

behavior under test: (1) every trace surface uses one session-identity precedence and sentinel-normalization contract, including the server history/dashboard projection, inspector model, and emitted browser client; (2) focused OS test-environment isolation suites actually load `packages/os/vitest.config.ts`, so inherited operator trace persistence is redirected during selector-driven execution.
existing local pattern: `branchName()` in the inspector already treats simultaneous task+work session IDs as an explicit combined identity before work path/branch fallback; existing selector rules near the OS Vitest runtime contracts pass an explicit `--config packages/os/vitest.config.ts` when launched from repository root.
new or changed tests: update the trace session-value regression so a row containing work path, branch, task session, and work session resolves consistently to the combined session identity; add server history/dashboard projection coverage for the same multi-field row; extend the selector contract to assert the isolation suite command carries the OS Vitest config. Replace the weak source-text-only compact-label assertion with observable model/render-helper coverage if the current harness exposes it without introducing a large DOM test abstraction.
focused red command: after destructive-literal preflight, run the existing focused selector test and trace session/interactions tests with explicit OS Vitest config.
expected red failure: selector command is missing `--config`; current site/backend session resolvers prefer work path or branch instead of the inspector's combined task+work identity; emitted client still embeds its own old precedence.
no-test waiver: revoked for these current-head defects. Integration-only merge/release steps remain covered by review/verify and live canary acceptance.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- Initial RED trace command used `--config packages/os/vitest.config.ts` from repository root. Vitest loaded the config but resolved `./tests/test-environment.ts` against the repository root, proving the selector fix must include the OS root as well as the config. Corrected RED execution uses `--root packages/os --config vitest.config.ts`.

## validation evidence

- Destructive-literal preflight for the focused selector/trace test files passed cleanly: `trc_ff5ef0d5fe4e`.
- Selector RED `trc_d464e8d3ab8f`: the `os-test-environment-isolation` suite command is exactly `bun x vitest run packages/os/tests/test-environment-contract.test.ts` and fails the new assertion because it carries no OS root/config.
- Trace RED `trc_2e50fb6484e7`: `resolveObservabilitySessionValue` returns the work path instead of the inspector's combined `taskSession + workSession` identity; the backend dashboard projection has no shared test helper yet. Both intended regressions are red before production edits.
- Trace selector ownership RED `trc_a0bfca2e873c`: the new canonical session-identity module was initially unmapped, which would have selected the broad OS package test. The explicit trace pagination rule now owns it.
- Focused GREEN `trc_c8f1f319479a`: selector isolation and trace session regressions passed after the implementation. Full selector suite `trc_ef26c559045d`: 55/55 passing.
- Emitted browser client syntax/shared-resolver proof `trc_ee8b78ab9dac`: generated tracing client compiles and embeds the canonical session resolver.
- Changed code syntax packet `trc_e23fd77197fc`: all changed TypeScript/JavaScript files passed syntax checks.
- Final selector inspection `trc_8e5501490c1e`: task changes are fully owned by focused rules; `@consuelo/os package test` is no longer selected.
- Safety preflight `trc_817446856250`: all test files selected by the focused rules were scanned for destructive/system-modifying literals and were clean before execution.
- Selected trace contracts: `trc_e439552941cf` passed 74 trace gateway/Trace Burn tests, 16 trace persistence/search tests, and 3 TraceStore boundary tests.
- Selected workspace shell contracts `trc_7edd97ad07ce`: 9 files / 83 tests passed. The JSON parse stack in stderr is an intentional corrupt-provenance fixture exercised by a passing fail-closed test.
- Session integration `trc_c0024eb39d6d`: 10 files / 82 tests passed.
- Server/workflow compatibility `trc_406569f990c9`: changed-server 22/22, workflow policy 12/12, TypeORM 2/2, and full test-selection 55/55 passed.
- Two large multi-suite wrapper calls returned connector 502s before their results could be consumed. They were split into bounded commands; every selected suite then completed successfully. This is transport fragility in the currently installed pre-canary runtime, not a test failure.
- Final strict review `trc_2e0ec486f1e9`: 0 task-owned issues, 0 pre-existing issues, 0 blockers. The single traces documentation opportunity is nonblocking and this repair does not change the public traces contract; it makes all existing Session surfaces obey the same identity rules.
- Canonical verify `trc_2b874b5ec305`: full mode, passed, publish-valid, with 0 DB risks/findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/trace-history-redaction.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/vitest.config.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- 2026-08-29 00:31:16 `review.run`: passed — OK
- 2026-08-29 00:32:41 apply-patch: `.task/os/finalize-stream-os-main-merge-and-canary-acceptance/workpad.md`
- 2026-08-29 00:33:14 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 00:33:14 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-29 00:33:14 apply-patch: `packages/os/tests/trace-history-redaction.test.ts`
- 2026-08-29 00:33:47 apply-patch: `.task/os/finalize-stream-os-main-merge-and-canary-acceptance/workpad.md`
- 2026-08-29 00:34:45 apply-patch: `packages/os/scripts/lib/trace-session-identity.ts`
- 2026-08-29 00:34:45 apply-patch: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-08-29 00:34:45 apply-patch: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-08-29 00:34:46 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-08-29 00:34:46 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-29 00:34:46 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 00:35:33 `checkFiles`: passed — OK
- 2026-08-29 00:35:49 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-29 00:36:34 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 00:36:45 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-29 00:40:46 apply-patch: `.task/os/finalize-stream-os-main-merge-and-canary-acceptance/workpad.md`
- 2026-08-29 00:41:11 `review.run`: passed — OK
- 2026-08-29 00:42:20 `verify`: passed — OK

- 2026-08-29 00:42:28 apply-patch: `.task/os/finalize-stream-os-main-merge-and-canary-acceptance/workpad.md`