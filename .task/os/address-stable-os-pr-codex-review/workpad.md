# Address stable OS PR Codex review

branch: `task/os/address-stable-os-pr-codex-review`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2211/address-stable-os-pr-codex-review
github pr: https://github.com/consuelohq/opensaas/pull/2211
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 06:12:49 fs.write: `.task/os/address-stable-os-pr-codex-review/workpad.md`
- 2026-08-26 06:20:31 fs.write: `.task/os/address-stable-os-pr-codex-review/workpad.md`
- 2026-08-26 06:34:07 fs.write: `.task/os/address-stable-os-pr-codex-review/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 06:33:27 `review.run`: passed — OK

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

## Test-first contract

behavior under test: Stable review fixes must reject extra sealed-envelope fields, bound optional gog downloads, honor Google OAuth timeoutMs, recover upgraded-node account identity, keep trace input/output weights separate, route all Secrets files through focused tests, and keep the launcher menu reachable without horizontal or vertical scrolling.
existing local pattern: packages/os/tests/secrets-hono-routes.test.ts, managed-gog.test.ts, google-tool.test.ts, trace-history-redaction.test.ts, workspace-chrome.test.ts, internal-launcher-regressions.test.ts, and packages/workspace/tests/test-selection.test.js.
new or changed tests: add focused regressions to those existing suites before production edits.
focused red command: bun test packages/os/tests/secrets-hono-routes.test.ts packages/os/tests/managed-gog.test.ts packages/os/tests/google-tool.test.ts packages/os/tests/trace-history-redaction.test.ts packages/os/tests/workspace-chrome.test.ts packages/workspace/tests/test-selection.test.js
expected red failure: current parsing accepts envelope/recipient extras; fetch has no abort deadline; facade timeout ignores timeoutMs; upgraded nodes without heartbeat account fail early; trace fallback double-counts input as output; Secrets route seed files do not select the critical suite; menu CSS has no bounded fit strategy for short viewports.
no-test waiver: not applicable.

- 2026-08-26 06:12:49 append: `.task/os/address-stable-os-pr-codex-review/workpad.md`

Additional approved regression: every internal Consuelo HTML surface must emit the Consuelo favicon used by the Astro site/docs so browsers do not reuse Google's icon. Add a render assertion before changing the shared shell.

- 2026-08-26 06:20:31 append: `.task/os/address-stable-os-pr-codex-review/workpad.md`

## Final verification

- Focused OS regressions: 32 passed, 0 failed.
- Facade timeout regression: 1 passed, 0 failed.
- Secrets route-selection regression: 1 passed, 0 failed.
- Workspace script syntax: passed.
- Strict review against origin/stream/os: 0 blockers, 0 issues; one non-blocking trace documentation opportunity.
- Existing facade snapshot drift remains intentionally out of scope; no snapshot update is included.

- 2026-08-26 06:34:07 append: `.task/os/address-stable-os-pr-codex-review/workpad.md`
