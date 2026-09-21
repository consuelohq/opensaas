# polish traces page and add runtime insight

branch: `task/os/polish-traces-page-and-add-runtime-insight`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2447/polish-traces-page-and-add-runtime-insight
github pr: https://github.com/consuelohq/opensaas/pull/2447
started: 2026-09-11

## acceptance criteria

- [x] Replace vague trace Input/Output fallbacks with concise semantic labels for at least 20 common/representative tool variants.
- [x] Prefer concrete filenames, command programs, URLs/selectors, operations, and other safe structured subjects when available.
- [x] Suppress generic success strings such as `command completed` when a tool-aware result is available, while preserving redaction behavior.
- [x] Rebuild the OS-owned v38 browser runtime and keep the tracing/runtime-boundary regression suite green.
- [ ] Merge the task to `stream/os`, merge the stream to main, publish/update Canary locally, and verify the shipped Tracing DOM.

## plan

1. Establish formatter test coverage for the vague rows shown in production and a broad common-tool matrix.
2. Improve the canonical OS-owned formatter with semantic input/output fallbacks instead of tool-specific screenshot hacks.
3. Rebuild the browser artifact and run focused plus trace-site regression tests.
4. Review/verify/push the task, promote `stream/os` to main, release Canary/update local OS, then inspect the deployed Tracing DOM.

## current status

- Formatter implementation and browser artifact are complete locally; focused and related tests are green. Review/publish/deploy/browser verification remain.

## files changed

- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-11 04:35:59 fs.write: `.task/os/polish-traces-page-and-add-runtime-insight/workpad.md`

## workspace-owned: validation evidence

- RED: `tests/trace-site-inspector-os-owned.test.ts` -> 16 passed / 3 failed on the new expectations (`fs.read` output, indirect code-file target, `mac.call` request details).
- GREEN: focused formatter suite -> 19/19 passed.
- GREEN: tracing/runtime regression set -> 8 files, 72/72 tests passed.
- GREEN: `bun run build:observability-traces-runtime` rebuilt `inspector.js` successfully.
- 2026-09-11 04:39:44 `review.run`: passed — OK
- 2026-09-11 04:40:02 `review.run`: passed — OK
- 2026-09-11 04:40:14 `verify`: passed — OK

## key decisions

- Improve the generic semantic summarization layer so the fix scales beyond the screenshot/tool top 20 instead of hardcoding individual rows.
- Keep `[REDACTED_*]` historical fallbacks neutral; specificity must never come from hidden/redacted values.
- Keep the OS-owned formatter as the sole production source; do not update the deprecated workspace formatter copy.

## notes for ko

- New table-driven coverage exercises 22 common/representative tool variants plus Bun/Python/Bash code-call file extraction and generic-success suppression.

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

## workspace-owned: files read

- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`

## 2026-09-11 — semantic trace summaries

### Summary
- Status: in progress
- User goal: replace vague trace-table Input/Output labels such as `inspect source`, `request details`, and `command completed` with concise semantic action/subject labels across the common tool surface, not a one-off screenshot fix.
- Shipping target: task PR #2447 -> `stream/os`, then `stream/os` -> main, Canary release/local update, and authenticated browser DOM verification on the Tracing page.

### Test-first contract
- Behavior under test: `formatTraceTableRow` should derive short, safe summaries from structured tool inputs/results for common filesystem, code, search, status, stream, Mac, browser, GitHub, batch, review, verify, task, and steering traces; it should prefer concrete filenames/commands/targets when present and avoid generic completion strings on successful outputs.
- Existing local pattern: `packages/os/tests/trace-site-inspector-os-owned.test.ts` directly exercises the OS-owned formatter that is bundled into the v38 Tracing runtime.
- New tests to add first: table-driven coverage for at least 20 representative/common tool variants, indirect code-file extraction (`const path = ...; Bun.file(path)` / writes), Mac command summaries, and generic-success-message suppression while preserving redaction fallbacks.
- Focused red command: `cd packages/os && bunx vitest run tests/trace-site-inspector-os-owned.test.ts`.
- Expected red: new assertions fail on current `inspect source`, `request details`, and `command completed` behavior.
- No-test waiver: none.

### Discovery
- Canonical source: `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`.
- Shipped browser artifact: `packages/os/assets/vendor/observability-traces-v38/inspector.js`, rebuilt with `bun run build:observability-traces-runtime`.
- `mac.call` input is `{ command, cwd?, timeout?, dryRun? }`, so its current `request details` fallback can be replaced with a command summary.
- The legacy `packages/workspace/scripts/trace-site-inspector` copy is deprecated; do not use it as the production source.

- 2026-09-11 04:35:59 append: `.task/os/polish-traces-page-and-add-runtime-insight/workpad.md`

- 2026-09-11 04:36:53 apply-patch: `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- 2026-09-11 04:37:39 apply-patch: `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- 2026-09-11 04:37:47 apply-patch: `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- 2026-09-11 04:37:55 apply-patch: `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`

- 2026-09-11 04:39:23 apply-patch: `.task/os/polish-traces-page-and-add-runtime-insight/workpad.md`

- 2026-09-11 04:39:49 apply-patch: `packages/os/tests/trace-site-inspector-os-owned.test.ts`
