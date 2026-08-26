# fix tracing tool labels and batch child inputs

branch: `task/workspace-agents/fix-tracing-tool-labels-and-batch-child-inputs`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2181/fix-tracing-tool-labels-and-batch-child-inputs
github pr: https://github.com/consuelohq/opensaas/pull/2181
started: 2026-08-26

## acceptance criteria

- [x] Tracing renders the canonical OS filesystem search tool as `fs.search`, never the legacy `files.search` UI alias.
- [x] Batch rows map each top-level result back to its originating batch step so the displayed tool name and input come from the actual invoked tool even when the result envelope is generic (for example `name: "trace"`).
- [x] Tool-owned `data.results` payloads (for example `explore` search hits) are not materialized as fake nested trace rows.
- [x] Existing trace-history authorization/redaction boundaries remain unchanged; this fix must not add a new raw-payload path or bypass sanitization.
- [x] Focused regression tests pass, the browser runtime is rebuilt from OS-owned source, security/redaction tests pass, and review/verification are clean before push.

## plan

1. Add focused failing tests for the `fs.search` label, generic batch-result envelopes, preserved batch-step inputs, and non-trace `data.results` payloads.
2. Fix OS-owned table formatting and batch child materialization with the smallest source change.
3. Rebuild `assets/vendor/observability-traces-v38/inspector.js` from the OS-owned browser entrypoint.
4. Run focused inspector tests plus trace-history redaction/gateway security tests, inspect the diff, run review/verify, then push the task branch to GitHub.

## current status

- Fix implemented, browser runtime rebuilt, regression/security checks passed, and review/verify are clean. Ready to push.

## files changed

- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts` — preserve the canonical `fs.search` label.
- `packages/os/scripts/lib/trace-site-inspector/model.ts` — map batch result envelopes to the authoritative batch step tool/input and stop treating ordinary tool result arrays as nested traces.
- `packages/os/tests/trace-site-inspector-interactions.test.ts` — add regressions for the label, generic result envelopes, batch inputs, and ghost trace rows.
- `packages/os/assets/vendor/observability-traces-v38/inspector.js` — rebuilt generated browser runtime from OS-owned source.

## workspace-owned: files changed

- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Focused RED regression: failed exactly on `fs.search` being rendered as `files.search` and batch `data.results` producing four rows instead of two.
- Focused GREEN regression: 9 tests passed, 0 failed.
- Expanded tracing/security regression suite: 57 tests passed, 0 failed, 300 assertions.
- Browser runtime rebuild: `build:observability-traces-runtime` completed successfully.
- 2026-08-26 01:55:10 `review.run`: passed — OK
- 2026-08-26 01:55:37 `verify`: passed — OK

## key decisions

- `files.search` was only a display alias in `table-formatters.ts`; tracing already stores the canonical `fs.search` identity, so the alias was removed rather than changing trace data.
- Top-level batch step metadata is authoritative for the invoked child tool and input. Generic result-envelope names such as `trace` must not override it.
- Ordinary tool-owned `data.results` arrays are business payloads, not trace children. Recursive `results` expansion is retained only for actual nested `batch` children; explicit `children` remains supported.
- Security boundary is unchanged: trace history continues through the existing authenticated same-origin gateway and existing redaction/path-scrubbing pipeline; the fix introduces no new raw-payload access path.

## notes for ko

- Tracing now shows `fs.search`, batch child rows show the real tool and real step input, and `explore`/other tool results no longer generate fake `trace` rows.
- No trace authorization or redaction behavior was loosened.

## improvements noticed

- none yet

## issues and recovery

- First `task.push` attempt failed with `COMMAND_FAILED` because the Consuelo `gh` shim shadowed the authenticated system GitHub CLI, so the publish helper could not resolve a GitHub token (trace `trc_4241fd22a5cf`).
- Recovery was scoped and secret-safe: confirmed the task-local `packages/workspace/.env` is absent and git-ignored, and confirmed the system GitHub CLI is authenticated. Use a temporary mode-0600 env file only long enough for the direct `task.push`, never print the token, then delete the file immediately after publish.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/runtime-bundle-managed-site-assets.test.ts`
- `packages/os/tests/trace-history-redaction.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`

- 2026-08-26 01:56:28 apply-patch: `.task/workspace-agents/fix-tracing-tool-labels-and-batch-child-inputs/workpad.md`

- 2026-08-26 01:57:39 apply-patch: `.task/workspace-agents/fix-tracing-tool-labels-and-batch-child-inputs/workpad.md`