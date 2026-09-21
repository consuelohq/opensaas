# address reload sites coderabbit findings

branch: `task/os/address-reload-sites-coderabbit-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2248/address-reload-sites-coderabbit-findings
github pr: https://github.com/consuelohq/opensaas/pull/2248
started: 2026-08-28

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

- 2026-08-28 23:10:32 fs.write: `.task/os/address-reload-sites-coderabbit-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-28 23:11:35 `review.run`: passed — OK
- 2026-08-28 23:11:37 `review.run`: passed — OK

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

## CodeRabbit findings addressed

- Red evidence: `bun test packages/os/tests/lifecycle-restart-contract.test.ts` failed because `BUN_EXECUTABLE` was absent after tightening the contract.
- Runtime fix: managed Sites refresh now uses `BUN_BIN`, the active Bun executable when already running under Bun, or `bun` on PATH as the safe manual Node fallback.
- Test isolation: each lifecycle switch branch is extracted before asserting its post-success Sites refresh, avoiding matches in later cases.
- Test naming: the lifecycle contract follows `should [behavior] when [condition]`.

## Green evidence

- `node --check packages/os/scripts/consuelo-reload.js && bun test packages/os/tests/lifecycle-restart-contract.test.ts`: 23 pass, 0 fail.
- Reload, ingress continuity, worker-pool, and Bun product-server execution suites: 26 pass, 0 fail.
- Bun path, Tracing system theme/live history, launcher owner route, and lifecycle suites: 43 pass, 0 fail.
- The earlier full package verify failures remain unrelated facade fixtures (`media.transcribe` dry-run, `subagent` dry-run, filesystem pagination message text). Ko explicitly approved bypassing unrelated failures for this release after focused OS safety gates pass.

- 2026-08-28 23:10:32 append: `.task/os/address-reload-sites-coderabbit-findings/workpad.md`
