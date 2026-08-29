# task(os): fix tracing system theme and launcher menu visibility

branch: `task/os/fix-tracing-system-theme-and-launcher-menu-visibility`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2254/fix-tracing-system-theme-and-launcher-menu-visibility
github pr: https://github.com/consuelohq/opensaas/pull/2254
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/internal-launcher-regressions.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/settings-site.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 00:25:45 fs.write: `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 00:29:25 `review.run`: passed — OK
- 2026-08-29 00:31:44 `verify`: failed — COMMAND_FAILED

## key decisions

- none yet

## notes for ko

- none yet

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
- `packages/os/scripts/lib/internal-user-dashboard.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
