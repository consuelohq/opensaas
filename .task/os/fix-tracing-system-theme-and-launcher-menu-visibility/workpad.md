# task(os): fix tracing system theme and launcher menu visibility

branch: `task/os/fix-tracing-system-theme-and-launcher-menu-visibility`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2254/fix-tracing-system-theme-and-launcher-menu-visibility
github pr: https://github.com/consuelohq/opensaas/pull/2254
started: 2026-08-29

## acceptance criteria

- [x] Restore the canonical 12-column trace table, including a visible Status column, without shifting or clipping row content.
- [x] Apply the system light/dark palette to the trace body, filter drawer, and selected-trace inspector.
- [x] Remove split-pane transitions that cause the selected trace view to flash or glitch while it opens and closes.
- [x] Preserve OAuth, universal-login, public-gateway, and Cloudflare deployment security contracts.
- [ ] Publish the reviewed signed runtime to canary and verify the installed service.

## plan

1. Reproduce the header/runtime mismatch with focused contract tests.
2. Restore the table grid and selected-trace theme/layout behavior in the OS-owned source.
3. Rebuild the vendored browser runtime and run focused tracing plus security/OAuth gates.
4. Run the formal review/verify gate, address GitHub reviews, and promote the exact signed release to canary.

## current status

- Trace layout, system theme, filter panel, and inspector fixes are implemented. The generated inspector bundle is rebuilt. Focused tracing tests and the security/OAuth/typecheck gates are green; formal publish verification and canary promotion remain.

## files changed

- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/tests/observability-traces-site.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 00:25:45 fs.write: `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 00:29:25 `review.run`: passed — OK
- 2026-08-29 00:31:44 `verify`: failed — COMMAND_FAILED
- 2026-08-29 01:37:24 `verify`: passed — OK
- 2026-08-29 01:37:46 `verify`: passed — OK
- 2026-08-29 01:39:08 `verify`: passed — OK

## key decisions

- Keep the established 12-column Trace Burn layout rather than trying to compensate for mixed 11/12-column runtime state.
- Theme the inspector through its existing `--ti-*` variables and focused light selectors so dark-mode behavior stays unchanged.
- Disable only the split-pane/body transitions implicated in the selection glitch; preserve the inspector and its interaction model.

## notes for ko

- The first security-suite invocation was made from the monorepo root and failed only because the test spawns package-relative imports. Re-running from `packages/os` produced 74 pass, 5 environment-gated skips, and 0 failures; syntax/typecheck also passed.

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

## Launcher cleanup follow-up

behavior under test: the shared launcher renders title-only routes, hides reliably when closed, preserves three desktop columns, removes internal dividers, keeps the 780px laptop width, and expands to 1040px on displays at least 1600px wide.
existing local pattern: packages/os/tests/internal-launcher-regressions.test.ts and packages/os/tests/observability-traces-site.test.ts.
new or changed tests: title-only markup, hidden-state CSS, divider removal, wide-display sizing, and tracing integration expectation.
focused red command: bun test tests/internal-launcher-regressions.test.ts
expected red failure: rendered launcher still contained <small> descriptions before the renderer change.
focused green evidence: 31 OS contracts and 53 test-selection contracts passed in the isolated reconciliation clone.

- 2026-08-29 00:25:45 append: `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`

- 2026-08-29 00:26:31 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 00:27:29 apply-patch: `packages/os/scripts/lib/workspace-chrome.ts`
- 2026-08-29 00:27:29 apply-patch: `packages/os/tests/internal-launcher-regressions.test.ts`
- 2026-08-29 00:27:29 apply-patch: `packages/os/tests/observability-traces-site.test.ts`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/docs/install-control-plane.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/internal-user-dashboard.ts`
- `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/lib/paths.js`
- `packages/workspace/scripts/task-push.js`
