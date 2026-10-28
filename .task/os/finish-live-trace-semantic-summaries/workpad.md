# finish live trace semantic summaries

branch: `task/os/finish-live-trace-semantic-summaries`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2459/finish-live-trace-semantic-summaries
github pr: https://github.com/consuelohq/opensaas/pull/2459
started: 2026-09-11

## acceptance criteria

- [x] Replace vague trace-table Input/Output fallbacks with short semantic summaries for the top/common OS tools.
- [x] Preserve useful concrete details such as filenames, commands, release channel/PR, lifecycle version, and browser action when available.
- [x] Rebuild the OS-owned v38 browser runtime containing the formatter changes.
- [ ] Merge through `stream/os` to `main`, publish Canary, update this node locally, and verify the real Tracing DOM after release.

## plan

1. Extend the canonical OS trace formatter with structured summaries and regression coverage for common live tool shapes.
2. Rebuild `assets/vendor/observability-traces-v38/inspector.js` from the OS-owned browser source.
3. Run focused tests plus review/verify, publish the task into `stream/os`, then release the resulting main-targeting stream PR to Canary.
4. Verify the exact local runtime version and inspect `https://internal.consuelohq.com/observability/traces` in the rendered DOM.

## current status

- Formatter, regression coverage, and the committed v38 browser runtime are complete and green. Publish/release, local update, and live DOM acceptance remain.

## files changed

- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-11 05:46:48 fs.write: `.task/os/finish-live-trace-semantic-summaries/workpad.md`

## workspace-owned: validation evidence

- `bun run --cwd packages/os build:observability-traces-runtime` succeeded and regenerated the committed v38 runtime from the OS-owned browser entrypoint.
- Focused runtime/formatter/site validation passed: 3 test files, 39/39 tests.
- 2026-09-11 14:15:09 `review.run`: passed — OK
- 2026-09-11 14:15:38 `review.run`: passed — OK
- 2026-09-11 14:15:52 `verify`: passed — OK
- Final strict review has 0 task issues and 0 blockers; full verify reports `publishValid: true` with 0 DB risks/findings.
- 2026-09-11 14:16:22 `verify`: passed — OK

## key decisions

- Keep summary generation in the canonical OS formatter rather than adding UI-only string rewrites.
- Rebuild the committed browser bundle with `bun run build:observability-traces-runtime`; `buildObservabilityTracesSite` embeds that asset into the materialized Tracing page.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Canary 0.1.114 proved the source-only formatter change was insufficient: the live page still served the older inlined `inspector.js`. Shipping therefore requires regenerating the committed browser runtime before release.
- First strict review flagged two `console.*` strings in test fixtures. The fixtures now use `process.stdout.write`; focused tests, strict review, and full verify all pass afterward.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## 2026-09-11 — live DOM follow-up

### Test-first contract
- Behavior under test: the shipped Tracing table must summarize the actual displayed tool labels and payload shapes, including derived code-call labels such as `bun.read`/`bun.edit`/`python.read`/`bash.read`, lifecycle calls, tools.search, release, and other common facade tools, rather than falling back to `inspect source`, `request details`, or `command completed`.
- Existing local pattern: `packages/os/tests/trace-site-inspector-os-owned.test.ts` directly exercises the canonical table formatter; browser DOM verification is the post-release acceptance test.
- Live failing reproduction: after Canary 0.1.114 was installed, `browser.snap` on `https://internal.consuelohq.com/observability/traces` still showed many recent rows with `bun.read -> inspect source`, `lifecycle.status -> request details`, and successful tools/lifecycle/release rows -> `command completed`.
- New tests first: replay representative recent trace rows with the production-facing/derived tool labels, plus a coverage matrix for the live top/common tools and generic-success suppression.
- Focused red command: `cd packages/os && bunx vitest run tests/trace-site-inspector-os-owned.test.ts`.
- Expected red: formatter fails the production-facing `bun.read` and lifecycle/tool success-label assertions even though the earlier raw `code.call` tests pass.
- No-test waiver: none.

### Acceptance
- Fix the semantic layer at the right abstraction so aliases/derived display labels retain the original operation semantics.
- Cover at least the requested top 20/common tool surface and broad safe fallbacks where structured data exists.
- Rebuild the v38 browser runtime; review + verify green.
- Promote through stream/os -> main, publish Canary, update local runtime, then re-open the real Tracing page and inspect DOM for residual vague labels.

- 2026-09-11 05:46:48 append: `.task/os/finish-live-trace-semantic-summaries/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`

- 2026-09-11 14:16:13 apply-patch: `.task/os/finish-live-trace-semantic-summaries/workpad.md`
