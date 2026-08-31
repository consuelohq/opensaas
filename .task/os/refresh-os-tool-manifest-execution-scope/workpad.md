# refresh OS tool manifest execution scope

branch: `task/os/refresh-os-tool-manifest-execution-scope`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2231/refresh-os-tool-manifest-execution-scope
github pr: https://github.com/consuelohq/opensaas/pull/2231
started: 2026-08-26

## acceptance criteria

- [x] Reproduce the deterministic `tool-manifest.test.ts` failure where the generated Google tool command includes `executionScope: "runtime"` but the checked-in generated/baseline surface does not.
- [x] Refresh only the canonical characterization baseline required by the existing Google runtime execution-scope contract; do not remove or weaken the runtime scope.
- [x] Focused OS tool-manifest contracts pass with no unrelated source behavior changes.
- [x] Strict review is clean and full verify is publish-valid before merging back into `stream/os`.

## plan

1. Inspect the tool-manifest test, generator, Google manifest definition, and checked-in generated baseline.
2. Run the exact focused manifest test first and capture the RED mismatch.
3. Run the repository's canonical generator rather than hand-editing generated JSON/types.
4. Re-run focused contracts, strict review, and full verify, then publish to `stream/os`.

## current status

- The deterministic contract failure is fixed and validated. The actual generated manifests were already current (`generate-tool-manifest:check` passed); the stale surface was the characterization fixture `tests/fixtures/tool-package-baseline.json`. It now records the intentional Google `executionScope: "runtime"` contract.

## files changed

- `packages/os/tests/fixtures/tool-package-baseline.json` — adds the already-shipped Google runtime execution scope to the exact characterized manifest baseline.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 19:08:30 `review.run`: passed — OK
- 2026-08-26 19:08:31 `review.run`: passed — OK
- 2026-08-26 19:10:45 `verify`: passed — OK
- 2026-08-26 19:11:00 `verify`: passed — OK

## key decisions

- Preserve `executionScope: "runtime"`. The failure is generated/baseline drift, not evidence that the new execution scope should be removed.
- `generate-tool-manifest:check` proved the generated manifests themselves were already current, so the correct repair is the one-line characterization-fixture update rather than rewriting generated JSON.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- This is a deterministic CI failure discovered after the release-tool race fixes were complete; it is not another automated-review suggestion.
- The first `review.run` and first `verify` attempts hit a transient OS facade `UNKNOWN/ExceptionGroup`; one retry of each succeeded without changing source.

## validation evidence

- RED: `tool-manifest.test.ts` reproduced exactly one mismatch: missing Google `executionScope: "runtime"` in the baseline (`trc_524c1fcde03c`).
- Generator drift check: generated full/core/workflow manifests were already current (`trc_9c27f502e25c`).
- GREEN: 23/23 tool-manifest/tool-package/Google-skill tests passed with 349 assertions (`trc_38e50c6dd01c`).
- Strict review: 0 issues / 0 blockers on this change (`trc_86961bd11972`).
- Full verify: passed, publish-valid, DB gate clean (`trc_d8f97854acda`).

## Test-first contract

behavior under test: the checked-in OS tool manifest baseline must exactly match `buildToolManifest({ write: false })`, including the Google runtime execution scope.
existing local pattern: `packages/os/tests/tool-manifest.test.ts` compares generated definitions against the checked-in baseline and the OS manifest generator owns derived surfaces.
new or changed tests: no new test needed; the existing exact generated-surface equality test is the regression and is currently failing.
focused red command: `bun test packages/os/tests/tool-manifest.test.ts`
expected red failure: generated Google command contains `executionScope: "runtime"` while the checked-in baseline does not.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-26 19:05:16 apply-patch: `.task/os/refresh-os-tool-manifest-execution-scope/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/google/handler.ts`
- `packages/os/tools/google/manifest.ts`

- 2026-08-26 19:05:58 apply-patch: `packages/os/tests/fixtures/tool-package-baseline.json`

- 2026-08-26 19:11:17 apply-patch: `.task/os/refresh-os-tool-manifest-execution-scope/workpad.md`